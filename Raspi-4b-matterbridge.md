# Raspberry Pi 4 Model B — Matterbridge on Bun Host Setup

Configuration log for a headless Raspberry Pi 4 Model B intended to run **Matterbridge** only.
Goal: fully headless, lean, no swap (8 GB of RAM makes it useless), passwordless sudo, Bun as the only runtime, no Docker.

- **Board:** Raspberry Pi 4 Model B Rev 1.5 (8 GB physical RAM)
- **OS:** Debian GNU/Linux 13 (Trixie), 64-bit
- **Kernel:** 6.18.50+rpt-rpi-v8 (aarch64)
- **Role:** Headless — no monitor, no camera, no peripherals; accessed over SSH
- **Date:** 30 Sep 2026

---

## Summary of what changed

| Area                | Before                                     | After                                        |
| ------------------- | ------------------------------------------ | -------------------------------------------- |
| Swap                | zram 2 GB + `/var/swap` 2 GB (`zram+file`) | none (`rpi-swap` `Mechanism=none`)           |
| sudo                | password required                          | passwordless for `lligu`                     |
| GPU firmware split  | 76 MB (`arm=948M`)                         | 16 MB (`arm=998M`)                           |
| CMA reservation     | 512 MB                                     | 64 MB                                        |
| KMS graphics driver | enabled                                    | disabled (headless)                          |
| Boot target         | graphical.target                           | multi-user.target (console)                  |
| Running services    | desktop stack (lightdm, audio, NFS, CUPS…) | 13 essential units                           |
| RAM used at idle    | ~539 Mi                                    | ~188 Mi (~351 Mi with Matterbridge running)  |
| Journal             | volatile (RAM), forwarded to syslog        | persistent on disk, 3 days, 100 MB cap       |
| Runtime             | none                                       | Bun 1.4.2 only (no Node.js, no Docker)       |
| Matterbridge        | —                                          | 3.10.11, systemd user service with lingering |
| Disk used (`/`)     | 6.7 GB                                     | 5.0 GB                                       |

---

## 1. Starting point

```bash
cat /proc/device-tree/model
free -h
cat /proc/swaps
ls -l /var/swap
dpkg -l | grep -iE 'zram|dphys'
systemctl get-default
grep -vE '^\s*(#|$)' /boot/firmware/config.txt
grep -i cma /proc/meminfo
vcgencmd get_mem arm && vcgencmd get_mem gpu
systemctl list-units --type=service --state=running --no-legend | wc -l
```

Result:

- `MemTotal` 7.6 Gi, ~539 Mi used at idle
- zram swap `/dev/zram0` (2 GB, PRIO 100) from `systemd-zram-generator`, plus a 2 GB `/var/swap` file on the SD card
- boot target `graphical.target` (the SD card was flashed with the **Desktop** image)
- `dtoverlay=vc4-kms-v3d` with `CmaTotal` 512 MB, firmware split `arm=948M` / `gpu=76M`
- 20 running services

---

## 2. Passwordless sudo

A sudoers drop-in, validated by `visudo` (needs the password this one last time):

```bash
echo "lligu ALL=(ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/010_lligu-nopasswd >/dev/null
sudo chmod 0440 /etc/sudoers.d/010_lligu-nopasswd
sudo visudo -c        # -> /etc/sudoers.d/010_lligu-nopasswd: parsed OK
```

Verify:

```bash
sudo -n true && echo OK
```

---

## 3. No swap

With 8 GB of RAM, swap is useless here. On Trixie the swap is managed by `rpi-swap`
(`/etc/rpi/swap.conf`): the default `Mechanism=auto` means `zram+file`, a zram device
with `/var/swap` as the writeback file. `Mechanism=none` (see `man swap.conf`) turns it
off and removes the swap file at the next boot:

```bash
sudo install -d -m 0755 /etc/rpi/swap.conf.d
printf '[Main]\nMechanism=none\n' | sudo tee /etc/rpi/swap.conf.d/99-noswap.conf
sudo reboot
```

### Verification

```bash
free -h
cat /proc/swaps
ls -l /var/swap
```

Result after reboot: `Swap: 0B`, `/proc/swaps` empty, `/var/swap` removed (2 GB of SD card freed).

---

## 4. Disable the graphics stack (headless)

On Trixie the stock `dtoverlay=vc4-kms-v3d` loads the KMS graphics driver, which on the
Pi 4 reserves **512 MB of CMA**. The firmware also reserved **76 MB** for the GPU
(`arm=948M`). None of this is needed on a headless Matterbridge node.

