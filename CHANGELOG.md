# Changelog

All notable changes to this project will be documented in this file.

## [1.1.7] - 2024-03-14

### Fixed

- [install]: Fixed the install error.

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
