# <img src="frontend/public/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge changelog

All notable changes to this project will be documented in this file.

If you like this project and find it useful, please consider giving it a star on GitHub at https://github.com/Luligu/matterbridge and sponsoring it.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="120">
</a>

## Project evolution

The project will evolve to a multi-threaded architecture (the CLI will become the thread manager) with these initial threads:

- matterbridge;
- frontend;
- plugins;
- devices;
- check_updates;
- npm_install;
- all plugins in bridge mode;
- each plugin in childbridge mode;

Advantages:

- real concurrency outside the Node.js main loop;
- isolation between threads;
- individual plugin isolation in childbridge mode;
- ability to update the plugin in childbridge mode without restarting matterbridge;

## [3.3.8] - 2025-11-15

### Development Breaking Changes

This will be the last release with the following long deprecated elements:

- [platform]: Matterbridge instead of PlatformMatterbridge in the platform constructor (deprecated since 3.0.0).
- [endpoint]: uniqueStorageKey instead of id in MatterbridgeEndpointOptions (deprecated since months).
- [endpoint]: endpointId instead of number in MatterbridgeEndpointOptions (deprecated since months).

So please update your plugin.

### Added

- [endpoint]: Added matterbridgeEndpointTypes.
- [devices]: Added tests for device types and their revision changes.
- [clusters]: Added test for clusters and their revision changes.
- [chip]: Added fetch script to download zcl data from connectedhomeip.
- [endpoint]: Added createDefaultPowerSourceBatteryClusterServer(). Add Power Source cluster for a generic battery device.
- [platform]: Added setSchema() to temporarly set the schema for the config editor.
- [platform]: Added getSchema() to retrieve the schema from the Matterbridge plugin manager.
- [platform]: Added return value to registerVirtualDevice().

### Changed

- [package]: Updated dependencies.
- [package]: Bumped jestHelpers v.1.0.12.
- [endpoint]: Changed long deprecated uniqueStorageKey with id in MatterbridgeEndpointOptions.
- [endpoint]: Changed long deprecated endpointId with number in MatterbridgeEndpointOptions.
- [endpoint]: Added property originalId in MatterbridgeEndpoint to store the original id passed in MatterbridgeEndpointOptions (since it can be changed for matter.js storage compatibility).
- [endpoint]: Changed logger level of single device classes.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.3.7] - 2025-11-08

### Breaking Changes

- [frontend]: When a plugin is first added, it will not be anymore started to allow to configure it before restarting.

### Added

- [matterbridge]: Added a first check for plugin existence (docker pull or Hass add-on rebuild) and reinstall it before parsing the plugin. The error messages have been removed.
- [service]: Added [configuration](README-SERVICE-OPT.md) to run matterbridge as a daemon with systemctl (Linux only), private global node_modules, user/group matterbridge and no sudo required.

### Changed

- [package]: Updated dependencies.
- [frontend]: Bumped `frontend` version to 3.3.1.
- [PluginManager]: Bumped `PluginManager` version to 1.3.0.
- [DeviceManager]: Bumped `DeviceManager` version to 1.1.0.
- [frontend]: Readded password dialog when running in Ingress.

### Fixed

- [frontend]: Fixed route fallback and cross platform path failing randomly with node prefix.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.3.6] - 2025-11-01

### Changed

- [package]: Updated dependencies.
- [frontend]: Bumped `frontend` version to 3.3.0.
- [frontend]: Updated dependencies.
- [frontend]: Removed password dialog when running in Ingress.

### Fixed

- [ingress]: Fixed websocket connection from Ingress.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.3.5] - 2025-10-31

### Breaking Changes

- [concentrationMeasurement]: Changed the default unit of measurement of some concentration measurement clusters to adapt to the generally used (and supported by Apple Home). Is is always possible to pass a different unit of measurement (Tvoc is Ugm3. Formaldehyde is Mgm3. Pm1, Pm2.5 and Pm10 are Ugm3. Ozone is Ugm3. Radon is Bqm3.)

### Added

- [thread]: Added get_log_level and set_log_level to BroadcastServer.
- [frontend]: Added password check to WebSocket.
- [service]: Added link to [configuration](README-SERVICE-LOCAL.md) to run matterbridge as a daemon with systemctl (Linux only) and with local global node_modules (no sudo required).

### Changed

- [package]: Updated dependencies.
- [frontend]: Bumped `frontend` version to 3.2.4.

### Fixed

- [service]: Fixed systemd [configuration](README-SERVICE-LOCAL.md) with local global node_modules.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.3.4] - 2025-10-24

### Breaking Changes

- [nodejs]: Matterbridge will not start if the Node.js version is less then 20.x.x.

### Added

- [frontend]: Added debounce to MatterSettings.
- [cli]: Bumped `cli` version to 3.0.0 with backport of Traker and Inspector from thread module.
- [powerSource]: Added MatterbridgePowerSourceServer. It initializes the enpointList of the PowerSource cluster.
- [thread]: Added BroadcastServer to Matterbridge.
- [service]: Added configuration [guide](README-SERVICE-LOCAL.md) to run matterbridge as a daemon with systemctl (Linux only) and with local global node_modules (no sudo required).

### Changed

- [package]: Updated dependencies.
- [package]: Optimized @matter imports.
- [endpoint]: Optimized memory requirements.
- [matter]: Bumped `matter.js` version to 0.15.6. Thanks matter.js!
- [frontend]: Bumped `frontend` version to 3.2.3.
- [thread]: Bumped `BroadcastServer` version to 1.0.1.

### Fixed

- [thrmostat]: Fixed minSetpointDeadBand data type. Thanks Apollon!

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.3.3] - 2025-10-18

### Added

