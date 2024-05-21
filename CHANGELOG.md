# Changelog

All notable changes to this project will be documented in this file.

## [1.2.17] - 2024-05-22

### Changed
- [matterbridge]: Preliminary integration for the new matterbridge-shelly plugin

### Added
- [device]: Added new method addClusterServerFromList


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
