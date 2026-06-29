<!-- eslint-disable markdown/no-missing-label-refs -->
<!-- eslint-disable markdown/no-multiple-h1 -->

# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge systemd configuration

[![npm version](https://img.shields.io/npm/v/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge/latest?label=docker%20version)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge?label=docker%20pulls)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge/actions/workflows/build.yml/badge.svg)
![CodeQL](https://github.com/Luligu/matterbridge/actions/workflows/codeql.yml/badge.svg)
[![Codecov](https://codecov.io/gh/Luligu/matterbridge/branch/main/graph/badge.svg)](https://codecov.io/gh/Luligu/matterbridge)
[![tested with Vitest](https://img.shields.io/badge/tested_with-Vitest-6E9F18.svg?logo=vitest&logoColor=white)](https://vitest.dev)
[![styled with Oxc](https://img.shields.io/badge/styled_with-Oxc-9BE4E0.svg?logo=oxc&logoColor=white)](https://oxc.rs/docs/guide/usage/formatter.html)
[![linted with Oxc](https://img.shields.io/badge/linted_with-Oxc-9BE4E0.svg?logo=oxc&logoColor=white)](https://oxc.rs/docs/guide/usage/linter.html)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TypeScript Native](https://img.shields.io/badge/TypeScript_Native-3178C6?logo=typescript&logoColor=white)](https://github.com/microsoft/typescript-go)
[![ESM](https://img.shields.io/badge/ESM-Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![ESM](https://img.shields.io/badge/ESM-Bun-000000?logo=bun&logoColor=white)](https://bun.com)
[![matterbridge.io](https://img.shields.io/badge/matterbridge.io-online-brightgreen)](https://matterbridge.io)

[![powered by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![powered by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![powered by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---

# Production configuration

> **Nvm is a development tool and is not supported for production**.

## Run matterbridge as a daemon with systemctl (Linux only)

The easiest way to add systemctl is to use [Matterbridge service cli for linux](https://github.com/Luligu/mb-service-linux).

If your setup is too complex or you prefer to do it manually follow this method. You can still use mb-service to manage systemd after.

### First create the Matterbridge directories

This will create the required directories if they don't exist

```bash
cd ~
mkdir -p ~/Matterbridge
mkdir -p ~/.matterbridge
mkdir -p ~/.mattercert
sudo chown -R $USER:$USER ~/Matterbridge ~/.matterbridge ~/.mattercert
```

### Then create a systemctl configuration file for Matterbridge

Create a systemctl configuration file for Matterbridge

```bash
sudo nano /etc/systemd/system/matterbridge.service
```

Add the following to this file, replacing 3 times (!) USER with your user name (e.g. WorkingDirectory=/home/pi/Matterbridge, User=pi and Group=pi):

You may need to adapt the configuration to your setup:

- ExecStart on some linux distribution can also be ExecStart==/usr/bin/matterbridge --service

```text
[Unit]
Description=matterbridge
After=network-online.target
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
ExecStart=matterbridge --service
WorkingDirectory=/home/<USER>/Matterbridge
StandardOutput=inherit
StandardError=inherit
Restart=always
User=<USER>
Group=<USER>

[Install]
WantedBy=multi-user.target
```

On some systems, npm install may fail with errors like `ENETUNREACH`:

This happens when:

The system has IPv6 enabled
DNS returns IPv6 (AAAA) records
But the host does not have a working IPv6 default route

In this situation:

Node.js may try IPv6 first.
The connection fails with ENETUNREACH.
Npm retries may randomly succeed or fail depending on resolution order.

This often indicates a misconfigured IPv6 route / DNS preference.

One possible fix, add this line to the existing [Service] section:

```text
Environment="NODE_OPTIONS=--dns-result-order=ipv4first"
```

If you use the frontend with --ssl --frontend 443 and get an error message: "Port 443 requires elevated privileges",
add this line to the existing [Service] section:

```text
AmbientCapabilities=CAP_NET_BIND_SERVICE
```

If you use the matterbridge-bthome plugin add this line to the existing [Service] section:

```text
AmbientCapabilities=CAP_NET_BIND_SERVICE CAP_NET_RAW CAP_NET_ADMIN
```

If you modify matterbridge.service after, then run:

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

add these to the [Journal] section:

```bash
# Store logs persistently in /var/log/journal so they survive reboots.
Storage=persistent
# Compress logs
Compress=yes
# Keep logs for a maximum of 3 days.
MaxRetentionSec=3days
# Rotate logs daily within the 3-day retention period.
MaxFileSec=1day
# Disable forwarding to syslog to prevent duplicate logging.
ForwardToSyslog=no
# Limit persistent logs in /var/log/journal to 100 MB.
SystemMaxUse=100M
# Limit runtime logs in /run/log/journal to 100 MB.
RuntimeMaxUse=100M
```

save it and run:

```bash
sudo systemctl restart systemd-journald
```

## Verify that with your distro you can run sudo npm install -g matterbridge without the password

Run the following command to verify if you can install Matterbridge globally without being prompted for a password:

```bash
sudo npm install -g matterbridge --omit=dev
```

If you are not prompted for a password, no further action is required.

If that is not the case, open the sudoers file for editing using visudo

```bash
sudo visudo
```

verify the presence of of a line

```text
@includedir /etc/sudoers.d
```

exit and create a configuration file for sudoers

```bash
sudo nano /etc/sudoers.d/matterbridge
```

add this line replacing USER with your user name (e.g. radxa ALL=(ALL) NOPASSWD: ALL)

```text
<USER> ALL=(ALL) NOPASSWD: ALL
```

or if you prefers to only give access to npm without password try with (e.g. radxa ALL=(ALL) NOPASSWD: /usr/bin/npm)

```text
<USER> ALL=(ALL) NOPASSWD: /usr/bin/npm
```

save the file and reload the settings with:

```bash
sudo chmod 0440 /etc/sudoers.d/matterbridge
sudo visudo -c
```

Verify if you can install Matterbridge globally without being prompted for a password:

```bash
sudo npm install -g matterbridge --omit=dev
```