- [thread]: Added timestamp to WorkerMessage.
- [macOS]: Added the [plist configuration guide](README-MACOS-PLIST.md).
- [frontend]: Added download diagnostic and download history to Download menu.
- [frontend]: Added icon to open the cpu and memory usage in System Information panel.
- [thermostat]: Added thermostatRunningState attribute. Thanks Ludovic BOUÉ (https://github.com/Luligu/matterbridge/pull/410).
- [ElectricalPowerMeasurement]: Added createApparentElectricalPowerMeasurementClusterServer cluster helper. Thanks Ludovic BOUÉ (https://github.com/Luligu/matterbridge/pull/411).
- [DeviceEnergyManagementMode]: Added logic to set optOutState. Thanks Ludovic BOUÉ (https://github.com/Luligu/matterbridge-example-dynamic-platform/issues/34).
- [Thermostat]: Added provisional support for setActivePresetRequest. Thanks Ludovic BOUÉ (https://github.com/Luligu/matterbridge-example-dynamic-platform/issues/38).

### Changed

- [package]: Updated dependencies.
- [frontend]: Bumped `frontend` version to 3.2.2.
- [frontend]: Added update check on start.
- [frontend]: Added icon to update dev in the Header and removed the yellow badges.
- [frontend]: Added icon to update plugin latest and dev and removed the yellow badges.
- [frontend]: Added plugin Path in the Name Tooltip.
- [history]: Added external and array buffers to the history chart.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.3.2] - 2025-10-13

### Fixed

- [frontend]: Fixed update to latest.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.3.1] - 2025-10-12

### Breaking Changes

- [frontend]: When a plugin is first installed, it will not be anymore started to allow to configure it before restarting.
- [index]: Removed old plugin api compatibility since it was changed one year ago.

### Added

- [network]: Added getInterfaceDetails() function.
- [network]: Added getInterfaceName() function.
- [network]: Optimized code.
- [matterbridge]: Added SharedMatterbridge readonly type.
- [thread]: Added BroadcastServer to frontend, plugins and devices.
- [cli]: Added cpu and memory history to cli.
- [cli]: Added cpu and memory peaks history to cli.
- [cli]: Added host cpu and process cpu to cli.
- [frontend]: Added process cpu to SystemInformation.
- [frontend]: Added under 'View' menu the item 'Matterbridge diagnostic log'. It shows the complete matter server nodes. The page is static and data are embedded so it can be sent for debug.
- [frontend]: Added under 'View' menu the item 'Matterbridge system history'. It shows the graph page of the last 12h of host cpu, process cpu and memory usage (rss, heap used, heap total with peaks). The page is static and data are embedded so it can be sent for debug.

### Changed

- [package]: Updated dependencies.
- [matterbridge]: Removed matterbridgeInformation. It will be recreated when the frontend requires it.
- [frontend]: Bumped `frontend` version to 3.2.1.
- [frontend]: Refactored InstallProgressDialog.
- [spawn]: Refactored spawnCommand for compatibility with InstallProgressDialog.
- [matter.js]: Bumped `matter.js` to 0.15.5. Thanks matter.js!
- [backend]: Optimized imports.
- [cli]: Bumped `cli` version to 2.1.0.

### Fixed

- [frontend]: Fixed matter log on file not setting correctly.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.3.0] - 2025-10-03

### Development Breaking Changes Notice

- [matterbridge]: Now, internal use only properties are private readonly and internal use only methods are private.
- [platform]: Now, internal use only properties are private readonly and internal use only methods are private.
- [platform]: The signature of the matterbridge param in the platform constructor has changed from Matterbridge to `PlatformMatterbridge` which has only the appropriate readonly properties from matterbridge.

This change, necessary to achieve plugin isolation, will require all plugins to be updated in two steps.

1. `After` matterbridge `3.3.0` is published as latest:

- update the plugin platform constructor with the new signature:

```typescript
  constructor(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: PlatformConfig)
```

- require matterbridge 3.3.0:

```typescript
if (
  this.verifyMatterbridgeVersion === undefined ||
  typeof this.verifyMatterbridgeVersion !== "function" ||
  !this.verifyMatterbridgeVersion("3.3.0")
) {
  throw new Error(
    `This plugin requires Matterbridge version >= "3.3.0". Please update Matterbridge from ${this.matterbridge.matterbridgeVersion} to the latest version."`
  );
}
```

- check that you are not using any matterbridge calls directly (this should not be the case).

In this phase (matterbridge `3.3.x`) all plugins will continue to build and run even without updates.

2. `After` matterbridge `3.4.0` is published as latest, the new signature `PlatformMatterbridge` with the plugin isolation will be effective.

```typescript
export type PlatformMatterbridge = {
  readonly systemInformation: SystemInformation;
  readonly homeDirectory: string;
  readonly rootDirectory: string;
  readonly matterbridgeDirectory: string;
  readonly matterbridgePluginDirectory: string;
  readonly globalModulesDirectory: string;
  readonly matterbridgeVersion: string;
  readonly matterbridgeLatestVersion: string;
  readonly matterbridgeDevVersion: string;
  readonly bridgeMode: "bridge" | "childbridge" | "controller" | "";
  readonly restartMode: "service" | "docker" | "";
  readonly aggregatorVendorId: VendorId;
  readonly aggregatorVendorName: string;
  readonly aggregatorProductId: number;
  readonly aggregatorProductName: string;
};
```

In this phase (matterbridge `3.4.x`) all plugins will not build and will not run without updates.

### Added

- [frontend]: Bumped `frontend` version to 3.2.0.
- [frontend]: Added SystemInfo to Settings.
- [frontend]: Added RvcRunMode to IconView.
- [frontend]: Added tagList to IconView.
- [frontend]: Added prettier, eslint-config-prettier and eslint-plugin-prettier.
- [matterbridge]: Added SmokeCoAlarm to frontend state update.
- [matterbridge]: Added RvcRunMode to frontend state update.
- [matterbridge]: Added RvcCleanMode to frontend state update.
- [matterbridge]: Added RvcOperationalState to frontend state update.
- [matterbridge]: Added ServiceArea to frontend state update.
- [matterbridge]: Added ModeSelect to frontend state update.

### Changed

- [package]: Updated dependencies.
- [frontend]: General improvements and small bug fixes.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.2.9] - 2025-09-27

### Breaking Changes

- [profiles]: Profile management has changed. Now, each profile has its own independent directories under `profiles` with storage, matterstorage, plugin config, and plugin directory. This means that if you are using profiles, Matterbridge will not find the old profile data. The new profile management allows to run multiple instances of matterbridge (change the frontend port and the matter port for each profile) or to simply make a test of a new plugin without modifing your production setup.

### Added

- [frontend]: Bumped `frontend` version to 3.1.0. Now, 100% on typescript and fully typed with the backend.
- [frontend]: Removed legacy `react-table` and created an autonomous component `MbfTable`. Features: unique UI for all tables with integrated column sorting and column selection.
- [frontend]: Use MbfTable for Plugins, Devices, Registered devices and Clusters tables.
- [frontend]: Optimized WebSocker message handlers. Now, the handler targets the component.
- [frontend]: Removed dangerouslySetInnerHTML from log rendering.
- [frontend]: Added push update to Icon view and table view cluster panel. Now, they updates data in real time.
- [frontend]: Added install progress dialog when installing or uploading packages.
- [endpoint]: Added occupancy feature to all Thermostat cluster helpers. When provided (either false or true) it will create a Thermostat with occupancy feature.
- [endpoint]: Added outdoorTemperature to all Thermostat cluster helpers. Default is undefined (it will be ignored).

### Changed

- [matter]: Bumped `matter.js` version to 0.15.4. Thanks matter.js!
- [package]: Updated dependencies.

### Fixed

- [frontend]: Fix default values (devices) for homePageMode (logs/devices) in MatterbridgeSettings.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.2.8] - 2025-09-20

### Added

- [logger]: Set different color for log names to matterbridge, frontend and matter.js.
- [frontend]: Bumped `frontend` version to 3.0.0.
- [frontend]: Bumped `react` version to 19.1.1.
- [frontend]: Bumped `react-router` version to 7.9.1.
- [frontend]: Bumped `@mui` version to 7.3.2.
- [frontend]: Bumped `@rjsf` version to 5.24.13.
- [frontend]: Dropped `Create React App (CRA)` and moved to `Vite`.
- [frontend]: Added `eslint` and `vitest`.
- [frontend]: Typed broadcast messages.
- [frontend]: Typed api request and api response messages.
- [frontend]: Updated the QRCode component to be used in bridge mode and childbridge mode and for the devices with mode='server'. Features: turn on and off pairing mode, resend mDns advertise, remove single fabrics, formatted manual paring code, copy to clipboard the manual pairing code.

### Changed

- [package]: Updated dependencies.

### Fixed

- [childbridge]: Fixed the case when the plugin didn't restart in childbridge mode when it didn't add any device.
- [shutdown]: Fixed the case when shutting down the http(s) server took 10 seconds.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.2.7] - 2025-09-14

### Breaking Changes

- [platform]: Typed PlatformConfig with the default properties: name, type, version, debug and unregisterOnShutdown.
- [platform]: Removed DefaultPlatformConfig interface definition.

### Added

- [jest]: Added Jest helpers module.
- [colorControl]: Added createEnhancedColorControlClusterServer (provisional to run compatibility tests on all controllers).
- [frontend]: Bumped `frontend` version to 2.7.6.
- [frontend]: Added api/view-diagnostic.
- [frontend]: Refactored the QRCode component for device with mode='server' (e.g. the Rvcs): added turn on and off pairing mode, resend mDns advertise, remove single fabrics, formatted manual paring code, copy to clipboard the manual pairing code and is fully web socket based. The main QRCode panel will have the same features (bridge mode and childbridge mode) in the next release.

### Changed

- [package]: Updated dependencies.
- [matterbridge.io]: Updated web site [matterbridge.io](matterbridge.io).

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.2.6] - 2025-09-06

### Added

- [frontend]: Added primary color to QR icon in childbridge mode if the plugin is not paired.
- [frontend]: Added secondary color to QR icon in childbridge mode if the plugin server node is paired but doesn't have at least 1 session and 1 subscription.
- [frontend]: Added color red to QR icon in childbridge mode if the plugin server node is not online.
- [frontend]: Added primary color to QR icon of 'server' mode devices if the device is not paired.
- [frontend]: Added secondary color to QR icon of 'server' mode devices if the device server node is paired but doesn't have at least 1 session and 1 subscription.
- [frontend]: Added color red to QR icon of 'server' mode devices if the device server node is not online.
- [frontend]: Added serialNumber to QR icon of 'server' mode devices.
- [frontend]: Bumped `frontend` version to 2.7.5.
- [childbridge]: Added restart needed when the plugin is first added in childbridge mode.
- [childbridge]: Create the server node for Dynamic plugins even if they have 0 devices. This allow to pair empty plugins in huge setup.
- [select]: Enhanced documentation for Platform setSelectDevice, setSelectDeviceEntity, and setSelectEntity methods with schema examples (see the Jsdoc of the methods).
- [MatterbridgeEndpoint]: Improved documentation in jsdoc.
- [AirConditioner]: Added AirConditioner() class and Jest test. It is not supported correctly by Google. Improved createDefaultThermostatUserInterfaceConfigurationClusterServer().
- [DeviceTypes]: Add Chapter 10. Media Device Types.
- [Speaker]: Added Speaker() class and Jest test. Supported only by SmartThings.
- [mb_mdns]: Added help screen and the ability to filter mDNS packets. Useful to see all paired and commissionable Matter devices on the network.
- [matter.js]: Removed legacy and deprecated calls to Logger.setLogger etc. and use Logger.destinations.

### Changed

- [package]: Updated dependencies.
- [package]: Bumped Jest to v. 30.1.3. (this version finally solves the broken ESM module mock).
- [jest]: Refactor all tests units.

### Fixed

- [jest]: Fixed cli test failing with Jest v. 30.1.3.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.2.5] - 2025-09-02

### Added

- [refrigerator]: Added RefrigeratorAlarm cluster.
- [refrigerator]: Added setDoorOpenState method to set the doorOpen state of RefrigeratorAlarm cluster.
- [refrigerator]: Added triggerDoorOpenState method to trigger the alert for the doorOpen state of RefrigeratorAlarm cluster.
- [frontend]: Bumped `frontend` version to 2.7.4.

### Changed

- [package]: Updated dependencies.
- [devContainer]: Updated devContainer with repository name for the container.

### Fixed

- [refrigerator]: Fixed device type.
- [frontend]: Fixed padding in QRDivDevice (devices in 'server' mode).

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.2.4] - 2025-08-29

### Added

- [platform]: Added clearEntitySelect() to Platform.

### Changed

- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.2.3] - 2025-08-20

### Added

- [Oven]: Added Oven() class and Jest test. It is not supported by the Home app.
- [MicrowaveOven]: Added MicrowaveOven() class and Jest test. It is not supported by the Home app.
- [Cooktop]: Added Cooktop() class and Jest test. It is not supported by the Home app.
- [Refrigerator]: Added Refrigerator() class and Jest test. It is not supported by the Home app.
- [Pages]: Added first draft of https://luligu.github.io/matterbridge.
- [Matter]: Added Matter Specification Version 1.0, 1.1, 1.2, 1.3, 1.4 and 1.4.1 pdf files.
- [Development]: Improved README-DEV.md.

### Changed

- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.2.2] - 2025-08-10

### Changed

- [package]: Updated dependencies.

### Fixed

- [frontend]: Fixed new Matterbridge frontend version message on the Home page.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.2.1] - 2025-08-10

### Added

- [platform]: Added uniqueId validation in registerDevice method. It prevents to register a device if the implementation didn't call createDefaultBasicInformationClusterServer() or createDefaultBridgedDeviceBasicInformationClusterServer().
- [platform]: Added deviceName validation in registerDevice method.
- [platform]: Added serialNumber validation in registerDevice method.
- [endpoint]: Removed static MatterbridgeEndpoint.bridgeMode.
- [endpoint]: Removed BasicInformationServer remap to BridgedDeviceBasicInformationServer in MatterbridgeEndpoint.
- [platform]: Added BasicInformationServer remap to BridgedDeviceBasicInformationServer in MatterbridgePlatform registerDevice method when needed (bridgeMode = `bridge` and platform type = `DynamicPlatform` in `childbridge` mode).
- [frontend]: Bumped `frontend` version to 2.7.3.
- [frontend]: Added frontend version to MatterbridgeInformation. It triggers the page reload message on the Home page when updated.
- [frontend]: Removed the sponsor badge. Added star and sponsor icons buttons.

### Changed

- [package]: Updated dependencies.
- [matter.js]: Bumped `matter.js` to 0.15.3. Thanks matter.js!
- [matter.js]: Bumped `typescript` to 5.9.2.

### Fixed

- [frontend]: Fixed pointer on Discord icon.
- [deepcopy]: Fixed Date test case to use a specific UTC timestamp. It was failing on different timezones.
- [frontend]: Fixed new Matterbridge version message on the Home page.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.2.0] - 2025-08-01

### Breaking Changes

Removed node 18 support.
Please install Node.js 22 LTS.
Don't use Node.js Current but always the Node.js LTS.
Node.js 23, like all odd-numbered versions, is not supported.

### Added

- [update]: Added a Snackbar message for available updates from npm. It differs for latest and dev versions. The update check, as always, is performed at restart (1 minute after) and each 12 hours. It can be triggered manually from the frontend.
- [update]: First steps of update and log important messages from GitHub.
- [build]: Added workflow_dispatch trigger and enhance dependency management in CI.
- [build]: Added macOS 15 to the CI matrix for Node.js builds.
- [frontend]: Bump version 2.7.2.
- [frontend]: Added the plugin name on the QR/Fabrics when in childbridge mode. Changed operational mode to one click only.

### Changed

- [package]: Updated dependencies.
- [matter.js]: Bumped `matter.js` to 0.15.2 (https://github.com/project-chip/matter.js/discussions/2203). Great job matter.js!
- [node.js]: Removed node 18 support.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.1.8] - 2025-07-28

### Added

- [Jest]: Total coverage 100%.
- [certification]: Improved certification management in pairing.json. Added pemToBuffer function for converting PEM strings to Uint8Array.
- [certification]: Improved certification management in pairing.json. Added extractPrivateKeyRaw function for extrating the raw part of PEM private key to Uint8Array.
- [workflow]: Update permissions and change GitHub token for Docker build triggers.
- [update]: Added support for retrieving and logging plugin development versions.
- [frontend]: Improved test units on Frontend class (total coverage 100%).
- [frontend]: Bump version 2.7.1.
- [frontend]: Added Changelog button that appears in the frontend when a new version is installed and the frontend needs to be updated (page refresh).
- [frontend]: Added restart plugin in childbridge mode.
- [frontend]: Added update to stable and update to dev banner. The update to new appears only if you are on the dev and there is a new dev version.
- [frontend]: Added update to stable and update to dev banner for plugins. The update to new dev appears only if you are on the dev and there is a new dev version.
- [frontend]: Added new menu item for manual update check.

### Changed

- [package]: Updated dependencies.

### Fixed

- [switch]: Added conditional handling for momentary switch events in MatterbridgeEndpoint for single press only switches.
- [advertise]: Changed the message advertise stopped to work also in childbridge mode.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.1.7] - 2025-07-25

### Added

- [docker]: Added trigger of Build Docker Image latest from publish.yml.
- [docker]: Added trigger of Build Docker Image dev from publish-dev-daily.yml.
- [docker]: Added on demand trigger for Build Docker Image latest from other plugins workflows.
- [docker]: Added on demand trigger for Build Docker Image dev from other plugins workflows.
- [mdns]: Added bin mb_mdns.
- [coap]: Added bin mb_coap.
- [operationalState]: Improved documentation on createDefaultOperationalStateClusterServer() and added the optional attribute countdownTime. Thanks Ludovic BOUÉ (https://github.com/Luligu/matterbridge/pull/363).
- [momentarySwitch]: Added createDefaultMomentarySwitchClusterServer(). It creates a single click only switch. It is supported by the Home app.
- [fixedLabels]: Improved documentation and added character length check.
- [userLabels]: Improved documentation and added character length check.
- [certification]: Improved certification management in pairing.json with new properties.

### Changed

- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.1.6] - 2025-07-22

### Added

- [reset]: Improved "Reset all devices" command in the frontend. It will shutdown all the plugins and recreate the devices with new state and enpoint numbers even if the device is not selected.
- [enpoint]: Enhanced HEPA and Activated Carbon Filter Monitoring Cluster Server methods with additional features and improved default parameters.
- [enpoint]: Added resetCondition MAtter command for HEPA and Activated Carbon Filter Monitoring Cluster Server.
- [dishwasher]: Added Dishwasher class and Jest test. It is not supported by the Home app.
- [extractorHood]: Added ExtractorHood class and Jest test. It is not supported by the Home app.
- [fan]: Added the createCompleteFanControlClusterServer() cluster helper that create a fan device with all the features. Thanks Ludovic BOUÉ (https://github.com/Luligu/matterbridge/pull/362).
- [docker]: Added logging configuration instructions to [docker setup](README-DOCKER.md).

### Changed

- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.1.5] - 2025-07-19

### Added

- [error]: Added error logging functions and corresponding tests.
- [matterbridge]: Improved test units on Matterbridge class (total coverage 99%).
- [rvc] Add RVC SupportedMaps Attribute from ServiceArea cluster. Thanks Ludovic BOUÉ (https://github.com/Luligu/matterbridge/pull/355).

### Changed

- [matterbridge]: Refactored initialization of DeviceManager and PluginManager.
- [pluginManager]: Refactored PluginManager removing unused install/uninstall methods.
- [pluginManager]: Added loading of default plugin config when a plugin is added the first time. It must be a file in the package root named '[PLUGIN-NAME].config.json'.
- [readme-dev]: Added [documentation](README-DEV.md) for default plugin config and schema files.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.1.4] - 2025-07-16

### Added

- [frontend]: Added support for p12 certificates. Add cert.p12 and cert.pass in the '.matterbridge/cert' directory. If both .p12 and cert.pem are present, only the .p12 will be used. See the README.md for more info.
- [frontend]: Added support for p12 certificates with mTLS: both the server and the client must present the correct certificate. Add the parameter '-mtls'. See the README.md for more info.
- [frontend]: Improved test units on Frontend class (total coverage 98%).

### Changed

- [package]: Updated dependencies.
- [network]: Refactor network logging to improve clarity and update logging format.

### Fixed

- [bin]: Updated matterbridge bin.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.1.3] - 2025-07-14

### Added

- [endpoint]: Improved jsdoc description on endpoint helpers.
- [endpoint]: Added createDefaultMomentarySwitchClusterServer() cluster helper.

### Changed

- [package]: Updated dependencies.
- [vendorId]: Added Shortcut Labs Flic (0x1488).
- [server]: Refactored serverNode event handlers and types.
- [matterbridge]: Removed duplicated properties.

### Fixed

- [shutdown]: Fixed error messages from frontend when Matterbridge is shutting down.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.1.2] - 2025-07-06

### Development Breaking Changes

- [exports]: The single devices (i.e. Rvc, Evse etc...) are only exported from `matterbridge/devices`. Please update your imports to use the new export path. Refer to the [documentation](README-DEV.md) for details on imports.
- [MatterbridgeEndpoint]: Added the mode property: `server` will make the device indipendent from its plugin. It has its own server node: QRCode, Fabrics and Sessions are visible in the Devices section of the Home page. This is a workaround for the Rvc Apple issue. With mode=server the Rvc (like any other device) can be paired directly to the controller like a native not bridged Matter device. Refer to the [documentation](README-DEV.md) for details on using mode.
- [RoboticVacuumCleaner]: The signature of the constructor has changed to add the mode property. Mode `server` will make the device indipendent from its plugin. It has its own server node: QRCode, Fabrics and Sessions are visible in the Devices section of the Home page. This is a workaround for the Rvc Apple issue. With mode=server the Rvc (like any other device) can be paired directly to the controller like a native not bridged Matter device. Refer to the [documentation](README-DEV.md) for details on using mode.

### Added

- [test]: Improved test units on Frontend class (coverage 97%).

### Changed

- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.1.1] - 2025-07-04

### Development Breaking Changes

- [exports]: The single devices (i.e. Rvc, Evse etc...) are only exported from `matterbridge/devices`. Please update your imports to use the new export path. Refer to the [documentation](README-DEV.md) for details on imports.
- [MatterbridgeEndpoint]: Added the mode property: `server` will make the device indipendent from its plugin. It has its own server node: QRCode, Fabrics and Sessions are visible in the Devices section of the Home page. This is a workaround for the Rvc Apple issue. With mode=server the Rvc (like any other device) can be paired directly to the controller like a native not bridged Matter device.

### Added

- [LaundryDryer]: Added LaundryDryer (not supported by the Home app) class and Jest test.
- [DeviceEnergyManagement]: Added MatterbridgeDeviceEnergyManagementServer with power adjustment methods.
- [SolarPower]: Added SolarPower class and Jest test (working on Home Assistant and SmartThings). Thanks Ludovic BOUÉ.
- [BatteryStorage]: Added BatteryStorage class and Jest test (working on Home Assistant and SmartThings). Thanks Ludovic BOUÉ.
- [HeatPump]: Added HeatPump class and Jest test (working on Home Assistant and SmartThings).
- [test]: Improved test units on Frontend class and all Matterbridge classes (coverage 93%).

### Changed

- [package]: Updated dependencies.
- [matter.js]: Bumped `matter.js` to 0.15.1 (https://github.com/project-chip/matter.js/discussions/2220). Great job matter.js!
- [frontend]: Added all esa devices.
- [frontend]: New default values: devices on the home page and icon view on the devices page.
- [imports]: Added dynamic imports to Matterbridge and Frontend classes.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.1.0] - 2025-06-28

### Added

- [DevContainer]: Added support for the [**Matterbridge Dev Container**](https://github.com/Luligu/matterbridge/blob/dev/README-DEV.md#matterbridge-dev-container) with an optimized named volume for `node_modules`.
- [DevContainer]: Added support for the [**Matterbridge Plugin Dev Container**](https://github.com/Luligu/matterbridge/blob/dev/README-DEV.md#matterbridge-plugin-dev-container) with an optimized named volume for `matterbridge` and `node_modules`.
- [GitHub]: Added GitHub issue templates for bug reports and feature requests.
- [Systemd]: Added a systemd service example file for Matterbridge in the systemd directory.
- [ESLint]: Refactored ESLint configuration for TypeScript and improved plugin integration.
- [ESLint]: Added the plugins `eslint-plugin-promise`, `eslint-plugin-jsdoc`, and `@vitest/eslint-plugin`.
- [Vitest]: Added `Vitest` for TypeScript project testing. It will replace Jest, which does not work correctly with ESM module mocks.
- [JSDoc]: Added missing JSDoc comments, including `@param` and `@returns` tags.
- [MatterbridgeEndpoint]: Add MatterbridgeEndpoint mode='server'. It allows to advertise a single device like an autonomous device with its server node to be paired. The device is not bridged (alpha stage).
- [MatterbridgeEndpoint]: Add MatterbridgeEndpoint mode='matter'. It allows to add a single device to the Matterbridge server node next to the aggregator. The device is not bridged (alpha stage).
- [storage]: Improved error handling of corrupted storage.
- [test]: Improved test units on Matterbridge classes (coverage 91%).

### Changed

- [package]: Updated package to Automator v. 2.0.0.
- [package]: Updated dependencies.
- [storage]: Bumped `node-storage-manager` to 2.0.0.
- [logger]: Bumped `node-ansi-logger` to 3.1.1.
- [matter.js]: Bumped `matter.js` to 0.15.0 (https://github.com/project-chip/matter.js/discussions/2203). Great job matter.js!

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.0.7] - 2025-06-21

### Breaking Changes

- [devices]: The single devices (i.e. Rvc, Evse etc...) are exported from matterbridge/devices. Please update your imports to use the new export path. Refer to the [documentation](README-DEV.md) for details on imports.

### Added

- [template]: Added the [Matterbridge Plugin Template](https://github.com/Luligu/matterbridge-plugin-template). It supports Dev Container and Vitest.
- [platform]: Add getDevices() method to retrieve the registered devices in MatterbridgePlatform.

### Changed

- [package]: Updated dependencies.
- [package]: Downgrade jest to 29.7.0.
- [energy]: Added parameter for cumulativeEnergyExported to the helper. For solar power device.
- [platform]: Removed long deprecated methods: validateEntityBlackList and validateDeviceWhiteBlackList. Use validateDevice and validateEntity.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.0.6] - 2025-06-13

### Added

- [tests] Update Jest test coverage on addBridgedEndpoint and removeBridgedEndpoint.
- [fan]: Added createMultiSpeedFanControlClusterServer cluster helper with MultiSpeed feature.
- [fan]: Added all parameters to the fan cluster helpers.
- [valve]: Added logic in MatterbridgeValveConfigurationAndControlServer.
- [command]: Added cluster property to commandHandler data object.
- [mb-service]: Added a link to [mb-service](https://github.com/michaelahern/mb-service) package by [Michael Ahern](https://github.com/michaelahern). It runs matterbridge as a service in macOS.

### Changed

- [package]: Updated dependencies.
- [fan]: The default fan has no more the MultiSpeed feature.
- [behaviors]: Bump Matterbridge Behaviors to 1.3.0
- [evse]: Updated class and behavior to 1.1.0.
- [waterHeater]: Updated class and behavior to 1.1.0.
- [rvc]: Updated class and behavior to 1.1.0.
- [laundryWasher]: Updated class and behavior to 1.1.0.

### Fixed

- [evse]: Fixed jsdoc on Evse.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.0.5] - 2025-06-07

### Added

- [cli]: Added takeHeapSnapshot() and triggerGarbageCollection() for internal testing.
- [LaundryWasher]: Added Evse class and Jest test. Thanks Ludovic BOUÉ.
- [LaundryWasher]: Added LaundryWasher class and Jest test.
- [WaterHeater]: Added WaterHeater class and Jest test. Thanks Ludovic BOUÉ.
- [nginx]: Added new example configurations for [nginx](README-NGINX.md).

### Changed

- [package]: Updated dependencies.
- [matter.js]: Update to 0.14.0-alpha.0-20250528-d6d12ae65.
- [matter.js]: Update to 0.14.0. Great job matter.js!

### Fixed

- [selectAreas]: Fixed MatterbridgeServiceAreaServer.selectAreas.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.0.4] - 2025-05-26

### Added

- [jsdoc]: Improved jsdoc for cluster helpers.
- [cover]: Added createDefaultLiftTiltWindowCoveringClusterServer() that create a window covering cluser with both lift and tilt features (supported by Apple Home).

### Changed

- [legacy]: Removed legacy matter.js EndpointServer and logEndpoint that will be removed in matter.js 0.14.0. For developers: if you need to log the endpoint the call is Logger.get('LogEndpoint').info(endpoint).
- [package]: Updated dependencies.
- [package]: Updated multer package to 2.0.0.

### Fixed

- [virtualDevice]: Fixed possible vulnerability in the length of the nodeLabel.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.0.3] - 2025-05-19

### New plugins

[Dyson robot](https://github.com/thoukydides/matterbridge-dyson-robot)

A Matterbridge plugin that connects Dyson robot vacuums and air treatment devices.
to the Matter smart home ecosystem via their local MQTT APIs.

[Aeg robot](https://github.com/thoukydides/matterbridge-aeg-robot)

AEG RX 9 / Electrolux Pure i9 robot vacuum plugin for Matterbridge.

### Added

- [virtual]: Added virtual devices configuration mode in the Matterbridge Settings: 'Disabled', 'Light', 'Outlet', 'Switch', 'Mounted_switch'. Switch is not supported by Alexa. Mounted Switch is not supported by Apple.
- [deviceTypes]: Added evse, waterHeater, solarPower, batteryStorage and heatPump device type.
- [waterHeater]: Added WaterHeater class to create a Water Heater Device Type in one line of code (thanks https://github.com/lboue).
- [subscribe]: Added a third parameter context (provisional implementation: when "context.offline === true" then this is a change coming from the device).

### Changed

- [package]: Updated dependencies.
- [export]: Removed long deprecated Matter exports from matterbridge. Use matterbridge/matter.
- [matterbridge]: Refactored initialize() and cleanup() methods.
- [matterbridge]: Updated -help informations.
- [rvc]: Added the parameters in the RoboticVacuumCleaner class constructor.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.0.2] - 2025-05-14

### Added

- [virtual] Added virtual devices Restart Matterbridge and Update Matterbridge and full Jest tests (can be disabled adding -novirtual to the command line).
- [virtual] Added virtual devices Reboot Matterbridge for Shelly board and full Jest tests (can be disabled adding -novirtual to the command line).
- [shelly] Refactor shelly api and added full Jest test.

### Changed

- [package]: Updated dependencies.
- [utils]: Refactor utils functions.
- [utils]: Updated Jest tests on utils functions.
- [devices]: Added RoboticVacuumCleaner class to create the Robotic Vacuum Cleaner device type in one line of code.

### Fixed

- [frontend]: Fixed refresh of start/stop sharing.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.0.1] - 2025-05-06

### Added

- [docker]: The builder for the **docker** image with tag **latest** will run each day at 00:00 UTC if there are new releases. Inside the image matterbridge and all plugins with the latest release (as published on npm) are already loaded. You can just pull the new image and matterbridge with all plugins will be updated to the latest.
- [docker]: The builder for the **docker** image with tag **dev** will run each day at 00:00 UTC if there are new commits. Inside the image matterbridge and all plugins with the dev release (as pushed on GitHub) are already loaded. You can just pull the new image and matterbridge with all plugins will be updated to the latest dev. It is possible that the devs are outdated by some published latests.
- [npm]: The dev of matterbridge is published with tag **dev** on **npm** each day at 00:00 UTC if there is a new commit. It is possible that the dev is outdated by a published latest.
- [frontend]: Added closeSnackbarMessage() to remove the notification with timeout = 0.
- [frontend]: Moved all plugin actions from express to web socket.
- [frontend]: Moved all settings from express to web socket.
- [endpoint]: Added OperationalState cluster helper and behavior.
- [behaviors]: Added Jest test on MatterbridgeBehaviors.
- [docker]: Further optimized the dockerfile for the image with tag latest.

### Changed

- [package]: Updated dependencies.
- [docker]: Updated the [Docker configurations](README-DOCKER.md).
- [frontend]: Changing configuration for a plugin now only lock configuration on that plugin.
- [frontend]: Optimized rendering of Devices and Plugins panels.
- [frontend]: Frontend v.2.6.4.

### Fixed

- [BasicInformation]: Fixed vulnerability in BasicInformation and BridgedDeviceBasicInformation cluster initialization attributes.
- [frontend]: Fixed refresh and postfix for select in HomeDevices.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [3.0.0] - 2025-04-29

## Breaking changes

This release brings Matter 1.4.

New device types:

- onOffMountedSwitch: Mounted On/Off Control (an onOff switch without client cluster!).
- dimmableMountedSwitch: Mounted Dimmable Load Control (a dimmer switch without client cluster!).

Modified clusters:

- OccupancySensing cluster.

### Added

- [addEndpoint]: Added an error handler with deep stack on aggregatorNode.add() and serverNode.add() calls.
- [endpoint]: Added createOffOnlyOnOffClusterServer().
- [endpoint]: Added createBaseFanControlClusterServer().
- [endpoint]: Added createDefaultHepaFilterMonitoringClusterServer().
- [endpoint]: Added createDefaultActivatedCarbonFilterMonitoringClusterServer().
- [endpoint]: Added createDefaultThermostatUserInterfaceConfigurationClusterServer().
- [deviceTypes]: Added Robotic device type (please read https://github.com/Luligu/matterbridge/discussions/264).
- [deviceTypes]: Added Appliances device types (please read https://github.com/Luligu/matterbridge/discussions/264).
- [frontend]: Added the matterbridge aggregator serialNumber in the QRDiv.
- [frontend]: Added Power column in the Devices panel of the Home page.
- [frontend]: Added support for appliances and robot in IconView.
- [parameter]: Added getIntArrayParameter and getStringArrayParameter.
- [frontend]: Added the view menu to load the logs directly in the browser.
- [docker]: Optimized the dockerfiles and reduced the image size by 30%.

### Changed

- [package]: Updated package.
- [package]: Updated express to v5.1.0.
- [package]: Updated dependencies.
- [frontend]: Frontend v.2.6.3.
- [frontend]: Changed icons with mdiIcons in IconView.
- [package]: Added tsconfig.jest.json with "isolatedModules": true for ts-jest.
- [deviceTypes]: Updated device types to Matter 1.4.
- [clusters]: Updated cluster helpers to Matter 1.4.
- [matter.js]: Update to 0.13.0-alpha.0-20250405-7fc7db48.
- [matter.js]: Update to 0.13.0-alpha.0-20250408-c916c7e8.
- [matter.js]: Update to 0.13.0-alpha.0-20250412-5fad64e7b.
- [matter.js]: Update to 0.13.0-alpha.0-20250413-d5a27700d.
- [matter.js]: Update to 0.13.0-alpha.0-20250415-475996bb5.
- [matter.js]: Update to 0.13.0-alpha.0-20250418-8cfc0b832.
- [matter.js]: Update to 0.13.0-alpha.0-20250420-9f45e4f77.
- [matter.js]: Update to 0.13.0-alpha.0-20250422-0d27f26be.
- [matter.js]: Update to 0.13.0-alpha.0-20250423-8917d1d1d.
- [matter.js]: Update to 0.13.0-alpha.0-20250424-4760af1f3.
- [matter.js]: Update to 0.13.0-alpha.0-20250425-94b33ff98.
- [matter.js]: Update to 0.13.0-alpha.0-20250427-e7df8aa45.
- [matter.js]: Update to 0.13.0.
- [help]: Updated cli help screen.
- [logger]: Improved frontend logger cleaning.

### Fixed

- [doorLock]: Fixed supportedOperatingModes inverted bitmap (Thanks Apollon).
- [DevicesIcon]: Fixed rendering of leak freeze and rain sensors.
- [QRCode]: Fixed rendering of QRCode panel when advertising stops.
- [matterbridge]: Fixed wrong message when advertising stops and the node has been paired.
- [frontend]: Fixed download logs that broke with express v5.1.0.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.2.9] - 2025-04-18

### Added

- [deviceTypes]: Added extendedColorLight device type.

### Changed

- [package]: Update dependencies.

### Fixed

- [QRCode]: Fixed update when the server node is no more advertising.
- [frontend]: Fixed wrong notification when the server node has been paired.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.2.8] - 2025-04-10

### Added

- [platform]: Added stack to error messages.
- [endpoint]: Added createLevelControlClusterServer()
- [endpoint]: Added createLevelTvocMeasurementClusterServer()
- [frontend]: Added a restart button on the QRCode panel when the advertising for a not paired node is expired.

### Changed

- [package]: Update dependencies.
- [package]: Use node:https.
- [endpoint]: Modified createOnOffClusterServer().

### Fixed

- [homepage]: Fixed warning log for homepage property in package.json.
- [DevicesIcon]: Fixed rendering of rain, freeze and leak sensors.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.2.7] - 2025-04-06

### Added

- [package]: Process author, homepage, repository, funding, README.md and CHANGELOG.md for third-party plugins. If the default implementation doesn't fit, it is possible to add a custom property "help" and "changelog" to the package.json.
- [frontend]: Added a link the plugin homepage (click on the plugin name or on the plugin description).

### Changed

- [frontend]: Frontend v.2.6.1.
- [package]: Update dependencies.

### Fixed

- [author]: Fixed case when author is an object in the package.json.
- [platform]: Fix getSelectDevices and getSelectEntities on node < 22.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.2.6] - 2025-04-01

### Added

- [matterbridge]: New plugin matterbridge-webhooks.
- [ipv4address]: The ipv4address entered by the user on the command line or on the frontend is validated on startup. If the value is not correct an error message is logged and the parameter is discarded.
- [ipv6address]: The ipv6address entered by the user on the command line or on the frontend is validated on startup. If the value is not correct an error message is logged and the parameter is discarded.
- [shelly-board]: For Shelly board only: added Network configuration reset and Factory reset.

### Changed

- [commissionig]: If the bridge is not paired, when the advertising stops (after 15 minutes from start) the QR code is hidden and a notification is displayed.
- [package]: Update dependencies.
- [package]: Update matter.js to 0.12.6.

### Fixed

- [ipv6address]: The ipv6address can be entered in the frontend with the scopeid. On Windows the format is ipv6%scopeid (i.e. fe80::5a71:b2f6:7bc8:d00b%8). On Linux the format is ipv6%interfaceName (i.e. fe80::5a71:b2f6:7bc8:d00b%eth0)
- [onOff]: The onOff cluster created from createOnOffClusterServer() is now correct (no Lighting feature).

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.2.5] - 2025-03-19

### Added

- [frontend]: Frontend v.2.6.0.
- [frontend]: The Devices panel on the Home page selects and unselects using the device serial or device name (it reads the plugin schema).
- [frontend]: Added download of plugins storage to the Download menu.
- [frontend]: Added download of plugins config to the Download menu.
- [frontend]: Added the possibility to show an action button in the config editor.
- [frontend]: Added the possibility to show an action button with input in the config editor.

### Changed

- [package]: Update dependencies.
- [frontend]: The select list panel in the config editor now shows as primary the device name and secondary the device serial.
- [frontend]: Removed @rjsf/mui and use @rjsf/core (this allows to update to the latest react and @mui packages).
- [frontend]: Updated @emotion @fontsource/roboto @mdi @mui @rjsf qrcode.react react-router notistack packages.

### Fixed

- [frontend]: Fixed case where more then one plugin has select in the Home page Devices panel.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.2.4] - 2025-03-10

### Added

- [frontend]: Frontend v.2.5.2.
- [frontend]: Added push updates for reachability in the Home page Devices panel.

### Changed

- [package]: Update dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.2.3] - 2025-03-05

### Added

- [frontend]: Frontend v.2.5.1.

### Changed

- [matterbridge]: Timeout on shelly board.

### Fixed

- [matterbridge]: False error notification on configure plugin.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.2.2] - 2025-03-05

### Added

- [frontend]: Frontend v.2.5.0.
- [frontend]: Added in the Header the primary color for update and restart icons when they are needed.
- [frontend]: Added in the HomeDevices a message when restart is needed and removed the Snackbar.
- [frontend]: Added in Install plugins the possibility to install a plugin from a tarball.

### Changed

- [frontend]: Optimized rendering of the main components.
- [frontend]: The config editor cannot be opened a second time before the restart.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.2.1] - 2025-03-02

### Added

- [frontend]: Frontend v.2.5.0.
- [frontend]: Added in the Settings the option to hide Install plugins and Plugins in the Home page.
- [frontend]: Added in the Settings the option to have Logs or Devices as the bottom panel in the Home page.

### Changed

- [frontend]: Refactor Home page and added HomeDevices and HomePlugins react components.
- [frontend]: Persist in localStorage the Auto scroll setting.
- [frontend]: Added @mdi package for icons.
- [package]: Update matter.js to 0.12.5.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.2.0] - 2025-02-27

### Added

- [docker]: Added health check directly in the docker image. No need to change configuration of docker compose.
- [platform]: Saving in the storage the selects for faster loading of plugins.
- [icon]: Added matterbridge svg icon (thanks: https://github.com/robvanoostenrijk https://github.com/stuntguy3000).
- [pluginManager]: Refactor PluginManager to optimize memory and load time.
- [frontend]: Frontend v.2.4.6. Please refresh the frontend page after the update.
- [frontend]: Added processUptime to SystemInfo.
- [frontend]: Added Share fabrics and Stop sharing to the menu. This allows to pair other controllers without the need to share from the first controller.
- [frontend]: Added subscriptions to QRDiv.
- [frontend]: Added autoScroll option for the logs. Default is enabled.
- [utils]: Optimized memory and loading time.
- [shelly]: Added all shelly api to be used when matterbridge is running on the shelly matterbridge board.

### Changed

- [package]: Update matter.js to 0.12.4
- [matterbridge]: The check for available updates now runs at restart and each 24 hours after.

### Fixed

- [matterbridge]: Check endpoint state in /api/devices.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.1.5] - 2025-02-11

### Added

- [frontend]: Frontend v.2.4.1.
- [frontend]: Optimized rendering of all pages.
- [frontend]: Added cpuUsed, rss and heapUsed to SystemInformation.
- [frontend]: Added UiProvider.
- [frontend]: Added wssSendCpuUpdate, wssSendMemoryUpdate and wssSendSnackbarMessage.
- [docker]: Added health check to docker images. See README-DOCKER.md with the updated configuration.

### Changed

- [matterbridge]: Calls getNpmPackageVersion() instead of npm to get latest version to optimize memory and cpu usage.
- [matterbridge]: Memory optimization on MatterbridgeEndpoint.

### Fixed

- [matterbridge]: Refactor shutdown sequences for reset and factory reset.
- [matterbridge]: Refactor reset devices adding a wait of 1 sec to allow matter to deliver all messages before shutting down.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.1.4] - 2025-02-07

### Added

- [frontend]: Added memorycheck before cleanup.
- [platform]: Added a check for not latin characters.
- [platform]: Added a check for already registered device names.

### Changed

- [package]: Update matter.js to 0.12.3.
- [matter.js]: Since matter.js storage cannot properly encode non latin names, they are encoded before passing them to matter.js.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.1.3] - 2025-02-04

### Added

- [matter.js]: Added temporary solution to prevent serverNode.close() not returning.

### Changed

- [package]: Update dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.1.2] - 2025-02-03

### Added

- [frontend]: Added rss and heap to SystemInformation.
- [memorydump]: Added cpu to memoryDump.
- [memorydump]: Added memoryinterval to memoryDump.
- [memorydump]: Added memorytimeout to memoryDump.

### Fixed

- [frontend]: Fixed update matterbridge.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.1.1] - 2025-02-02

### Fixed

- [matter.js]: Fix close server nodes.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.1.0] - 2025-02-02

### Added

- [matterbridge]: Added MatterbridgeModeSelectServer.
- [matterbridge]: Added MatterbridgeSwitchServer.
- [frontend]: Added api/advertise to turn on matter advertising in bridge mode.
- [frontend]: Frontend v.2.4.0.
- [matterbridge]: Added deep memory scan details.

### Changed

- [package]: Removed legacy imports.
- [package]: Update dependencies.
- [package]: Update matter.js to 0.12.0.
- [package]: Update matter.js to 0.12.1.
- [package]: Update matter.js to 0.12.2.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [2.0.0] - 2025-01-20

### Added

- [behavior]: Added MatterbridgeValveConfigurationAndControlServer behavior with open close command.
- [matterbridge]: Added /memory endpoint for debugging memory use.

### Changed

- [legacy]: Removed MatterbridgeDevice and MatterbridgeEdge classes.
- [factoryreset]: Now it deletes also the backup files and backup directories.
- [mattebridge]: Restyled the Matterbridge class and created the Frontend class that manages the frontend express and websocket api calls.
- [frontend]: Frontend v.2.3.12.
- [iconView]: Improved render for energySensor adding voltage, current and power.
- [iconView]: Improved render for PowerSource adding battery voltage.
- [jest]: Refactor all tests for edge.
- [frontend]: WebSocketProvider added a startTimeout of 300 sec. to start ping.
- [frontend]: WebSocketProvider changed pingIntervalSeconds to 60 sec. and offlineTimeoutSeconds to 50 sec.
- [frontend]: Search on select is no more case sensitive.
- [matterbridge]: Deferred memory intensive tasks after initialization.
- [package]: Optimized all imports from matter.js.
- [package]: Update dependencies.

### Fixed

- [sessions]: Fixed the case when Active session was not reporting correctly.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.7.3] - 2025-01-11

### Added

- [platform]: Added selectDevice list to deviceFeatureBlackList to get the device names from a list in the config editor.

### Changed

- [frontend]: Frontend v.2.3.11
- [package]: Workflows use node 22.x.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.7.2] - 2025-01-11

### Added

- [platform]: Added selectEntity to get the entity names from a list in the config editor.
- [websocket]: Added api /api/select/entities.
- [frontend]: Added the possibility to reorder the items in the config editor lists.
- [frontend]: Added custom error messages for ErrorListTemplate and FieldErrorTemplate in react-jsonschema-form for validation in the config editor.
- [frontend]: Added filter by device name and serial number to Devices page.
- [frontend]: Added Icon view to the Devices page (beta).
- [frontend]: Added the possibility to select the entities/components from a list in the config editor.
- [matterbridge]: Added /health endpoint for watchdog.

### Changed

- [frontend]: Frontend v.2.3.10
- [package]: Update dependencies.

### Fixed

- [edge]: Fixed ValveConfigurationAndControlServer behavior.
- [frontend]: Fixed restart that was not working correctly in Ingress.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.7.1] - 2025-01-07

### Added

- [platform]: Added selectDevice to get the device names from a list in the config editor.
- [websocket]: Added api /api/select.
- [frontend]: Added configUrl to Devices page.
- [frontend]: Added config button to Devices page.
- [frontend]: Added id and deviceTypes to Devices page.

### Changed

- [websocket]: Added params to /api/clusters.
- [frontend]: Frontend v.2.3.3

### Fixed

- [frontend]: Fixed WebSocketProvider online.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.7.0] - 2025-01-04

### Added

- [edge]: Added guide [README-EDGE.md](README-EDGE.md).
- [storage]: Added conversion from old matter storage to the new api format with fabrics, resumptionRecords, network, commissioning, operationalCredentials, acl and parts number. The conversion is triggered every time you shutdown or restart matterbridge till the new storage has been used with matterbridge edge.
- [storage]: Added conversion for child endpoint numbers.
- [storage]: Added conversion for childbridge mode.
- [package]: Update README.md and README-SERVICE.md to include instructions for using SSL on port 443.
- [platform]: Added checkEndpointNumbers() to detect endpoint numbers changes.
- [frontend]: Frontend v.2.3.0
- [frontend]: Added dark and light mode to the frontend. Dark mode is now the default mode. It is possible to change the mode in Settings, Matterbridge settings.
- [frontend]: Custom rfjsreact-jsonschema-form for the config editor.
- [frontend]: Added columns configuration to Devices.
- [frontend]: Added clear logs button in Logs.
- [unregister]: Added unregister for Matterbridge edge.
- [reset]: Added reset for Matterbridge edge.
- [factoryreset]: Added factoryreset for Matterbridge edge.
- [websocket]: Added /api/clusters and removed all fetch calls from frontend.

### Changed

- [edge]: Fixes to edge mode.
- [package]: Update dependencies.

### Fixed

- [frontend]: Fixed device/cluster api that was not working in Ingress.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.6.7] - 2024-12-15

### Breaking Changes

In this release some device types and the OnOff, LevelControl and ColorControl have been updated to be fully compliant with Matter 1.3 specifications.
It is possible that some controllers see them as new devices or need time to read the new clusters. It can be useful after the upgrade to power off the controller, wait a few minutes and power it on again.

### Added

- [readme]: Update README to clarify Node.js installation instructions and emphasize LTS version.
- [deviceTypes]: Add airPurifier definition.
- [deviceTypes]: Add pumpDevice definition.
- [clusters]: Add PumpConfigurationAndControl cluster.
- [clusters]: Add ValveConfigurationAndControl cluster.

### Changed

- [Docker]: Add matterbridge-hass to Dockerfile for latest and main builds.
- [edge]: Various fixes to edge mode.
- [package]: Update dependencies.

### Fixed

- [Device]: Fix addChildDeviceType methods to include debug parameter in MatterbridgeDevice instantiation.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.6.6] - 2024-12-12

### Added

- [frontend]: Added the possibility to install a specific version or the dev of any plugin (i.e. you can install matterbridge-hass@dev or matterbridge-hass@0.0.3).
  It is also possible to use the install plugin to install a specific version of matterbridge (i.e. you can install matterbridge@dev or matterbridge@1.6.5)
- [frontend]: Added the possibility to set the matter discriminator for commissioning (you can always override passing **-discriminator [DISCRIMINATOR]** on the command line).
- [frontend]: Added the possibility to set the matter passcode for commissioning (you can always override passing **-passcode [PASSCODE]** on the command line).
- [frontend]: Added the possibility to set the matter port for commissioning (you can always override passing **-port [PORT]** on the command line).
- [deviceTypes]: Added the device type airConditioner (not supported by the Apple Home).
- [docker]: Added matterbridge-hass to docker dev.
- [platform]: Added validateDeviceWhiteBlackList and validateEntityBlackList to be used consistently by all plugins.
- [/api/devices]: Added productUrl and configUrl.

### Changed

- [package]: Update matter.js to 0.11.9-alpha.0-20241206-22f23333.
- [package]: Update matter.js to 0.11.9-alpha.0-20241207-b604cfa44
- [package]: Update matter.js to 0.11.9-alpha.0-20241209-06a8040e1
- [package]: Update matter.js to 0.11.9
- [plugin]: Removed check on package types since we are moving to production plugins.
- [package]: Set required node version to 18, 20 and 22.
- [package]: Update dependencies.
- [onOff]: Set default to OnOff.Feature.Lighting.
- [levelControl]: Set default to LevelControl.Feature.Lighting.
- [colorControl]: Set default cluster helpers to have ColorTemperature.
- [lightSensor]: Refactor lightSensor removing Group optional cluster server.
- [jest]: Update Jest tests.

### Fixed

- [device]: Fix typos in Device and Endpoint.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.6.5] - 2024-12-02

### Changed

- [matter.js]: Update to matter.js 0.11.8.
- [frontend]: Added matterbridge-hass to the plugin list.
- [package]: Update dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.6.4] - 2024-11-29

### Changed

- [matter.js]: Update to matter.js 0.11.7.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.6.3] - 2024-11-27

### Changed

- [matterbridge]: Changed default minLevel to 0 in LevelControlCluster utility methods.

### Fixed

- [matter.js]: Temporary fix the crash of matter.js on close when using command line parameters.
- [matter.js]: Update to matter.js 0.11.6.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.6.2] - 2024-11-25

### Added

- [matter.js]: Almost completed the phase 2 of migration to edge (matter.js new API).
- [nginx]: Added the route /matterbridge/ to be used with nginx proxy server [README-NGINX.md](README-NGINX.md).
- [config]: Config and schema are loaded before loading the plugin to allow to configure the plugin even when it throws error on load.
- [config]: Added version to the config.
- [frontend]: Added badge "edge" when running in edge mode.
- [matterbridge]: Added addTagList method.
- [matterbridge]: Added minLevel, maxLevel and onLevel to LevelControlCluster utility methods.

### Changed

- [matter.js]: Update to matter.js 0.11.2.
- [matter.js]: Update to matter.js 0.11.3.
- [matter.js]: Update to matter.js 0.11.4.
- [matter.js]: Update to matter.js 0.11.5.
- [matter.js]: Update to the new matter.js packages @matter/main and @mater/nodejs.
- [PluginManager]: On first load the plugin type is AnyPlatform.
- [package]: Update dependencies.
- [frontend]: Update package dependencies.
- [frontend]: Update QRCode package and QRCode level to M.
- [frontend]: Added font roboto.
- [matterbridge]: Removed BasicInformationCluster from Aggregator.

### Fixed

- [energySensor]: Fixed wrong types on ElectricalEnergyMeasurementCluster ElectricalPowerMeasurementCluster.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.6.1] - 2024-11-02

### Added

- [matterbridge]: Added automatic recovery for matterbridge node storage when it gets corrupted for a power outage or hardware failure. Unattended setups can automatically recover restoring the previous automatic backup.
- [matterbridge]: Added automatic recovery for matter storage when it gets corrupted for a power outage or hardware failure. Unattended setups can automatically recover restoring the previous automatic backup.
- [matterbridge]: Added parameter "-norestore" to avoid to restore automatically. In this case you need to manually restore the storages from a full backup made from the frontend.

### Changed

- [loggers]: Logging on file keeps the logger level of the logger (matterbridge and matter logs).
- [matterbridge]: Added more api to WebSocket for the Matterbridge cockpit dashboard (Shelly gateway).
- [package]: Update dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.6.0] - 2024-10-28

### Added

- [matterbridge]: Added WebSocket for the Matetrbridge cockpit dashboard (Shelly gateway).

### Changed

- [discord]: Discord group link: https://discord.gg/QX58CDe6hd.
- [matterbridge]: Completed phase 1 of transition to edge (matter.js new API).
- [matterbridgeDevice]: Refactor Thermostat cluster method to accept minHeatSetpointLimit, maxHeatSetpointLimit, minCoolSetpointLimit and maxCoolSetpointLimit.
- [config]: The plugins config is rewritten only after onStart and no more after onConfigure (after the plugin starts is possible to change the plugins config and it will not be rewritten after the plugin configuration).
- [matterbridgeDevice]: Removed deprecated methods of ColorControl cluster.
- [package]: Removed EveHistory (it will be used only by single plugins).
- [package]: Update dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.5.10] - 2024-10-01

### Changed

- [matterbridge]: Added '--omit=dev' to all install commands to save space and time on low powered devices.
- [matterbridge]: Integrated the DeviceManager class and removed the old array.
- [package]: Update dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.5.9] - 2024-09-23

### Fixed

- [ingress]: Fixed download routes with Ingress from the ha addon. The add-on https://github.com/Luligu/matterbridge-home-assistant-addon has been updated to v. 1.0.4.

### Changed

- [package]: Update matter-node.js to 0.10.6.
- [package]: Update matter-history to 1.1.16.
- [package]: Update dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.5.8] - 2024-09-21

### Added

- [readme]: Added podman guidelines to the README.md
- [readme]: Added instructions for setting permanent journalctl settings in service mode to prevent journal to grow
- [readme]: Added instructions for removing sudo password for npm install in service mode
- [readme]: Refactor systemd instructions for Matterbridge service
- [readme]: Added link to install matterbridge like ha addon https://github.com/Luligu/matterbridge-home-assistant-addon

### Changed

- [package]: Update matter-node.js to 0.10.5.
- [package]: Update matter-history to 1.1.15.
- [package]: Update dependencies.
- [matterbridge]: Reset session informations when the controllers are not connected.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.5.7] - 2024-09-17

### Added

- [matterbridge]: Added the [Official Matterbridge Home Assistant Add-on](https://github.com/Luligu/matterbridge-home-assistant-addon)

### Changed

- [electricalSensor]: Refactor the getDefaultElectricalEnergyMeasurementClusterServer and getDefaultElectricalPowerMeasurementClusterServer
- [package]: Update matter-node.js to 0.10.3.
- [package]: Update matter-history to 1.1.14.
- [package]: Update dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.5.6] - 2024-09-13

### Added

- [matterbridge]: Updated to support ingress (will be released soon in the [Official Matterbridge Home Assistant Add-on](https://github.com/Luligu/matterbridge-home-assistant-addon)).
- [frontend]: Updated to support ingress.

### Changed

- [package]: Updated typescript to 5.6.2.
- [package]: Updated express to 4.21.0.
- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.5.5] - 2024-09-09

### Changed

- [matterbridge]: Changed startMatterInterval from 30 to 60 seconds.
- [package]: Update matter-node.js to 0.10.1.
- [package]: Update matter-history to 1.1.11.
- [package]: Update dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.5.4] - 2024-09-05

### Changed

- [package]: Update dependencies.
- [package]: Final update to matter-node.js 0.10.0.
- [package]: Removed all local matter 1.3 clusters now present in matter.js.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.5.3] - 2024-09-04

### Added

- [frontend]: Added mattermdnsinterface, matteripv4address and matteripv6address to the matter settings. If no parameters are added, Matterbridge will use the settings from the frontend that are saved. The default is all interfaces. If you are facing issues with pairing, I suggest to try first to put the interfaceName (e.g eth0, WiFi) in the MdnsInterface field. When nothing is selected, NodeJs will choose the interface but sometimes the choice is not correct at all.

### Changed

- [package]: Update dependencies.
- [package]: Update matter-node.js to 0.10.0 and removed the Scene cluster to follow matter.js.
- [package]: Update matter-history to 1.1.8.
- [package]: Removed long deprecated exports.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.5.2] - 2024-08-30

### Breaking Changes

- [-bridge -childbridge]: You don't need anymore to add the parmeter -bridge or -childbridge on the command line or systemctl configuration or docker command: the default is bridge mode and if no parameter is added, Matterbridge uses the settings from the frontend that are saved.
- [-logger]: You don't need anymore to add the parmeter -logger [level]: the default is info and if no parameter is added, Matterbridge uses the settings from the frontend that are saved.
- [-filelogger]: You don't need anymore to add the parmeter -filelogger: the default is false and if no parameter is added, Matterbridge uses the settings from the frontend that are saved.
- [-matterlogger]: You don't need anymore to add the parmeter -matterlogger [level]: the default is info and if no parameter is added, Matterbridge uses the settings from the frontend that are saved.
- [-matterfilelogger]: You don't need anymore to add the parmeter -matterfilelogger: the default is false and if no parameter is added, Matterbridge uses the settings from the frontend that are saved.

### Breaking Changes for developers

- please read this [Development guide lines](README-DEV.md)

### Added

- [frontend]: Added a confirmation message for removing and disabling plugins.
- [matterbridge cli]: Added the parameter `-sudo` to force the use of sudo when installing or updating a package (this is useful when the internal logic is not working in your setup).
- [matterbridge cli]: Added the parameter `-nosudo` to force not using sudo when installing or updating a package (this is useful when the internal logic is not working in your setup).

### Changed

- [package]: Update dependencies.
- [spawn]: Modified the install or update function to add more info in the log.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.5.1] - 2024-08-28

### Added

### Changed

- [matterbridgeDevice]: refactor WindowCovering cluster (removed AbsolutePosition).
- [matterbridge]: Removed deprecated methods.
- [package]: Update dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.5.0] - 2024-08-27

### Added

- [frontend]: Added menu item "Update".
- [frontend]: Added menu item "Restart".
- [frontend]: Added menu item "Shutdown".
- [frontend]: Added menu item "Download".
- [frontend]: Added menu item "Backup".
- [frontend]: Added menu item "Unregister all devices" with a confirmation dialog.
- [frontend]: Added menu item "Reset commissioning" with a confirmation dialog.
- [frontend]: Added menu item "Factory reset" with a confirmation dialog.

### Changed

- [package]: Update dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.4.3] - 2024-08-22

### Added

- [frontend]: Added menu with Update, Restart and Shutdown.
- [frontend]: Added menu item Download matterbridge.log.
- [frontend]: Added menu item Download matter.log.
- [frontend]: Added menu item Download matter storage.
- [frontend]: Added menu item Download node storage.
- [frontend]: Added menu item Download plugin storage.
- [frontend]: Added the option to write the logs on file.

### Changed

- [package]: Update dependencies.
- [package]: Update node-ansi-logger to 3.0.0.
- [package]: Update matter-history to 1.1.7.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.4.2] - 2024-08-20

### Added

- [logger]: Integrated matter.js logger in the matterbridge logger.

### Changed

- [package]: Update dependencies.
- [logger]: Update node-ansi-logger to 2.0.8.
- [history]: Update matter-history to 1.1.6.
- [frontend]: Removed duplicated buttons.

### Fixed

- [package]: Fixed dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.4.1] - 2024-07-28

### Added

- [matterbridge]: Added logger levels: debug, info, notice, warn, error, fatal (parameter -logger with default info)

### Changed

- [package]: Update dependencies.
- [logger]: Update node-ansi-logger to 2.0.6.
- [storage]: Update node-persist-manager to 1.0.8.
- [matter]: Update matter.js to 0.9.4.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.4.0] - 2024-07-23

### Added

### Changed

- [package]: Update dependencies.
- [matterbridge]: Added PluginsManager.ts.
- [matterbridge]: Removed timeout on cleanup.
- [matterbridge]: Removed write cache and expired interval for node storage.
- [matterbridge]: Added matterbridgeTypes.ts
- [frontend]: The frontend reconnects to WebSocket when the connection is closed.
- [frontend]: Removed QR button for plugins in error and not enabled.
- [frontend]: The Logs page and the log in the Home page persist till you close or reload the frontend (the last 1000 lines are available).

### Fixed

- [matterbridge]: Fixed utils export

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.3.13] - 2024-07-11

### Added

### Changed

- [frontend]: The Logs window in the Home page has the same filter as the Logs page.
- [matterbridge]: The plugins debug is now indipendent from matterbridge debug and matter.js log level. It can be set from the plugin config.

### Fixed

- [frontend]: Fix Home page for mobile (the page doesn't "jump" anymore with touchscreens).
- [matterbridge]: Fixed npm ignore for exports.
- [matterbridge]: Fixed load plugin when the don't have author and description.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.3.12] - 2024-07-10

### Added

### Changed

- [frontend]: The Logs in Home page has the same filter as the Logs page.
- [matterbridge]: The plugins debug is now indipendent from matterbridge debug and matter.js log level. It can be set from the plugin config.

### Fixed

- [frontend]: Fix Home for mobile.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.3.11] - 2024-07-08

### Added

- [device]: Added addRequiredClusterServers and addOptionalClusterServers methods.
- [frontend]: Added separated settings for the two logging systems (Matterbridge and Matter.js).

### Changed

- [device]: Refactor contructor and loadInstance to accept DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>.
- [frontend]: Update to 1.2.0 (initial optimization for mobile)
- [dependencies]: Update dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.3.10] - 2024-07-05

### Added

- [fabrics]: Added fabricInfo to matterbridge in bridge mode and to the plugins in childbridge mode.
- [sessions]: Added sessionInfo to matterbridge in bridge mode and to the plugins in childbridge mode.
- [frontend]: Added fabricInfo in bridge mode and in childbridge mode instead of QRCode if already paired.
- [frontend]: Added sessionInfo in bridge mode and in childbridge mode instead of QRCode if already paired.
- [matterbridge]: Added parsePlugin to load the updated data from the plugin even when is disabled.
- [matterbridge]: Added an automatic plugin reinstall from npm when the plugin is not found. (e.g. when the docker image is updated and the plugin is not an official plugin)

### Changed

- [dependencies]: Update dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.3.9] - 2024-07-02

### Fixed

- [matterbridge]: Fixed nodeLabel in childbridge mode
- [matterbridge]: Fixed MeasurementClusters

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.3.8] - 2024-07-01

### Fixed

- [matterbridge]: Fixed crash in childbridge mode

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.3.7] - 2024-06-30

### Added

- [matter.js]: Added -mdnsinterface command line parameter to limit the MdnsBroadcaster to a single interface (e.g. matterbridge -bridge -mdnsinterface eth0). Matterbridge will validate the given interface and log a message if the interface is not available and will use all available interfaces.

### Changed

- [dependencies]: Update dependencies.
- [dependencies]: Update eslint to 9.6.0.
- [dependencies]: Update matter.js to 0.9.3.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.3.6] - 2024-06-28

### Changed

- [matterbridge]: Unified the http server port for the frontend and the WebSockerServer.
- [matterbridge]: Unified the https server port for the frontend and the WebSockerServer.
- [certificates]: The certificates for https connections are imported from the directory ~/.matterbridge/certs with these names: cert.pem, key.pem and ca.pem (optional). Use the -ssl command line parameter to activate https for both frontend and WebSocketServer.

### Fixed

- [matterbridge]: Fixed exports
- [matterbridgeDevice]: Fixed ElectricalEnergyMeasurement and ElectricalPowerMeasurement

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.3.5] - 2024-06-26

### Added

- [matterbridgeDevice]: Added createDefaultLatchingSwitchClusterServer and getDefaultLatchingSwitchClusterServer for (https://github.com/Luligu/matterbridge-shelly)
- [frontend]: Added interfaceName

### Changed

- [package]: Updated to eslint 9.5.0 and adopted the flat config
- [package]: Updated to use prettier and jest with the flat config
- [matterbridge]: Updated dependencies
- [matterbridgeDevice]: Updated ColorControl commandHandlers for improved compatibility with (https://github.com/Luligu/matterbridge-shelly)
- [matterbridge]: The "plugin disable" and "plugin remove" methods now also remove the registered devices from the bridge
- [matterbridge]: The "plugin add" method now loads, starts, and configures the plugin

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.3.4] - 2024-06-23

### Fixed

- [matterbridge]: Fixed exports

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.3.3] - 2024-06-22

### Changed

- [matterbridge]: Updated dependencies
- [matterbridge]: When a plugin is in an error state, the bridge does not start to avoid causing the controllers to delete the registered devices and lose the configuration (e.g. room and automations).

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.3.2] - 2024-06-22

New plugin

[shelly](https://github.com/Luligu/matterbridge-shelly)

Matterbridge shelly allows you to expose Shelly Gen 1, Gen 2, and Gen 3 devices to Matter.

Features:

- Shellies are automatically discovered using mDNS.
- Discovered shellies are stored in local storage for quick loading on startup.
- In this first release, the components exposed are lights (with brightness), switches, rollers and power meters (with EveHistory electrical measurements).
- Shellies are controlled locally, eliminating the need for cloud or MQTT (which can be disabled).
- Shelly Gen 1 devices are controlled using the CoIoT protocol (see the note below).
- Shelly Gen 2 and Gen 3 devices are controlled using WebSocket.
- The Matter device takes the name configured in the Shelly device's web page.
- A 10-minute timer checks if the device has reported in that time.

### Added

- [matterbridgeDevice]: Added all clusters for airQualitySensor:
  CarbonMonoxideConcentrationMeasurement,
  CarbonDioxideConcentrationMeasurement,
  NitrogenDioxideConcentrationMeasurement,
  OzoneConcentrationMeasurement,
  FormaldehydeConcentrationMeasurement,
  Pm1ConcentrationMeasurement,
  Pm25ConcentrationMeasurement,
  Pm10ConcentrationMeasurement,
  RadonConcentrationMeasurement,

### Changed

- [matterbridge]: Updated dependencies
- [matter.js]: Updated matter.js to 0.9.2

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.3.1] - 2024-06-20

### Changed

- [matterbridge]: Updated dependencies
- [matterbridge]: Refactor the loading of schemas, now they load from the plugin directory.
- [matterbridge]: Moved getPluginVersion to the start also for disabled plugins.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.3.0] - 2024-06-16

This release is all about Matter 1.3

If you are wondering whether the controllers already support Matter 1.3, the answer is unfortunately no.

SmartThings and Home Automation support:

- airQualitySensor (Matter 1.2)

Home Automation supports (probably only like BooleanState cluster):

- waterFreezeDetector (Matter 1.3)
- waterLeakDetector (Matter 1.3)
- rainSensor (Matter 1.3)

### Changed

- [matterbridge]: Updated dependencies
- [matterbridge]: Default config and schema for the new plugin matterbridge-shelly (will be published after this release)

### Added

- [matterbridgeDevice]: Added waterFreezeDetector, waterLeakDetector, rainSensor, smokeCoAlarm, electricalSensor and deviceEnergyManagement device types as conformance to Matter 1.3
- [matterbridgeDevice]: Added all clusters needed for the above Matter 1.3 device types
- [matterbridgeDevice]: Added FanControl cluster (rev. 2) helper methods for the Fan device type
- [matterbridge]: Added parameter -matterlogger [debug | info | notice | warn | error | fatal] to set the matter.js Logger separately from the Matterbridge log
- [frontend]: Added logger level settings to reflect -matterlogger [debug | info | notice | warn | error | fatal]

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.2.22] - 2024-06-04

### Changed

- [matterbridge]: Updated dependencies
- [matterbridge]: Default config and schema for the new plugin matterbridge-shelly

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.2.21] - 2024-06-04

### Changed

- [matterbridge]: Updated dependencies

### Fixed

- [matterbridge]: Removed error stack from log error for npm get versions
- [matterbridge]: Fixed the error that caused -add plugin to fail at the first run of matterbridge

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.2.20] - 2024-06-03

### Changed

- [matter.js]: Update to @project-chip/matter-node.js v. 0.9.1
- [matterbridge]: Updated dependencies

### Fixed

- [matterbridge]: Log level of Plugin already configured is now info

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.2.19] - 2024-06-01

### Breaking change on Matterbridge start!

Now the plugins load and start before the controller connects.
A special thank to Tamer Salah (https://github.com/tammeryousef1006) for his help testing all controllers.

### Changed

- [matterbridge]: In bridge mode the plugins are loaded and started immediately
- [matterbridge]: In child bridge mode the plugins are loaded and started immediately
- [matterbridge]: Updated dependencies

### Fixed

- [frontend]: Fixed the error badge in the registered plugins window
- [frontend]: Added tooltip to the plugin update badge in the registered plugins window

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.2.18] - 2024-05-28

### Changed

- [matterbridgeDevice]: bridgedNode and powerSource device types as conformance to Matter 1.3

### Fixed

- [matterbridge]: Fixed /api/settings error after resetting commissioning server
- [matterbridge]: Added error message and clean shutdown when WebSocketServer or ExpressServer ports are already in use

### Added

- [frontend]: Added a dropdown menu in Add Remove plugin to select the plugins

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.2.17] - 2024-05-25

### Fixed

- [matterbridge]: Fixed the issue causing the commissioning reset for all fabrics when only one is removed. (Apple uses 2 fabrics: Home app and Key chain).

### Changed

- [matterbridge]: Preliminary integration for the new matterbridge-shelly plugin (still not published)
- [matterbridge]: Updated dependencies
- [matterbridge]: Moved eslint to @typescript-eslint/strict and @typescript-eslint/stylistic

### Added

- [frontend]: Fetch data in Home page every minute
- [device]: Added new method addClusterServerFromList
- [device]: Added ModeSelectClusterServer (only for testing)
- [matterbridge]: Added fabric info in the log on startup
- [matterbridge]: Added vendorId for Alexa

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.2.16] - 2024-05-15

### Changed

- [matter.js]: Update to @project-chip/matter-node.js v. 0.9.0

### Added

- [frontend]: Frontend updated to 1.0.0.
- [frontend]: Added check version interval.
- [frontend]: Added help and version information icons for plugins.
- [frontend]: Added version information for Matterbridge (Click on the version badge).
- [frontend]: Added help badge for Matterbridge.
- [frontend]: Added version information badge for Matterbridge.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.2.15] - 2024-05-14

### Added

- [frontend]: Added sponsor link in Header.
- [frontend]: Added sponsor link in the plugin list.

### Fixed

- [frontend]: Fixed the case when the latest version of Matterbridge or a plugin is not available.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.2.14] - 2024-05-09

### Added

- [frontend]: Frontend updated to 0.9.0.
- [frontend]: Added Plugin config editor
- [frontend]: Added tool column to registered plugins with QRCode, Config, Remove and Enable/Disable
- [frontend]: Removed Shutdown button when Matterbridge runs as a service or with docker
- [frontend]: Added Error state to registered plugins

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.2.13] - 2024-05-05

### Added

- [frontend]: Added plugin version check (you can update from the badge)
- [frontend]: Added tooltip to plugin name showing plugin path
- [matterbridge]: The plugin config file is no more saved on shutdown.
- [matterbridge]: Added plugin version check
- [frontend]: When you install a plugin now it is also added
- [frontend]: Added current and latest release to the badge in the Header section (you can update from the badge)
- [docker]: Added the docker image:dev on the docker hub with architectures: linux/amd64, linux/arm64, linux/arm/v7

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.2.12] - 2024-04-30

### Added

- [frontend]: Added the device child enpoints to the table in the Devices page
- [docker]: Added architectures to the docker image on the docker hub: linux/amd64, linux/arm64
- [frontend]: Frontend updated to 0.8.9.
- [frontend]: Added error in the logger level on the Settings page.
- [frontend]: Added unregister all devices in the Settings page. Matterbridge will shutdown to allow unregistering.
- [frontend]: Added reset in the Settings page. Matterbridge will shutdown to allow the reset.
- [frontend]: Added factoryreset in the Settings page. Matterbridge will shutdown to allow the factoryreset.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="80">
</a>

## [1.2.11] - 2024-04-25

### Added

- [matterbridge]: Added user to system information.
- [frontend]: Persist the filter selection (debug level and search criteria) in the Logs route.
- [frontend]: Added on the header the version and two badges for bridgeMode and restartMode.
- [frontend]: Frontend updated to 0.8.8.
- [docker]: Added support for docker (BETA). The Matterbridge image is published on the docker hub.
- [docker]: See the guidelines on https://github.com/Luligu/matterbridge?tab=readme-ov-file#Run-the-Docker-container-and-start-it.
- [docker compose]: See the guidelines on https://github.com/Luligu/matterbridge?tab=readme-ov-file#Run-with-docker-compose.

### Fixed

- [matterbridge]: Fixed the case when a plugin throws errors.

### New plugin

- Matterbridge Somfy Tahoma https://github.com/Luligu/matterbridge-somfy-tahoma

## [1.2.10] - 2024-04-23

### Added

- [extension]: Finalized implementation of zigbee2MQTT internal extension v. 1.0.0.

## [1.2.9] - 2024-04-19

### Added

- [Matterbridge]: Added call to set reachability at start.

### Added

- [Matterbridge]: Added call to set reachability at start.
- [frontend]: Added filter for log level and search criteria in the Logs page.
- [frontend]: Added colors to the logs in the Home page and in the Logs page.
- [frontend]: Frontend updated to 0.8.7.

### Fixed

- [logs]: Fixed wss for some browser that didn't connect to wss.

## [1.2.8] - 2024-04-16

### Changed

- [matter.js]: Update to @project-chip/matter-node.js v. 0.8.1

### Added

- [frontend]: Added logs in the Home page and in the Log page.
- [frontend]: Frontend got updated to 0.8.6.
- [frontend]: Added log for update and plugin install.
- [extension]: Started implementation of zigbee2MQTT internal extension.

### Fixed

- [spawn]: Fixed under windows.

## [1.2.7] - 2024-04-14

### Changed

- [matterbridge]: The default frontend port is now 8283!.
- [matterbridge.service]: Updated matterbridge.service instructions to fix restart when Matterbridge runs as a daemon with systemctl.

### Added

- [frontend]: Added manual pairing code. Allows to pair Matterbridge without using the phone.
- [MatterbridgeDevice]: Added api to create child endpoints (see matterbridge-example-dynamic-platform).
- [MatterbridgeDevice]: Added FlowMeasurement cluster.

## [1.2.6] - 2024-04-11

### Added

- [matterbridge]: Added -factoryreset parameter to factory reset Matterbridge (see the readme.md for more explanations).
- [matterbridge]: Added -reset parameter to reset the commissioning of Matterbridge (bridge mode).
- [matterbridge]: Added -reset [plugin] parameter to reset the commissioning of a plugin (childbridge mode).
- [matterbridge]: Added -port [port] parameter to set the starting port for the commissioning servers (both bridge and childbridge modes).

### Changed

- [matterbridge.service]: Updated matterbridge.service instructions that fix network start issue with systemctl on Linux.

### Fixed

- [frontend]: Added sudo to the spawned command to execute update and install from frontend (for Linux this may be necessary).
- [childbridge mode]: Fixed a syncronize issue on the start.

## [1.2.5] - 2024-04-08

### Added

- [frontend]: Added update Matterbridge (spawn the command: 'npm -install -g matterbridge'). The console inherit the the spawned process running so you can check.
- [frontend]: Added install plugin (spawn the command: 'npm -install -g plugin-name'). The console inherit the the spawned process running so you can check.
- [frontend]: Added shutdown button.
- [frontend]: Added login with password (default no password). Change the password in the Settings page of frontend.
- [frontend]: Frontend got updated to 0.8.5.
- [Matterbridge]: Added configuration and guidelines in the readme to run Matterbridge like a daemon with systemctl on Linux machine.

## [1.2.4] - 2024-04-01

### Changed

- [matter.js]: Updated the code to matter.js release 0.80.0.

### Added

- [MatterbridgeDevice]: Added DoorLock and Thermostat clusters.

## [1.2.3] - 2024-03-28

### Added

- [Matterbridge]: Enable plugin now start the plugin (no need to restart in bridge mode).
- [Matterbridge]: Disable plugin now shutdown the plugin (no need to restart).

## [1.2.2] - 2024-03-26

### Added

- [MatterbridgeDevice]: Added Cluster DoorLock and command handler.

## [1.2.1] - 2024-03-25

### Added

- [frontend]: Remove plugin from frontend.
- [frontend]: Add plugin from frontend.
- [workflow]: All packages now have a workflow on GitHub.
- [frontend]: Frontend got updated to 0.8.4.

### Fixed

- [frontend]: Fixed the restart needed message.
- [matterbridge]: Fixed the delay of loading from the cli.
- [matterbridge]: Fixed the count of devices removed.

## [1.2.0] - 2024-03-23

### Breaking change on plugin default entry point and platform constructor!

- [plugin default entry point]: export default function initializePlugin(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig)
- [platform constructor]: constructor(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig)

### Added

- [platform]: Added async loadPluginConfig() and async savePluginConfig() to store plugin config.
- [platform]: Added: config: PlatformConfig (JSON) property to platforms to store plugin config.

### Changed

- [dependencies]: Updated dependencies.

## [1.1.11] - 2024-03-19

### Added

- [frontend]: Frontend got updated to 0.8.3.

## [1.1.10] - 2024-03-17

### Added

- [matterbridge]: added unregisterAllDevices() to the platforms
- [matterbridge]: added unregisterDevice(device: MatterbridgeDevice) to the platforms
- [frontend]: Enable and disable plugin are now available. Restart Matteerbridge after.
- [frontend]: Frontend got updated to 0.8.2.

## [1.1.9] - 2024-03-16

### Added

- [frontend]: Selecting a plugin in the home page show the corresponding QR code.
- [frontend]: Settings page now controll the global logger level.
- [frontend]: Restart from the header is available.
- [frontend]: Frontend got updated to 0.8.1.

## [1.1.8] - 2024-03-15

### Added

- [cli]: Resolve the plugin name from absolute or relative path or from globally installed modules (see the help).
- [frontend]: Added some fancy stuff still not visible.

### Fixed

- [install]: Fixed the error caused when the controllers disconnect and connect again.

## [1.1.7] - 2024-03-14

### Fixed

- [install]: Fixed the install error (thanks https://github.com/khaidakin).

## [1.1.6] - 2024-03-14

### Added

- [async]: Plugins are loaded started configured fully asyncronously.
- [frontend]: Added configured button.

## [1.1.5] - 2024-03-12

### Added

- [debug]: Added public property enableDebug to Matterbridge.
- [debug]: Added parameter -debug to the command line.

### Fixed

- [plugin]: Fixed the plugin.paired and plugin.commissioned in bridge mode.
- [routes]: Fixed the plugin devices route.
- [bridge]: Fixed the BasicInformationCluster in bridge mode.

## [1.1.4] - 2024-03-10

### Changed

- [cli]: Updated the loading from cli.

## [1.1.3] - 2024-03-10

### Added

- [onMatterStarted]: onMatterStarted() is called after matter server started.
- [onConfigure]: onConfigure() is called after the platform controller is commissioned.

### Changed

- [dependencies]: Updated dependencies.

### Fixed

- [Plugin route]: Fixed the plugin device route in frontend.

## [1.1.2] - 2024-03-08

### Added

- [async]: All code is asyncronous where it makes sense.
- [JSDoc]: Added JSDoc to the code.

### Removed

- [event]: Removed all event code.

<!-- Commented out section
## [1.1.2] - 2024-03-08

### Added

- [Feature 1]: Description of the feature.
- [Feature 2]: Description of the feature.

### Changed

- [Feature 3]: Description of the change.
- [Feature 4]: Description of the change.

### Deprecated

- [Feature 5]: Description of the deprecation.

### Removed

- [Feature 6]: Description of the removal.

### Fixed

- [Bug 1]: Description of the bug fix.
- [Bug 2]: Description of the bug fix.

### Security

- [Security 1]: Description of the security improvement.
-->
