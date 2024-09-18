# <img src="https://github.com/Luligu/matterbridge/blob/main/frontend/public/matterbridge%2064x64.png" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge

[![npm version](https://img.shields.io/npm/v/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge?label=docker%20version&sort=semver)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge.svg)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge/actions/workflows/build.yml/badge.svg)

[![power by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![power by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![power by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---

# Advanced configuration

## Run matterbridge as a daemon with systemctl (Linux only)

Create a systemctl configuration file for Matterbridge

```
sudo nano /etc/systemd/system/matterbridge.service
```

Add the following to this file, replacing twice (!) USER with your user name (e.g. WorkingDirectory=/home/pi/Matterbridge and User=pi):

You may need to adapt the configuration to your setup:

- execStart on some linux distribution can also be ExecStart==/usr/bin/matterbridge -service

```
[Unit]
Description=matterbridge
After=network-online.target

[Service]
Type=simple
ExecStart=matterbridge -service
WorkingDirectory=/home/<USER>/Matterbridge
StandardOutput=inherit
StandardError=inherit
Restart=always
RestartSec=10s
TimeoutStopSec=30s
User=<USER>

[Install]
WantedBy=multi-user.target
```

If you modify it after, then run:

```
sudo systemctl daemon-reload
```

### Start Matterbridge

```
sudo systemctl start matterbridge
```

### Stop Matterbridge

```
sudo systemctl stop matterbridge
```

### Show Matterbridge status

```
sudo systemctl status matterbridge.service
```

### Enable Matterbridge to start automatically on boot

```
sudo systemctl enable matterbridge.service
```

### Disable Matterbridge from starting automatically on boot

```
sudo systemctl disable matterbridge.service
```

### View the log of Matterbridge in real time (this will show the log with colors)

```
sudo journalctl -u matterbridge.service -f --output cat
```

### Delete the logs older then 3 days (all of them not only the ones of Matterbridge!)

```
sudo journalctl --vacuum-time=3d
```

If you want to make the setting permanent edit
```
sudo nano /etc/systemd/journald.conf
```
add
```
SystemMaxUse=3d
```
save it and run
```
sudo systemctl restart systemd-journald
```

### Verify that with your distro you can run sudo npm install -g matterbridge without the password

If that is not the case run 
```
sudo visudo
```
add this line replacing USER with your user name (e.g. radxa ALL=(ALL) NOPASSWD: ALL)
```
<USER> ALL=(ALL) NOPASSWD: ALL
```
save the file and restart