### Edit `/boot/firmware/config.txt`

Backup first:

```bash
sudo cp /boot/firmware/config.txt /boot/firmware/config.txt.bak
sudo nano /boot/firmware/config.txt
```

Changes made (top, non-conditional section only):

```
camera_auto_detect=0      # was 1 (no camera attached)
display_auto_detect=0     # was 1 (no display attached)

# Minimum GPU split (headless, KMS off)
gpu_mem=16                # new line — loads the cut-down firmware start4cd.elf

# was: dtoverlay=vc4-kms-v3d
#dtoverlay=vc4-kms-v3d
# was: max_framebuffers=2
#max_framebuffers=2
```

**Left untouched:** `dtparam=audio=on`, `auto_initramfs=1`, `disable_fw_kms_setup=1`,
`arm_64bit=1`, `disable_overscan=1`, `arm_boost=1`, and all conditional blocks (`[cm4]`,
`[cm5]`, `[pi5]`, `[all]`), which do not apply to the Pi 4 B.

The reboot is done together with the next step.

### Verification

```bash
free -h
vcgencmd get_mem arm && vcgencmd get_mem gpu
grep -i cma /proc/meminfo
```

Results after reboot:

- `arm=998M` (was 948M), `gpu=16M` (was 76M)
- `CmaTotal` = **65536 kB (64 MB)** (was 512 MB)
- `MemTotal` 7.7 Gi (was 7.6 Gi)

---

## 5. Trim running services (Desktop image → headless)

This SD card was flashed with the **Desktop** image: `lightdm` started a desktop session
(with `gvfs-*`, `xdg-desktop-portal*`, `accounts-daemon`, `udisks2`) plus an audio stack,
NFS/RPC and CUPS printing — none of it needed for a headless Matterbridge node.

```bash
systemctl list-units --type=service --state=running
systemctl --user list-units --type=service --state=running
systemctl list-units --type=socket --state=active
systemctl get-default        # was: graphical.target
```

### Stop the desktop from launching at boot

Switches the default boot target to console-only, so `lightdm` and the whole desktop
session never start:

```bash
sudo systemctl set-default multi-user.target
```

Reversible anytime with `sudo systemctl set-default graphical.target`.

### Remove NFS / RPC (not used)

```bash
sudo systemctl disable --now nfs-blkmap.service rpcbind.service rpcbind.socket
sudo systemctl stop rpcbind.socket      # socket lingers in the current session
```

### Remove CUPS printing (not used)

```bash
sudo systemctl disable --now cups.socket cups.path cups.service cups-browsed.service
```

Verify:

```bash
systemctl is-active  rpcbind.service rpcbind.socket nfs-blkmap.service cups.socket cups.service cups-browsed.service   # -> inactive
systemctl is-enabled rpcbind.service rpcbind.socket nfs-blkmap.service cups.socket cups.service cups-browsed.service   # -> disabled
```

### Mask the audio stack (user services)

Four PipeWire units plus sockets so nothing socket-activates them back:

```bash
systemctl --user mask pipewire.service pipewire-pulse.service wireplumber.service \
  filter-chain.service pipewire.socket pipewire-pulse.socket
```

### Bluetooth — KEPT

`bluetooth.service` was **left running**, as on the Zero 2 W: some device plugins may use
BLE. To disable later if no plugin needs it: `sudo systemctl disable --now bluetooth.service`.

### Services that MUST stay (do not touch)

`avahi-daemon` (critical — Matter/mDNS lifeline), `dbus`, `NetworkManager`,
`wpa_supplicant`, `ssh`, `cron`, `getty@tty1` (console login), the `systemd-*` core
(`journald`, `logind`, `timesyncd`, `udevd`), and `user@1000`.

### Result after reboot

```bash
sudo reboot
free -h
systemctl list-units --type=service --state=running
systemctl --failed
```

- `used` fell from ~539 Mi to **188 Mi**
- running services dropped from 20 to **13 essential units**, no failed units
- user services: only `dbus` and `mpris-proxy` (Bluetooth media control) left
- SSH and avahi unaffected

```text
               total        used        free      shared  buff/cache   available
Mem:           7.7Gi       188Mi       7.4Gi       8.8Mi       165Mi       7.5Gi
Swap:             0B          0B          0B
```

---

## 6. Keep the journal on disk, with limits

