# <img src="frontend/public/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge systemd configuration with private global node_modules

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

## Run matterbridge as a daemon with systemctl (Linux only) with user matterbridge and private global node_modules

The advantage of this setup is that the global node_modules are private for matterbridge and sudo is not required.

The service runs with group and user matterbridge and the system has full protection.

The storage position is **not compatible** with the traditional setup (~/Matterbridge ~/.matterbridge ~/.mattercert).

### 1 - Create the matterbridge user and group

```bash
# ✅ Create the matterbridge group
sudo groupadd --system matterbridge 2>/dev/null || true
# ✅ Create the matterbridge user
sudo useradd  --system \
  --home-dir /opt/matterbridge \
  --shell /usr/sbin/nologin \
  --gid matterbridge \
  matterbridge 2>/dev/null || true
```

### 2 - Create the Matterbridge directories and set the correct permissions

This will create the required directories if they don't exist

```bash
cd ~
# ✅ Safe precaution if matterbridge was already running with the traditional setup
sudo systemctl stop matterbridge 2>/dev/null || true
# ✅ Safe precaution we need to uninstall from the global node_modules
sudo npm uninstall matterbridge -g 2>/dev/null || true
# ✅ Creates all required directories
sudo mkdir -p /opt/matterbridge /opt/matterbridge/Matterbridge /opt/matterbridge/.matterbridge /opt/matterbridge/.mattercert /opt/matterbridge/.npm-global
# ✅ Ensures ownership
sudo chown -R matterbridge:matterbridge /opt/matterbridge /opt/matterbridge/Matterbridge /opt/matterbridge/.matterbridge /opt/matterbridge/.mattercert /opt/matterbridge/.npm-global
# ✅ Secure permissions
sudo chmod -R 755 /opt/matterbridge /opt/matterbridge/Matterbridge /opt/matterbridge/.matterbridge /opt/matterbridge/.mattercert /opt/matterbridge/.npm-global
# make sure the “bin” dir exists for global executables
sudo -u matterbridge mkdir -p /opt/matterbridge/.npm-global/bin
# ✅ Install matterbridge in the private global node_modules
sudo -u matterbridge NPM_CONFIG_PREFIX=/opt/matterbridge/.npm-global npm install matterbridge --omit=dev --verbose --global
# ✅ Create a link to matterbridge bins
sudo ln -sf /opt/matterbridge/.npm-global/bin/matterbridge /usr/bin/matterbridge
sudo ln -sf /opt/matterbridge/.npm-global/bin/mb_mdns /usr/bin/mb_mdns
sudo ln -sf /opt/matterbridge/.npm-global/bin/mb_coap /usr/bin/mb_coap
# ✅ Clear bash command cache as a precaution
hash -r
# ✅ Check if matterbridge is /usr/bin/matterbridge
which matterbridge
# ✅ Will output the matterbridge version
matterbridge --version
```

The storage position is **not compatible** with the traditional setup (~/Matterbridge ~/.matterbridge ~/.mattercert).

If you are migrating from the traditional service setup, before removing the old diretories, you may want to copy the contents of ~/Matterbridge ~/.matterbridge ~/.mattercert to the new directories /opt/matterbridge/Matterbridge /opt/matterbridge/.matterbridge /opt/matterbridge/.mattercert.

Copy the old diretories content

```bash
sudo cp -a ~/Matterbridge/. /opt/matterbridge/Matterbridge/
sudo cp -a ~/.matterbridge/. /opt/matterbridge/.matterbridge/
sudo cp -a ~/.mattercert/. /opt/matterbridge/.mattercert/
```

Remove the old diretories

```bash
sudo rm -rf ~/Matterbridge ~/.matterbridge ~/.mattercert ~/.npm-global
```

### 3 - Create a systemctl configuration file for Matterbridge

Create a systemctl configuration file for Matterbridge

```bash
sudo nano /etc/systemd/system/matterbridge.service
```

Add the following to this file:

```
[Unit]
Description=matterbridge
After=network.target
Wants=network.target

[Service]
Type=simple
Environment=NODE_ENV=production
Environment="NPM_CONFIG_PREFIX=/opt/matterbridge/.npm-global"
ExecStart=matterbridge --service --nosudo
WorkingDirectory=/opt/matterbridge/Matterbridge
StandardOutput=inherit
StandardError=inherit
Restart=always
User=matterbridge
Group=matterbridge
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/opt/matterbridge

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
sudo systemctl status matterbridge
```

### Enable Matterbridge to start automatically on boot

```bash
sudo systemctl enable matterbridge
```

### Disable Matterbridge from starting automatically on boot

```bash
sudo systemctl disable matterbridge
```

### View the log of Matterbridge in real time (this will show the log with colors)

```bash
sudo journalctl -u matterbridge -n 1000 -f --output cat
```
