# <img src="frontend/public/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge changelog

All notable changes to this project will be documented in this file.

If you like this project and find it useful, please consider giving it a star on GitHub at https://github.com/Luligu/matterbridge and sponsoring it.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="120">
</a>

## [3.0.2] - 2025-05-??

### Added

- [virtual] Added virtual devices Restart Matterbridge and Update Matterbridge and full Jest tests.
- [virtual] Added virtual devices Reboot Matterbridge for Shelly board and full Jest tests.
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
