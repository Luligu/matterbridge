# <img src="frontend/public/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge

[![npm version](https://img.shields.io/npm/v/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge?label=docker%20version&sort=semver)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge.svg)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge/actions/workflows/build.yml/badge.svg)

[![power by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![power by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![power by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---

# Development

## How to create your plugin

The easiest way is to clone the [Matterbridge Plugin Template](https://github.com/Luligu/matterbridge-plugin-template) that has **Dev Container support for instant development environment** and all tools and extensions (like Node.js, npm, TypeScript, ESLint, Prettier, Jest and Vitest) already loaded and configured.

After you clone it locally, change the name (keep always matterbridge- at the beginning of the name), version, description, author, homepage, repository, bugs and funding in the package.json.

It is also possible to add two custom properties to the package.json: **help** and **changelog** with a url that will be used in the frontend instead of the default (/blob/main/README.md and /blob/main/CHANGELOG.md).

Add your plugin logic in module.ts.

The Matterbridge Plugin Template has an already configured Jest / Vitest test unit (with 100% coverage) that you can expand while you add your own plugin logic.

It also has a workflow configured to run on push and pull request that build, lint and test the plugin on node 20, 22 and 24 with ubuntu, macOS and windows.

## Matterbridge Dev Container

Using a Dev Container provides a fully isolated, reproducible, and pre-configured development environment. This ensures that all contributors have the same tools, extensions, and dependencies, eliminating "works on my machine" issues. It also makes onboarding new developers fast and hassle-free, as everything needed is set up automatically.

For improved efficiency, the setup uses named Docker volumes for `node_modules`. This means dependencies are installed only once and persist across container rebuilds, making installs and rebuilds much faster than with bind mounts or ephemeral volumes.

To start the Dev Container, simply open the project folder in [Visual Studio Code](https://code.visualstudio.com/) and, if prompted, click "Reopen in Container". Alternatively, use the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`), search for "Dev Containers: Reopen in Container", and select it. VS Code will automatically build and start the containerized environment for you.

> **Note:** The first time you use the Dev Container, it may take a while to download all the required Docker images and set up the environment. Subsequent starts will be as as fast as from the local folder.

Since Dev Container doesn't run in network mode 'host', it is not possible to pair Mattebridge running inside the Dev Container.

## Matterbridge Plugin Dev Container

Using a Dev Container provides a fully isolated, reproducible, and pre-configured development environment. This ensures that all contributors have the same tools, extensions, and dependencies, eliminating "works on my machine" issues. It also makes onboarding new developers fast and hassle-free, as everything needed is set up automatically.

For improved efficiency, the setup uses named Docker volumes for `matterbridge` and `node_modules`. This means that the dev of matterbridge and the plugin dependencies are installed only once and persist across container rebuilds, making installs and rebuilds much faster than with bind mounts or ephemeral volumes.

To start the Dev Container, simply open the project folder in [Visual Studio Code](https://code.visualstudio.com/) and, if prompted, click "Reopen in Container". Alternatively, use the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`), search for "Dev Containers: Reopen in Container", and select it. VS Code will automatically build and start the containerized environment for you.

> **Note:** The first time you use the Dev Container, it may take a while to download all the required Docker images and set up the environment. Subsequent starts will be as fast as from the local folder.

Since Dev Container doesn't run in network mode 'host', it is not possible to pair Mattebridge running inside the Dev Container.

## Guidelines on imports/exports

Matterbridge exports from:

### "matterbridge"

- Matterbridge and all Matterbridge related classes.

### "matterbridge/devices"

- All single device classes like the Rvc, LaundryWasher, etc...

### "matterbridge/clusters"

- All clusters not present in matter.js or modified.

### "matterbridge/utils"

- All general utils and colorUtils functions.

### "matterbridge/logger"

- AnsiLogger class.

### "matterbridge/storage"

- NodeStorageManager and NodeStorage classes.

### "matterbridge/matter"

- All relevant matter.js exports.

### "matterbridge/matter/behaviors"

- All matter.js behaviors.

### "matterbridge/matter/clusters"

- All matter.js clusters.

### "matterbridge/matter/devices"

- All matter.js devices.

### "matterbridge/matter/endpoints"

- All matter.js endpoints.

### "matterbridge/matter/types"

- All matter.js types.

### \***\*\*\*\*\*** WARNING \***\*\*\*\*\***

A plugin must never install or import from `@matter` or `@project-chip` directly (neither as a dependency, devDependency, nor peerDependency), as this leads to a second instance of `matter.js`, causing instability and unpredictable errors such as "The only instance is Endpoint".

Additionally, when Matterbridge updates the `matter.js` version, it should be consistent across all plugins.

### \***\*\*\*\*\*** WARNING \***\*\*\*\*\***

A plugin must never install Matterbridge (neither as a dependency, devDependency, nor peerDependency).

Matterbridge must be linked to the plugin in development only. At runtime the plugin is loaded directly from the running Mattebridge instance.

```json
"scripts": {
    '''
    "dev:link": "npm link matterbridge",
    '''
}
```

If you don't use Dev Container from the Matterbridge Plugin Template, on the host you use for the development of your plugin, you need to clone matterbridge, built it locally and link it globally (npm link from the matterbridge package root).

```bash
git clone https://github.com/Luligu/matterbridge.git
cd matterbridge
npm install
npm run build
npm link
```

If you want to develop a plugin using the dev branch of matterbridge (I suggest you do it).

```bash
git clone -b dev https://github.com/Luligu/matterbridge.git
cd matterbridge
npm install
npm run build
npm link
```

Always keep your local instance of matterbridge up to date.

### WARNING \***\*\*\*\*\***

Some error messages are logged on start when a plugin has wrong imports or configurations and the plugin will be disabled to prevent instability and crashes.

## How to install and register a plugin for development (from github)

To install i.e. https://github.com/Luligu/matterbridge-example-accessory-platform

On windows:

```powershell
cd $HOME\Matterbridge
```

On linux or macOS:

```bash
cd ~/Matterbridge
```

then clone the plugin

```bash
git clone https://github.com/Luligu/matterbridge-example-accessory-platform
cd matterbridge-example-accessory-platform
npm install
npm link matterbridge
npm run build
```

then add the plugin to Matterbridge

```bash
matterbridge -add .
```

## MatterbridgeDynamicPlatform and MatterbridgeAccessoryPlatform api

### public name: string

The plugin name.

### public type: string

The plugin platform type.

### public config: object

The plugin config (loaded before the platform constructor is called and saved after onShutdown() is called).
Here you can store your plugin configuration (see matterbridge-zigbee2mqtt for example)

### constructor(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig)

The contructor is called when is plugin is loaded.

### async onStart(reason?: string)

The method onStart() is where you have to create your MatterbridgeEndpoint and add all needed clusters.

After add the command handlers and subscribe to the attributes when needed.

The MatterbridgeEndpoint class has the create cluster methods already done and all command handlers needed (see plugin examples).

The method is called when Matterbridge load the plugin.

### async onConfigure()

The method onConfigure() is where you can configure your matter device.

The method is called when the server node the platform belongs to is online.

Since the persistent attributes are loaded from the storage when the server node goes online, you may need to set them in onConfigure().

### async onShutdown(reason?: string)

The method onShutdown() is where you have to stop your platform and cleanup all the used resources.

The method is called when Matterbridge is shutting down or when the plugin is disabled.

Since the frontend can enable and disable the plugin many times, you need to clean all resources (i.e. handlers, intervals, timers...) here.

### async onChangeLoggerLevel(logLevel: LogLevel)

It is called when the user changes the logger level in the frontend.

### async onAction(action: string, value?: string, id?: string, formData?: PlatformConfig)

It is called when a plugin config includes an action button or an action button with text field.

### async onConfigChanged(config: PlatformConfig)

It is called when the plugin config has been updated.

### getDevices(): MatterbridgeEndpoint[]

Retrieves the devices registered with the platform.

### hasDeviceName(deviceName: string): boolean

Checks if a device with this name is already registered in the platform.

### async registerDevice(device: MatterbridgeEndpoint)

After you have created your device, add it to the platform.

### async unregisterDevice(device: MatterbridgeEndpoint)

You can unregister a device.

### async unregisterAllDevices()

You can unregister all the devices you added.

It can be useful to call this method from onShutdown() if you don't want to keep all the devices during development.

## MatterbridgeEndpoint api

You create a Matter device with a new instance of MatterbridgeEndpoint(definition: DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>, options: MatterbridgeEndpointOptions = {}, debug: boolean = false).

- @param {DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>} definition - The DeviceTypeDefinition(s) of the endpoint.
- @param {MatterbridgeEndpointOptions} [options] - The options for the device.
- @param {boolean} [debug] - Debug flag.

```typescript
    const device = new MatterbridgeEndpoint([contactSensor, powerSource], { uniqueStorageKey: 'Eve door', mode: 'matter' }, this.config.debug as boolean)
      .createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer('My contact sensor', '0123456789')
      .createDefaultBooleanStateClusterServer(true)
      .createDefaultPowerSourceReplaceableBatteryClusterServer(75)
      .addRequiredClusterServers(); // Always better to call it at the end of the chain to add all the not already created but required clusters.
```

In the above example we create a contact sensor device type with also a power source device type feature replaceble battery.

All device types are defined in src\matterbridgeDeviceTypes.ts and taken from the 'Matter-1.4-Device-Library-Specification.pdf'.

All default cluster helpers are available as methods of MatterbridgeEndpoint.

# Contribution Guidelines

Thank you for your interest in contributing to my project!

I warmly welcome contributions to this project! Whether it's reporting bugs, proposing new features, updating documentation, or writing code, your help is greatly appreciated.

## Getting Started

- Fork this repository to your own GitHub account and clone it to your local device.
- Make the necessary changes and test them out
- Commit your changes and push to your forked repository

## Submitting Changes

- Create a new pull request against the dev from my repository and I'll be glad to check it out
- Be sure to follow the existing code style
- Add unit tests for any new or changed functionality if possible
- In your pull request, do describe what your changes do and how they work
