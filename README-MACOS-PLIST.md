# <img src="frontend/public/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge launchctl configuration (macOS)

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

## Run matterbridge as system service with launchctl (macOS) and its own global node_modules directory

### Optional: cleanup all previous setups

```bash
sudo rm -rf ~/Matterbridge
sudo rm -rf ~/.matterbridge
sudo rm -rf ~/.mattercert
sudo rm -rf /usr/local/etc/matterbridge
sudo rm -f /Library/LaunchDaemons/matterbridge.plist
sudo rm -f /var/log/matterbridge.log /var/log/matterbridge.err
sudo npm uninstall matterbridge -g
```

### Verify node setup

```bash
node -v
npm -v
```

It should output something like:

```
v22.20.0
10.9.3
```

### Check node path

```bash
which node
```

It should output something like:

```
/usr/local/bin/node
```

In this case you will need in the step below to replace **_MYNODEPATH_** with /usr/local/bin

### First create the Matterbridge directories

This will create the required directories if they don't exist and install matterbridge in the matterbridge global node_modules directory

```bash
sudo mkdir -p /usr/local/etc/matterbridge
sudo mkdir -p /usr/local/etc/matterbridge/.npm-global
sudo mkdir -p /usr/local/etc/matterbridge/Matterbridge
sudo mkdir -p /usr/local/etc/matterbridge/.matterbridge
sudo mkdir -p /usr/local/etc/matterbridge/.mattercert
sudo chown -R root:wheel /usr/local/etc/matterbridge
sudo chown -R root:wheel /usr/local/etc/matterbridge/.npm-global
sudo chmod -R 755 /usr/local/etc/matterbridge/.npm-global
sudo NPM_CONFIG_PREFIX=/usr/local/etc/matterbridge/.npm-global npm install -g matterbridge --omit=dev
```

### Then create a system launchctl configuration file for Matterbridge

- create a launchctl configuration file for Matterbridge

```bash
sudo nano /Library/LaunchDaemons/matterbridge.plist
```

- add the following to the file, replacing **_MYNODEPATH_** with the path found in the step before:

```
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
        <key>EnvironmentVariables</key>
        <dict>
                <key>PATH</key>
                <string>/usr/local/etc/matterbridge/.npm-global/bin:MYNODEPATH</string>
                <key>NPM_CONFIG_PREFIX</key>
                <string>/usr/local/etc/matterbridge/.npm-global</string>
                <key>HOME</key>
                <string>/var/root</string>
                <key>NODE_PATH</key>
                <string>/usr/local/etc/matterbridge/.npm-global/lib/node_modules</string>
        </dict>
        <key>KeepAlive</key>
        <true/>
        <key>Label</key>
        <string>matterbridge</string>
        <key>ProgramArguments</key>
        <array>
                <string>/usr/local/etc/matterbridge/.npm-global/bin/matterbridge</string>
                <string>--homedir</string>
                <string>/usr/local/etc/matterbridge</string>
                <string>--service</string>
                <string>--nosudo</string>
        </array>
        <key>RunAtLoad</key>
        <true/>
        <key>StandardErrorPath</key>
        <string>/var/log/matterbridge.err</string>
        <key>StandardOutPath</key>
        <string>/var/log/matterbridge.log</string>
        <key>WorkingDirectory</key>
        <string>/usr/local/etc/matterbridge</string>
</dict>
</plist>
```

- stop matterbridge

```bash
sudo launchctl bootout system/matterbridge
```

- check the plist

```bash
sudo chown root:wheel /Library/LaunchDaemons/matterbridge.plist
sudo chmod 644 /Library/LaunchDaemons/matterbridge.plist
sudo plutil -lint /Library/LaunchDaemons/matterbridge.plist
sudo plutil -convert xml1 /Library/LaunchDaemons/matterbridge.plist
```

- bootstrap matterbridge and enable it

```bash
sudo rm -f /var/log/matterbridge.log /var/log/matterbridge.err
sudo launchctl bootstrap system /Library/LaunchDaemons/matterbridge.plist
sudo launchctl enable system/matterbridge
```

### Start Matterbridge

```bash
sudo launchctl kickstart -k system/matterbridge
```

### Stop Matterbridge

```bash
sudo launchctl bootout system/matterbridge
```

### Restart Matterbridge

```bash
sudo launchctl kickstart -k system/matterbridge
```

### Show Matterbridge status

```bash
sudo launchctl print system/matterbridge
```

### Show Matterbridge status (only essentials)

```bash
sudo launchctl print system/matterbridge | grep -E "pid|state"
```

### Enable Matterbridge to start automatically on boot

```bash
sudo launchctl enable system/matterbridge
```

### Disable Matterbridge from starting automatically on boot

```bash
sudo launchctl disable system/matterbridge
```

### View the log of Matterbridge in real time (this will show the log with colors)

```bash
sudo tail -n 1000 -f /var/log/matterbridge.log /var/log/matterbridge.err
```

### Optional: automatically rotate logs (every 5 days or at 100 MB, keep 5 compressed backups)

```bash
sudo tee /etc/newsyslog.d/matterbridge.conf <<'EOF'
/var/log/matterbridge.log  root:wheel 640  5  102400  5  ZC
/var/log/matterbridge.err  root:wheel 640  5  102400  5  ZC
EOF
sudo newsyslog -v
```

### Optional: remove the password prompt for sudo

```bash
sudo EDITOR=nano visudo
```

Add this line at the end of the file (replace USER with your macOS username):

```
USER ALL=(ALL) NOPASSWD: ALL
```

Save and validate syntax:

```bash
sudo visudo -c
```

### Optional: ask for password only each 60 minutes

```bash
sudo EDITOR=nano visudo
```

Add (or edit) this line anywhere in the file:

```
Defaults        timestamp_timeout = 60
```

Save and validate syntax:

```bash
sudo visudo -c
```