Raspberry Pi OS ships `/usr/lib/systemd/journald.conf.d/40-rpi-volatile-storage.conf`
(`Storage=volatile`, journal in RAM only). A drop-in in `/etc` switches it to disk, with
compression, 3 days of retention and size caps:

```bash
# 1. create BOTH directories
sudo install -d -m 0755 /etc/systemd/journald.conf.d          # the drop-in dir
sudo install -d -g systemd-journal -m 2755 /var/log/journal   # the persistent journal dir

# 2. write the drop-in
sudo tee /etc/systemd/journald.conf.d/99-matterbridge.conf >/dev/null <<'EOT'
[Journal]
# Store logs persistently in /var/log/journal so they survive reboots.
Storage=persistent
# Compress logs to save space.
Compress=yes
# Keep logs for a maximum of 3 days.
MaxRetentionSec=3days
# Rotate logs daily within the 3-day retention period.
MaxFileSec=1day
# Disable forwarding to syslog to prevent duplicate logging.
ForwardToSyslog=no
# Limit persistent logs on disk in /var/log/journal to 100 MB.
SystemMaxUse=100M
# Limit runtime logs in RAM in /run/log/journal to 10 MB.
RuntimeMaxUse=10M
EOT
```

Drop-ins are applied in filename order across `/usr/lib` and `/etc`, so the packaged
`/usr/lib/systemd/journald.conf.d/syslog.conf` (`ForwardToSyslog=yes`) sorts after
`99-matterbridge.conf` and wins. No syslog daemon is installed, so it is overridden by a
file with the same name in `/etc`:

```bash
# 3. override the packaged syslog.conf
printf '[Journal]\n# Overrides /usr/lib/systemd/journald.conf.d/syslog.conf: no syslog daemon is installed.\nForwardToSyslog=no\n' \
  | sudo tee /etc/systemd/journald.conf.d/syslog.conf >/dev/null

# 4. apply + verify
sudo systemctl restart systemd-journald && sudo journalctl --flush
sudo systemd-analyze cat-config systemd/journald.conf | grep -E '^# /|^(Storage|ForwardToSyslog)='
journalctl --disk-usage
```

Result: `Storage=persistent` and `ForwardToSyslog=no` are the last values applied; the
journal is in `/var/log/journal`.

---

## 7. Bun as the only runtime

Checked first that there is no other runtime or container engine:

```bash
for c in node nodejs npm bun docker podman containerd; do printf '%-11s ' $c; command -v $c || echo '-'; done
```

Result: none installed (`curl` and `unzip`, needed by the installer, are present).

Install Bun with the official installer (to `~/.bun`, no sudo):

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version        # -> 1.4.2
```

The installer adds `BUN_INSTALL` and `~/.bun/bin` to `PATH` at the end of `~/.bashrc`, so
they are set in interactive shells only (Debian's `.bashrc` returns early for
non-interactive ones, e.g. `ssh raspi4 'bun …'`). `~/.bun` takes 76 MB.

---

## 8. Install Matterbridge

Fresh host, so there is no previous service to stop or global package to remove.

```bash
cd ~
# ✅ Creates all needed dirs
mkdir -p ~/Matterbridge ~/.matterbridge ~/.mattercert
# ✅ Ensures ownership
chown -R $USER:$USER ~/Matterbridge ~/.matterbridge ~/.mattercert
# ✅ Secure permissions
chmod -R 755 ~/Matterbridge ~/.matterbridge ~/.mattercert
# ✅ Install matterbridge and mb-service in the Bun global node_modules (~/.bun/install/global), no sudo
bun add matterbridge mb-service-linux --global --omit=dev
# ✅ Clear bash command cache as a precaution
hash -r
# ✅ Check which matterbridge -> ~/.bun/bin/matterbridge
which matterbridge
# ✅ Check which mb-service -> ~/.bun/bin/mb-service
which mb-service
# ✅ Will output the matterbridge version
bunx --bun matterbridge --version
```

Result: `matterbridge@3.10.11` and `mb-service-linux@2.0.4` installed (143 packages).

---

## 9. Matterbridge service (systemd user unit)

Run without sudo, `mb-service create` writes a **user** unit in
`~/.config/systemd/user/matterbridge.service`. The `mb-service` bin has a `node` shebang
and there is no Node.js here, so it is always run through `bunx --bun`:

```bash
# ✅ Will create the service file
bunx --bun mb-service create
```

The unit uses absolute paths, so it does not depend on `~/.bashrc`:

```ini
Environment="PATH=%h/.bun/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=%h/.bun/bin/bun --bun %h/.bun/bin/matterbridge --service
WorkingDirectory=/home/lligu/Matterbridge
```

A user service runs only while the user manager is up. Lingering starts it at boot,
without any login — required on a headless host:

```bash
sudo loginctl enable-linger lligu
loginctl show-user lligu -p Linger        # -> Linger=yes
```

Enable and start:

```bash
bunx --bun mb-service enable
bunx --bun mb-service start
bunx --bun mb-service status
journalctl --user -u matterbridge -n 1000 -f --output cat
```

Result: `active (running)`, main process `bun --bun ~/.bun/bin/matterbridge --service`,
server node online and commissionable. Frontend on `http://raspi4.local:8283`.

