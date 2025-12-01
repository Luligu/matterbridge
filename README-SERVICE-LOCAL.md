# <img src="https://matterbridge.io/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge systemd configuration with local global node_modules

[![npm version](https://img.shields.io/npm/v/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge?label=docker%20version&sort=semver)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge.svg)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge/actions/workflows/build.yml/badge.svg)
![CodeQL](https://github.com/Luligu/matterbridge/actions/workflows/codeql.yml/badge.svg)
[![codecov](https://codecov.io/gh/Luligu/matterbridge/branch/main/graph/badge.svg)](https://codecov.io/gh/Luligu/matterbridge)

[![power by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![power by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![power by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---

# Advanced configuration

## Run matterbridge as a daemon with systemctl (Linux only) with local global node_modules

The advantage of this setup is that the global node_modules are private for the user and sudo is not required.

This configuration uses a private separate npm cache.

The service runs rootless like the current user.

The storage position is compatible with the traditional setup (~/Matterbridge ~/.matterbridge ~/.mattercert).

### First create the Matterbridge directories and set the correct permissions

This will create the required directories if they don't exist

```bash
cd ~
# ✅ Safe precaution if matterbridge was already running with the traditional setup
sudo systemctl stop matterbridge
# ✅ We need to uninstall from the global node_modules
sudo npm uninstall matterbridge -g
# ✅ Creates all needed dirs
mkdir -p ~/Matterbridge ~/.matterbridge ~/.mattercert ~/.npm-global ~/.npm-cache
# ✅ Ensures ownership
chown -R $USER:$USER ~/Matterbridge ~/.matterbridge ~/.mattercert ~/.npm-global ~/.npm-cache
# ✅ Secure permissions
chmod -R 755 ~/Matterbridge ~/.matterbridge ~/.mattercert ~/.npm-global ~/.npm-cache
# ✅ Install matterbridge in the local global node_modules, with the local cache and no sudo
npm install matterbridge --omit=dev --verbose --global --prefix=~/.npm-global --cache=~/.npm-cache
# ✅ Create a link to matterbridge bin
sudo ln -sf /home/$USER/.npm-global/bin/matterbridge /usr/local/bin/matterbridge
# ✅ Create a link to mb_mdns bin
sudo ln -sf /home/$USER/.npm-global/bin/mb_mdns /usr/local/bin/mb_mdns
# ✅ Create a link to mb_coap bin
sudo ln -sf /home/$USER/.npm-global/bin/mb_coap /usr/local/bin/mb_coap
# ✅ Clear bash command cache as a precaution
hash -r
# ✅ Check which matterbridge
which matterbridge
# ✅ Will output the matterbridge version
matterbridge --version
```

### Then create a systemctl configuration file for Matterbridge

Create a systemctl configuration file for Matterbridge

```bash
sudo nano /etc/systemd/system/matterbridge.service
```

Add the following to this file, **replacing 5 times (!) USER with your user name** (e.g. WorkingDirectory=/home/pi/Matterbridge, User=pi and Group=pi, Environment="NPM_CONFIG_PREFIX=/home/pi/.npm-global" and Environment="NPM_CONFIG_CACHE=/home/pi/.npm-cache"):

```
[Unit]
Description=matterbridge
After=network.target
Wants=network.target

[Service]
Type=simple
Environment="NPM_CONFIG_PREFIX=/home/<USER>/.npm-global"
Environment="NPM_CONFIG_CACHE=/home/<USER>/.npm-cache"
ExecStart=matterbridge --service --nosudo
WorkingDirectory=/home/<USER>/Matterbridge
StandardOutput=inherit
StandardError=inherit
Restart=always
User=<USER>
Group=<USER>

[Install]
WantedBy=multi-user.target
```

If you use the frontend with **-ssl** -frontend 443 and get an error message: "Port 443 requires elevated privileges",
add this:

```
[Service]
AmbientCapabilities=CAP_NET_BIND_SERVICE
```

If you use the **matterbridge-bthome** plugin add this:

```
[Service]
AmbientCapabilities=CAP_NET_BIND_SERVICE CAP_NET_RAW CAP_NET_ADMIN
```

Now and if you modify matterbridge.service after, run:

```bash
sudo systemctl daemon-reload
sudo systemctl restart matterbridge.service
sudo systemctl status matterbridge.service
```

### Start Matterbridge

```bash
sudo systemctl start matterbridge
```

### Stop Matterbridge

```bash
sudo systemctl stop matterbridge
```

### Show Matterbridge status

```bash
sudo systemctl status matterbridge.service
```

### Enable Matterbridge to start automatically on boot

```bash
sudo systemctl enable matterbridge.service
```

### Disable Matterbridge from starting automatically on boot

```bash
sudo systemctl disable matterbridge.service
```

### View the log of Matterbridge in real time (this will show the log with colors)

```bash
sudo journalctl -u matterbridge.service -n 1000 -f --output cat
```

### Delete the logs older then 3 days (all of them not only the ones of Matterbridge!)

Check the space used

```bash
sudo journalctl --disk-usage
```

remove all log older then 3 days

```bash
sudo journalctl --rotate
sudo journalctl --vacuum-time=3d
```

## Prevent the journal logs to grow

If you want to make the setting permanent to prevent the journal logs to grow too much, run

```bash
sudo nano /etc/systemd/journald.conf
```

add

```bash
Compress=yes            # Compress logs
MaxRetentionSec=3days   # Keep logs for a maximum of 3 days.
MaxFileSec=1day         # Rotate logs daily within the 3-day retention period.
ForwardToSyslog=no      # Disable forwarding to syslog to prevent duplicate logging.
SystemMaxUse=100M       # Limit persistent logs in /var/log/journal to 100 MB.
RuntimeMaxUse=100M      # Limit runtime logs in /run/log/journal to 100 MB.
```

save it and run

```bash
sudo systemctl restart systemd-journald
```
