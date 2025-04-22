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

## Guidelines on imports/exports

Matterbridge exports from:

"matterbridge"

- Matterbridge and all Matterbridge related classes.

"matterbridge/matter"

- All relevant matter.js exports.

"matterbridge/matter/behaviors"

- All matter.js behaviors.

"matterbridge/matter/clusters"

- All matter.js clusters.

"matterbridge/matter/devices"

- All matter.js devices.

"matterbridge/matter/endpoints"

- All matter.js endpoints.

"matterbridge/matter/types"

- All matter.js types.

"matterbridge/cluster"

- All clusters not present in matter.js or modified.

"matterbridge/utils"

- All general utils and colorUtils functions.

"matterbridge/logger"

- AnsiLogger class.

"matterbridge/storage"

- NodeStorageManager and NodeStorage classes.

# \***\*\*\*\*\***

A plugin must never install or import from `@matter` or `@project-chip` directly (neither as a dependency, devDependency, nor peerDependency), as this leads to a second instance of `matter.js`, causing instability and unpredictable errors such as "The only instance is Endpoint".

Additionally, when Matterbridge updates the `matter.js` version, it should be consistent across all plugins.

# \***\*\*\*\*\***

A plugin must never install Matterbridge (neither as a dependency, devDependency, nor peerDependency).

Matterbridge must be linked to the plugin in development only.

```json
"scripts": {
    '''
    "dev:link": "npm link matterbridge",
    '''
}
```

On the machine you use for development you should also have matterbridge installed globally or built locally and linked (npm link from the package root).

Dev and edge branches of matterbridge are not suitable for developemnt cause they are published for production without types. If you want to develop a plugin using the dev or edge branch of matterbridge, you have to clone the dev or edge branch of matterbridge, build locally and link (npm run deepCleanBuild).

# \***\*\*\*\*\***

I added some error messages when a plugin has wrong imports or configurations and the plugin will be disabled to prevent instability and crashes.

## How to create your plugin

The easiest way is to clone:

- https://github.com/Luligu/matterbridge-example-accessory-platform if you want to create an Accessory Platform Plugin.

- https://github.com/Luligu/matterbridge-example-dynamic-platform if you want to create a Dynamic Platform Plugin.

Then change the name (keep matterbridge- at the beginning of the name), version, description, author and funding in the package.json.

It is possible to add these custom properties to the package.json: help and changelog with a url that will be used in the frontend instead of the default (/blob/main/README.md and /blob/main/CHANGELOG.md).

Add your plugin logic in platform.ts.

## How to install and register a plugin for development (from github)

To install i.e. https://github.com/Luligu/matterbridge-example-accessory-platform

On windows:

```
cd $HOME\Matterbridge
```

On linux:

```
cd ~/Matterbridge
```

then clone the plugin

```
git clone https://github.com/Luligu/matterbridge-example-accessory-platform
cd matterbridge-example-accessory-platform
npm install
npm run build
```

then add the plugin to Matterbridge

```
matterbridge -add .\
```

## MatterbridgeDynamicPlatform and MatterbridgeAccessoryPlatform api

### public name: string

The plugin name.

### public type: string

The plugin platform type.

### public config: object

The plugin config (loaded before the platform constructor is called and saved after onShutdown() is called).
Here you can store your plugin configuration (see matterbridge-zigbee2mqtt for example)

### async onStart(reason?: string)

The method onStart() is where you have to create your MatterbridgeDevice and add all needed clusters and command handlers.

The MatterbridgeDevice class has the create cluster methods already done and all command handlers needed (see plugin examples).

The method is called when Matterbridge load the plugin.

### async onConfigure()

The method onConfigure() is where you can configure or initialize your device.

The method is called when the platform is commissioned.

### async onShutdown(reason?: string)

The method onShutdown() is where you have to eventually cleanup some resources.

The method is called when Matterbridge is shutting down.

### async registerDevice(device: MatterbridgeDevice)

After you created your device, add it to the platform.

### async unregisterDevice(device: MatterbridgeDevice)

You can unregister one or more device.

### async unregisterAllDevices()

You can unregister all devices you added.

It can be useful to call this method from onShutdown() if you don't want to keep all the devices during development.

## MatterbridgeDevice api

Work in progress...

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
