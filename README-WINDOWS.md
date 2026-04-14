# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge Task Scheduler configuration (Windows)

[![npm version](https://img.shields.io/npm/v/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge/latest?label=docker%20version)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge?label=docker%20pulls)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge/actions/workflows/build.yml/badge.svg)
![CodeQL](https://github.com/Luligu/matterbridge/actions/workflows/codeql.yml/badge.svg)
[![codecov](https://codecov.io/gh/Luligu/matterbridge/branch/main/graph/badge.svg)](https://codecov.io/gh/Luligu/matterbridge)
[![styled with prettier](https://img.shields.io/badge/styled_with-Prettier-f8bc45.svg?logo=prettier)](https://prettier.io/)
[![linted with eslint](https://img.shields.io/badge/linted_with-ES_Lint-4B32C3.svg?logo=eslint)](https://eslint.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![ESM](https://img.shields.io/badge/ESM-Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![matterbridge.io](https://img.shields.io/badge/matterbridge.io-online-brightgreen)](https://matterbridge.io)

[![powered by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![powered by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![powered by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---

# Production configuration

## Run matterbridge as a scheduled task with Task Scheduler (Windows)

This is the simplest setup on Windows.

It runs Matterbridge when the current user logs in and uses the standard directories:

- `%USERPROFILE%\Matterbridge`
- `%USERPROFILE%\.matterbridge`
- `%USERPROFILE%\.mattercert`

### Optional: cleanup all previous setups

```powershell
schtasks /delete /tn "Matterbridge" /f
Remove-Item -Recurse -Force "$HOME\Matterbridge", "$HOME\.matterbridge", "$HOME\.mattercert" -ErrorAction SilentlyContinue
npm uninstall -g matterbridge
```

### Verify node setup

> **Nvm is a development tool and is not supported for production**.

```powershell
node -v
npm -v
```

It should output something like:

```
v22.20.0
10.9.3
```

### Check node path

```powershell
where.exe node
```

It should output something like:

```
C:\Program Files\nodejs\node.exe
```

### First create the Matterbridge directories and install matterbridge

This will create the required directories if they don't exist and install matterbridge globally for the current user.

```powershell
New-Item -ItemType Directory -Force -Path "$HOME\Matterbridge", "$HOME\.matterbridge", "$HOME\.mattercert" | Out-Null
npm install -g matterbridge --omit=dev
where.exe matterbridge.cmd
matterbridge --version
```

### Then create a scheduled task for Matterbridge

Run PowerShell as Administrator

```powershell
$NodeExe = (where.exe node | Select-Object -First 1)
$MatterbridgeCmd = (where.exe matterbridge.cmd | Select-Object -First 1)
$MatterbridgeJs = Join-Path (Split-Path $MatterbridgeCmd -Parent) "node_modules\matterbridge\bin\matterbridge.js"
schtasks /create /f /tn "Matterbridge" /sc onlogon /delay 0000:30 /tr "`"$NodeExe`" `"$MatterbridgeJs`" --nosudo"
```

This will start Matterbridge 30 seconds after the current user logs in.

This setup starts Matterbridge once at logon. If Matterbridge exits, it stays stopped until the next logon or until you start it again manually.

You can configure and adapt the task on the Task Scheduler.

### Start Matterbridge

```cmd
schtasks /run /tn "Matterbridge"
```

### Stop Matterbridge

Stop Matterbridge from the frontend.

To force stop use

```cmd
schtasks /end /tn "Matterbridge"
```

### Restart Matterbridge

Stop Matterbridge from the frontend.

```cmd
schtasks /end /tn "Matterbridge"
schtasks /run /tn "Matterbridge"
```

### Show Matterbridge status

```cmd
schtasks /query /tn "Matterbridge" /v /fo list
```

### Show Matterbridge status (only essentials)

```cmd
schtasks /query /tn "Matterbridge" /v /fo list | findstr /I "TaskName Status Last Run Time Last Result"
```

### Enable Matterbridge to start automatically on logon

```cmd
schtasks /change /tn "Matterbridge" /enable
```

### Disable Matterbridge from starting automatically on logon

```cmd
schtasks /change /tn "Matterbridge" /disable
```

### Optional: remove the scheduled task completely

Run PowerShell as Administrator

```cmd
schtasks /delete /tn "Matterbridge" /f
```
