# Changelog

All notable changes to this project will be documented in this file.

## [1.1.12] - 2024-03-21

### Added

- [platform]: Added async loadConfig() and async saveConfig() to store plugin config.
- [platform]: Added a config (JSON) property to platforms to store plugin config.

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