---

## 10. Full upgrade

```bash
sudo apt update
sudo apt full-upgrade -y
sudo reboot        # raspi-firmware and the initramfs were updated
```

Result (30 Sep 2026): 86 packages upgraded, including `raspi-firmware` and `rpi-eeprom`.
After the reboot the setup is intact: no swap, `multi-user.target`, `gpu=16M`, 13 running
services, no failed units, Matterbridge `active`.

### Bootloader EEPROM

The upgrade brings a new `rpi-eeprom`, which does not flash the bootloader by itself:

```bash
sudo rpi-eeprom-update        # status
sudo rpi-eeprom-config        # current bootloader config
```

Result (30 Sep 2026):

```text
BOOTLOADER: update available
   CURRENT: Sun 17 May 19:13:18 UTC 2026 (1779045198)
    LATEST: Wed 23 Sep 12:02:14 UTC 2026 (1790164934)
   RELEASE: default (/usr/lib/firmware/raspberrypi/bootloader-2711/default)
  VL805_FW: Using bootloader EEPROM
     VL805: up to date
```

Bootloader config is the stock one: `BOOT_UART=0`, `WAKE_ON_GPIO=1`, `POWER_OFF_ON_HALT=0`.

To install the update (it is staged and flashed at the next boot):

```bash
sudo rpi-eeprom-update -a
sudo reboot
sudo rpi-eeprom-update        # -> BOOTLOADER: up to date
```

Result after reboot: `BOOTLOADER: up to date`, `CURRENT: Wed 23 Sep 12:02:14 UTC 2026`;
the staging files (`pieeprom.upd`, `recovery.bin`) were removed from `/boot/firmware` and
Matterbridge came back `active`.

---

## Final state

After a reboot, Matterbridge starts on its own:

```bash
free -h
systemctl list-units --type=service --state=running
systemctl --user list-units --type=service --state=running
ps -o rss=,cmd= -C bun
```

- **7.7 Gi total RAM**, ~351 Mi used with Matterbridge running, no swap
- Bun (Matterbridge) uses ~205 MB RSS
- **13 running system services**, user services `dbus`, `matterbridge`, `mpris-proxy`; no failed units

```text
               total        used        free      shared  buff/cache   available
Mem:           7.7Gi       351Mi       7.2Gi       828Ki       240Mi       7.3Gi
Swap:             0B          0B          0B
```

---

## Recovery notes

- `config.txt` backup: `/boot/firmware/config.txt.bak`
- Swap back to the default: `sudo rm /etc/rpi/swap.conf.d/99-noswap.conf && sudo reboot`
- Desktop back: `sudo systemctl set-default graphical.target` and uncomment `dtoverlay=vc4-kms-v3d`
- The box is reached only over SSH, which does not depend on the display driver — so
  disabling KMS cannot lock you out.
- Console autologin on tty1 (`/etc/systemd/system/getty@tty1.service.d/autologin.conf`, set by
  the Desktop image) is **kept on purpose** for emergency access with a keyboard and screen.
  With passwordless sudo that is a root shell, so the board must stay physically secure.
- If the SD card is unbootable, edit `config.txt` directly on the boot partition from
  another machine.

---

## Next steps (post-setup housekeeping)

Run once Matterbridge has been running for a while:

```bash
df -h /
sudo apt autoremove --purge
sudo apt clean
sudo journalctl --vacuum-size=50M
```

Checked right after the setup (30 Sep 2026): nothing to do yet — `apt-get -s autoremove --purge`
lists 0 packages, `/var/cache/apt/archives` is empty and the journal is ~16 MB.
