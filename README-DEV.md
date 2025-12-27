# <img src="https://matterbridge.io/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge development

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

# Development

## How to create your plugin

The easiest way is to clone the [Matterbridge Plugin Template](https://github.com/Luligu/matterbridge-plugin-template) that has **Dev Container support for instant development environment** and all tools and extensions (like Node.js, npm, TypeScript, ESLint, Prettier, Jest and Vitest) already loaded and configured.

After you clone it locally, change the name (keep always matterbridge- at the beginning of the name), version, description, author, homepage, repository, bugs and funding in the package.json.

It is also possible to add two custom properties to the package.json: **help** and **changelog** with a url that will be used in the frontend instead of the default (/blob/main/README and /blob/main/CHANGELOG).

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

## Dev containers networking limitations

Dev containers have networking limitations depending on the host OS and Docker setup.

• Docker Desktop on Windows or macOS:

- Runs inside a VM
- Host networking mode is NOT available
- Matterbridge and plugins can run but:
  ❌ Pairing with Matter controllers will NOT work cause of missing mDNS support
  ✅ Remote and local network access (cloud services, internet APIs) works normally
  ✅ Matterbridge frontend works normally

• Native Linux or WSL 2 with Docker Engine CLI integration:

- Host networking IS available
- Full local network access is supported with mDNS
- Matterbridge and plugins work correctly, including pairing
- Matterbridge frontend works normally

## How to pair the plugin

When you want to test your plugin with a paired controller and you cannot use native Linux or WSL 2 with Docker Engine, you have several other options:

- create a tgz (npm run npmPack) and upload it to a running instance of matterbridge.
- publish the plugin with tag dev and install it (matterbridge-yourplugin@dev in Install plugins) in a running instance of matterbridge.
- use a local instance of matterbridge running outside the dev container and install (../matterbridge-yourplugin in Install plugins) or add (../matterbridge-yourplugin in Install plugins) your plugin to it (easiest way). Adjust the path if matterbridge dir and your plugin dir are not in the same parent directory.

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

### constructor(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: PlatformConfig)

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

### getDeviceByName(deviceName: string): MatterbridgeEndpoint | undefined

### getDeviceByUniqueId(uniqueId: string): MatterbridgeEndpoint | undefined

### getDeviceBySerialNumber(serialNumber: string): MatterbridgeEndpoint | undefined

### getDeviceById(id: string): MatterbridgeEndpoint | undefined

### getDeviceByOriginalId(originalId: string): MatterbridgeEndpoint | undefined

### getDeviceByNumber(number: EndpointNumber | number): MatterbridgeEndpoint | undefined

They all return MatterbridgeEndpoint or undefined if not found.

### hasDeviceName(deviceName: string): boolean

### hasDeviceUniqueId(deviceUniqueId: string): boolean

Checks if a device with this name or uniqueId is already registered in the platform.

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
    const device = new MatterbridgeEndpoint([contactSensor, powerSource], { id: 'EntryDoor' })
      .createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer('My entry door', '0123456789')
      .createDefaultBooleanStateClusterServer(true)
      .createDefaultPowerSourceReplaceableBatteryClusterServer(75)
      .addRequiredClusterServers(); // Always better to call it at the end of the chain to add all the not already created but required clusters.
```

In the above example we create a contact sensor device type with also a power source device type feature replaceble battery.

All device types are defined in src\matterbridgeDeviceTypes.ts and taken from the 'Matter-1.4.2-Device-Library-Specification.pdf'.

All default cluster helpers are available as methods of MatterbridgeEndpoint.

## MatterbridgeEndpointOptions

- @param {Semtag[]} [tagList] - The tagList of the endpoint.
- @param {'server' | 'matter'} [mode] - The mode for the endpoint.
- @param {string} [id] - The unique storage key for the endpoint. If not provided, a default key will be used.
- @param {EndpointNumber} [number] - The endpoint number for the endpoint. If not provided, the endpoint will be created with the next available endpoint number.

The mode=`server` property of MatterbridgeEndpointOptions, allows to create an independent (not bridged) Matter device with its server node. In this case the bridge mode is not relevant.

The mode=`matter` property of MatterbridgeEndpointOptions, allows to create a (not bridged) Matter device that is added to the Matterbridge server node alongside the aggregator.

## MatterbridgeEndpoint single class devices

For the device types listed below there are single class provided to createa a fully functional device.

For a working example refer to the 'matterbridge-example-dynamic-platform'.

### Chapter 12. Robotic Device Types - Single class device types

```typescript
const robot = new RoboticVacuumCleaner('Robot Vacuum', 'RVC1238777820', 'server');
```

### Chapter 13. Appliances Device Types - Single class device types

```typescript
const laundryWasher = new LaundryWasher('Laundry Washer', 'LW1234567890');
```

```typescript
const laundryDryer = new LaundryDryer('Laundry Dryer', 'LDW1235227890');
```

```typescript
const dishwasher = new Dishwasher('Dishwasher', 'DW1234567890');
```

```typescript
const extractorHood = new ExtractorHood('Extractor Hood', 'EH1234567893');
```

```typescript
const microwaveOven = new MicrowaveOven('Microwave Oven', 'MO1234567893');
```

The Oven is always a composed device. You create the Oven and add one or more cabinet.

```typescript
const oven = new Oven('Oven', 'OV1234567890');
oven.addCabinet('Upper Cabinet', [{ mfgCode: null, namespaceId: PositionTag.Top.namespaceId, tag: PositionTag.Top.tag, label: PositionTag.Top.label }]);
```

The Cooktop is always a composed device. You create the Cooktop and add one or more surface.

```typescript
const cooktop = new Cooktop('Cooktop', 'CT1234567890');
cooktop.addSurface('Surface Top Left', [
  { mfgCode: null, namespaceId: PositionTag.Top.namespaceId, tag: PositionTag.Top.tag, label: PositionTag.Top.label },
  { mfgCode: null, namespaceId: PositionTag.Left.namespaceId, tag: PositionTag.Left.tag, label: PositionTag.Left.label },
]);
```

The Refrigerator is always a composed device. You create the Refrigerator and add one or more cabinet.

```typescript
const refrigerator = new Refrigerator('Refrigerator', 'RE1234567890');
refrigerator.addCabinet('Refrigerator Top', [
  { mfgCode: null, namespaceId: PositionTag.Top.namespaceId, tag: PositionTag.Top.tag, label: 'Refrigerator Top' },
  { mfgCode: null, namespaceId: RefrigeratorTag.Refrigerator.namespaceId, tag: RefrigeratorTag.Refrigerator.tag, label: RefrigeratorTag.Refrigerator.label },
]);
```

### Chapter 14. Energy Device Types - Single class device types

```typescript
const waterHeater = new WaterHeater('Water Heater', 'WH3456177820');
```

```typescript
const evse = new Evse('Evse', 'EV3456127820');
```

```typescript
const solarPower = new SolarPower('Solar Power', 'SP3456127821');
```

```typescript
const batteryStorage = new BatteryStorage('Battery Storage', 'BS3456127822');
```

```typescript
const heatPump = new HeatPump('Heat Pump', 'HP1234567890');
```

## Plugin config file

Each plugin has a minimal default config file injected by Matterbridge when it is loaded and the plugin doesn't have its own default one:

```typescript
{
  name: plugin.name, // i.e. matterbridge-test
  type: plugin.type, // i.e. AccessoryPlatform or DynamicPlatform (on the first run is AnyPlatform cause it is still unknown)
  version: plugin.version,
  debug: false,
  unregisterOnShutdown: false
}
```

It is possible to add a different default config file to be loaded the first time the user installs the plugin.

Matterbridge (only on the first load of the plugin and if a config file is not already present in the .matterbridge directory) looks for the default config file in the root of the plugin package. The file must be named '[PLUGIN-NAME].config.json' (i.e. 'matterbridge-test.config.json').

In all subsequent loads the config file is loaded from the '.matterbridge' directory.

## Plugin schema file

Each plugin has a minimal default schema file injected by Matterbridge when it is loaded and the plugin doesn't have its own default one:

```typescript
{
  title: plugin.description,
  description: plugin.name + ' v. ' + plugin.version + ' by ' + plugin.author,
  type: 'object',
  properties: {
    name: {
      description: 'Plugin name',
      type: 'string',
      readOnly: true,
    },
    type: {
      description: 'Plugin type',
      type: 'string',
      readOnly: true,
    },
    debug: {
      description: 'Enable the debug for the plugin (development only)',
      type: 'boolean',
      default: false,
    },
    unregisterOnShutdown: {
      description: 'Unregister all devices on shutdown (development only)',
      type: 'boolean',
      default: false,
    },
  },
}
```

It is possible to add a different default schema file.

The schema file is loaded from the root of the plugin package. The file must be named '[PLUGIN-NAME].schema.json' (i.e. 'matterbridge-test.schema.json').

The properties of the schema file shall correspond to the properties of the config file.

# Frequently asked questions

## Why plugins cannot install matterbridge as a dependency, devDependency or peerDependency

There must be one and only one instance of Matterbridge and matter.js in the node_modules directory.

### What happens when matterbridge or matter.js are present like a devDependencies

The plugins can be globally installed in different ways:

- from npm (all devDependencies are installed in node_modules if the plugin is not correctly published)
- from a tarball (all devDependencies are installed in node_modules if the tarball is not correctly built)
- from a local path (devDependencies are always installed in node_modules!)

In all these cases the devDependencies are always installed by npm and show up in the plugins `node_modules`:

- npm install -g ./yourplugin
- npm install -g git+https://github.com/you/yourplugin.git
- npm install -g yourplugin

In the first 2 cases the devDependeincies are always installed in node_modules!

In the last (most dangerous case) they are installed when the user forgets to add --omit=dev or doesn't have NODE_ENV=production.

This is also the reason why to be safe 100% all official plugins are published for production removing also devDependencies from package.json.

I also lock the dependencies with npm shrinkwrap cause npm installs always the latest versions that mach your range in package.json but sometimes this just breaks the plugin. This permits to be sure that the user host machine has exactly the same dependencies you coded your plugin with.

### The technical reason we cannot have matterbridge or @matter in the plugin node_modules.

Module Resolution in Matterbridge Plugin System.
When Matterbridge loads plugins on demand as ESM modules, the module resolution follows Node.js's standard module resolution algorithm. Here's how it works:

**1. Plugin Loading Process**
From the code in pluginManager.ts (lines 628-632), Matterbridge:

Resolves the plugin's main entry point from its package.json
Converts the file path to a URL using pathToFileURL()
Uses dynamic import: await import(pluginUrl.href)

**2. Module Resolution Priority**
When the plugin code runs import statements, Node.js follows this resolution order:

Plugin's local node_modules - Checked first
Parent directories - Walks up the directory tree looking for node_modules
Matterbridge's node_modules - Only reached if not found in plugin's dependencies

**3. Key Behavior**
Plugin's node_modules takes precedence - If a package exists in the plugin's own node_modules, that version will be used.
Matterbridge's node_modules is used as fallback.

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
- Add unit tests for any new or changed functionality if possible cause Matterbridge has a 100% test coverage.
- In your pull request, do describe what your changes do and how they work
