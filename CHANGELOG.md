# <img src="https://github.com/Luligu/matterbridge/blob/main/frontend/public/matterbridge%2064x64.png" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge changelog

All notable changes to this project will be documented in this file.

If you like this project and find it useful, please consider giving it a star on GitHub at https://github.com/Luligu/matterbridge and sponsoring it.

## [1.5.0] - 2024-08-24

### Breaking Changes

- [-bridge -childbridge]: You don't need anymore to add the parmeter -bridge or -childbridge on the command line or systemctl or docker command: the default is bridge mode and if no parameter is added, Matterbridge uses the settings from the frontend that are saved.
- [-logger]: You don't need anymore to add the parmeter -logger [level]: the default is info and if no parameter is added, Matterbridge uses the settings from the frontend that are saved.
- [-filelogger]: You don't need anymore to add the parmeter -filelogger: the default is false and if no parameter is added, Matterbridge uses the settings from the frontend that are saved.
- [-matterlogger]: You don't need anymore to add the parmeter -matterlogger [level]: the default is info and if no parameter is added, Matterbridge uses the settings from the frontend that are saved.
- [-matterfilelogger]: You don't need anymore to add the parmeter -matterfilelogger: the default is false and if no parameter is added, Matterbridge uses the settings from the frontend that are saved.

### Added

- [frontend]: Added menu item "Unregister and shutdown".
- [frontend]: Added menu item "Reset commissioning and shutdown".
- [frontend]: Added menu item "Factory reset and shutdown".
- [frontend]: Added menu item "Download plugins config files".

### Changed

- [package]: Update dependencies.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [1.3.12] - 2024-07-10

### Added

### Changed

- [frontend]: The Logs in Home page has the same filter as the Logs page.
- [matterbridge]: The plugins debug is now indipendent from matterbridge debug and matter.js log level. It can be set from the plugin config.

### Fixed

- [frontend]: Fix Home for mobile.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [1.3.9] - 2024-07-02

### Fixed

- [matterbridge]: Fixed nodeLabel in childbridge mode
- [matterbridge]: Fixed MeasurementClusters

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [1.3.8] - 2024-07-01

### Fixed

- [matterbridge]: Fixed crash in childbridge mode

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [1.3.7] - 2024-06-30

### Added

- [matter.js]: Added -mdnsinterface command line parameter to limit the MdnsBroadcaster to a single interface (e.g. matterbridge -bridge -mdnsinterface eth0). Matterbridge will validate the given interface and log a message if the interface is not available and will use all available interfaces.

### Changed

- [dependencies]: Update dependencies.
- [dependencies]: Update eslint to 9.6.0.
- [dependencies]: Update matter.js to 0.9.3.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [1.3.4] - 2024-06-23

### Fixed

- [matterbridge]: Fixed exports

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [1.3.3] - 2024-06-22

### Changed

- [matterbridge]: Updated dependencies
- [matterbridge]: When a plugin is in an error state, the bridge does not start to avoid causing the controllers to delete the registered devices and lose the configuration (e.g. room and automations).

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [1.3.1] - 2024-06-20

### Changed

- [matterbridge]: Updated dependencies
- [matterbridge]: Refactor the loading of schemas, now they load from the plugin directory.
- [matterbridge]: Moved getPluginVersion to the start also for disabled plugins.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [1.2.22] - 2024-06-04

### Changed

- [matterbridge]: Updated dependencies
- [matterbridge]: Default config and schema for the new plugin matterbridge-shelly

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [1.2.21] - 2024-06-04

### Changed

- [matterbridge]: Updated dependencies

### Fixed

- [matterbridge]: Removed error stack from log error for npm get versions
- [matterbridge]: Fixed the error that caused -add plugin to fail at the first run of matterbridge

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [1.2.20] - 2024-06-03

### Changed

- [matter.js]: Update to @project-chip/matter-node.js v. 0.9.1
- [matterbridge]: Updated dependencies

### Fixed

- [matterbridge]: Log level of Plugin already configured is now info

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [1.2.15] - 2024-05-14

### Added

- [frontend]: Added sponsor link in Header.
- [frontend]: Added sponsor link in the plugin list.

### Fixed

- [frontend]: Fixed the case when the latest version of Matterbridge or a plugin is not available.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

## [1.2.14] - 2024-05-09

### Added

- [frontend]: Frontend updated to 0.9.0.
- [frontend]: Added Plugin config editor
- [frontend]: Added tool column to registered plugins with QRCode, Config, Remove and Enable/Disable
- [frontend]: Removed Shutdown button when Matterbridge runs as a service or with docker
- [frontend]: Added Error state to registered plugins

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
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
