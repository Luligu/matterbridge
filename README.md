# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge

[![npm version](https://img.shields.io/npm/v/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge/latest?label=docker%20version)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge?label=docker%20pulls)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge/actions/workflows/build.yml/badge.svg)
![CodeQL](https://github.com/Luligu/matterbridge/actions/workflows/codeql.yml/badge.svg)
[![codecov](https://codecov.io/gh/Luligu/matterbridge/branch/main/graph/badge.svg)](https://codecov.io/gh/Luligu/matterbridge)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

[![power by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![power by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![power by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---

[Matterbridge](https://matterbridge.io) is a Matter plugin manager.

It allows you to have all your Matter devices up and running in a couple of minutes without having to deal with the pairing process for each individual device.

Developers can focus solely on device development by extending the provided classes.

Simply pair Matterbridge once, and it will load all your registered plugins.

This project aims to enable porting Homebridge plugins to Matterbridge plugins without having to recode everything ([Development](README-DEV.md)).

The easiest way to start create a new plugin is to clone the [Matterbridge Plugin Template](https://github.com/Luligu/matterbridge-plugin-template) which has **Dev Container support for instant development environment** and all tools and extensions (like Node.js, npm, TypeScript, ESLint, Prettier, Jest and Vitest) already loaded and configured.

Matterbridge creates a [Matter device](https://csa-iot.org/all-solutions/matter/) that can be paired with any ecosystem, such as Apple Home, Google Home, Amazon Alexa, Home Assistant, or any other platform supporting Matter.

You don't need a hub or a dedicated new machine.

No complex setup: just copy paste the installation scripts (available for Docker, Nginx, Linux systemctl and macOS launchctl).

Matterbridge is lightweight and also runs on slow Linux machines with as little as 512MB of memory.

It runs perfectly on Linux, macOS and Windows.

If you like this project and find it useful, please consider giving it a star on [GitHub](https://github.com/Luligu/matterbridge) and sponsoring it.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="120"></a>

## Acknowledgements

The project is build on top of [matter.js](https://github.com/project-chip/matter.js).

A special thanks to Apollon77 for his incredible work.

## Discord

Join us in the Matterbridge [Discord group](https://discord.gg/QX58CDe6hd) created by [Tamer](https://github.com/tammeryousef1006).

## Videos

https://www.youtube.com/watch?v=goNB9Cgh_Fk

https://www.youtube.com/watch?v=06zzl7o_IqQ

## Reviews

https://www.matteralpha.com/how-to/how-to-configure-an-open-source-matter-bridge-at-home

## Press

https://matter-smarthome.de/en/interview/an-alternative-to-the-official-matter-sdk/

https://blog.adafruit.com/2025/11/03/matterbridge-a-matter-plugin-manager/

## Prerequisites

To run Matterbridge, you need either a [Node.js](https://nodejs.org/en) environment or [Docker](https://docs.docker.com/get-started/get-docker/) installed on your system.

If you don't have Node.js already installed, please use this method to install it on a Debian system: https://github.com/nodesource/distributions.

The supported versions of Node.js are 20, 22, and 24. Please **install Node.js 24 LTS**. Don't use Node.js Current; always use the Node.js LTS releases.

Node.js 25, like all odd-numbered versions, is not supported.

To verify which Node.js version is currently LTS (Active), check [Node.js Releases](https://nodejs.org/en/about/previous-releases).

**Nvm is not a good choice and should not be used for production**.

If you don't have Docker already installed, please use this method to install it on a Debian system: https://docs.docker.com/engine/install.

If you don't have Docker already installed, please use this method to install it on Windows or macOS: https://docs.docker.com/get-started/introduction/get-docker-desktop/.

After that, follow the guidelines for the [Docker configurations](README-DOCKER.md).

I suggest using Docker for its simplicity.

Since Matter is designed as "a universal IPv6-based communication protocol for smart home devices" (per the Matter specifications), **IPv6 must be enabled on your local network (LAN)**.

**Important:** You only need IPv6 on your local network - it doesn't matter if your internet provider doesn't provide IPv6 on the internet side (WAN).

Avoid VLANs, VMs, and firewalls that block communication between the controllers and Matterbridge.

To pair Matterbridge, you need a Matter-enabled controller (Apple Home, SmartThings, Google Home, Alexa, Home Assistant, etc.).

## Installation

Follow these steps to install Matterbridge:

```bash
npm install -g matterbridge --omit=dev
```

on Linux or macOS you may need the necessary permissions:

```bash
sudo npm install -g matterbridge --omit=dev
```

Test the installation with:

```bash
matterbridge
```

Now it is possible to open the frontend at the link provided in the log (e.g. `http://MATTERBRIDGE-IPV4-ADDRESS:8283`).

You can then change the bridge mode and other parameters from the frontend.

## Usage

### mode bridge

```bash
matterbridge --bridge
```

This force Matterbridge to load in bridge mode.

Matterbridge only exposes itself, and you have to pair it scanning the QR code shown in the frontend or in the console.

### mode childbridge

```bash
matterbridge --childbridge
```

This force Matterbridge to load in childbridge mode.

Matterbridge exposes each registered plugins, and you have to pair each one by scanning the QR code shown in the frontend or in the console.

### Use matterbridge --help to see the command line syntax

```bash
matterbridge --help
```

### Use matterbridge --version to see the current version

```bash
matterbridge --version
```

## Frontend

Matterbridge has a frontend available on IPv4 `http://localhost:8283` or `http://MATTERBIDGE-IPV4-ADDRESS:8283` and IPv6 `http://[::1]:8283` or `http://[MATTERBIDGE-IPV6-ADDRESS]:8283`.

You can change the default port by adding the frontend parameter when you run it.

Here's how to specify a different port number:

```bash
matterbridge --frontend [port number]
```

The frontend binds, by default, to all IPv4 and IPv6 addresses. You can override this and bind to a specific address:

```bash
matterbridge --bind [address]
```

To use the frontend with SSL, see below.

From the frontend you can do all operations in an easy way.

Home page

![Home page](./screenshots/Screenshot%20home.jpg)

[Devices page](./screenshots/Screenshot%20devices.jpg)

[Logs page](./screenshots/Screenshot%20logs.jpg)

[Config editor](./screenshots/Screenshot%20config%20editor.jpg)

## Advanced configurations

### Run matterbridge as a daemon with systemctl (Linux only)

Traditional configuration: [configuration](README-SERVICE.md)

or with local global node_modules and npm cache (no sudo required): [configuration](README-SERVICE-LOCAL.md)

or with user matterbridge and with private global node_modules and npm cache (no sudo required): [configuration](README-SERVICE-OPT.md)

### Run matterbridge as a system service with launchctl (macOS only)

[Launchctl configuration](README-MACOS-PLIST.md)

### Run matterbridge with docker and docker compose

[Docker configuration](README-DOCKER.md)

### Run matterbridge with podman

[Podman configuration](README-PODMAN.md)

### Run matterbridge with nginx

[Nginx configuration](README-NGINX.md)

### Run matterbridge as an home assistant add-on with the official add-on

[Home assistant add-on configuration](https://github.com/Luligu/matterbridge-home-assistant-addon)

### Other Home Assistant Community Add-ons

The other Home Assistant Community Add-ons and plugins are not verified to work with Matterbridge. I strongly advise against using them. If you do use them and encounter an issue (which is likely because some do not meet the Matterbridge guidelines), please do not open an issue in the Matterbridge repository.

## Development

[Development](README-DEV.md)

## Plugins

### Shelly

<a href="https://github.com/Luligu/matterbridge-shelly">
  <img src="./screenshots/Shelly.svg" alt="Shelly plugin logo" width="100" />
</a>

Matterbridge shelly plugin allows you to expose all Shelly Gen 1, Gen 2, Gen 3 and Gen 4 and BLU devices to Matter.

Features:

- Shellies are automatically discovered using mDNS.
- Shelly wifi battery-powered devices are supported.
- Shelly wifi battery-powered devices with sleep_mode are supported.
- Shelly BLU devices are supported through local devices configured as ble gateway.
- Discovered shellies are stored in local storage for quick loading on startup.
- The components exposed are Light (with brightness and RGB color), Switch, Relay, Roller, Cover, PowerMeter, Temperature, Humidity, Illuminance, Thermostat, Button and Input.
- PowerMeters expose the electrical measurements with the electricalSensor device type (suppoerted by Home Assistant and partially by SmartThings), waiting for the controllers to upgrade to the Matter 1.3 specs.
- Shellies are controlled locally, eliminating the need for cloud or MQTT (which can both be disabled).
- Shelly Gen 1 devices are controlled using the CoIoT protocol.
- Shelly Gen 2 and Gen 3 devices are controlled using WebSocket.
- The Matter device takes the name configured in the Shelly device's web page.
- Each device can be blacklisted or whitelisted using its name, id or mac address.
- Device components can be blacklisted globally or on a per-device basis.
- If the device has a firmware update available, a message is displayed.
- If the device's CoIoT protocol is not correctly configured, a message is displayed.
- If the device cover/roller component is not calibrated, a message is displayed.
- If a device changes its ip address on the network, a message is displayed and the new address is stored.
- A 10-minute timer checks if the device has reported within that time frame, and fetch un update.

### Zigbee2MQTT

<a href="https://github.com/Luligu/matterbridge-zigbee2mqtt">
  <img src="./screenshots/Zigbee2MQTT.svg" alt="Zigbee2MQTT plugin logo" width="100" />
</a>

Matterbridge zigbee2mqtt is a matterbridge production-level plugin that expose all zigbee2mqtt devices and groups to Matter.

No hub or dedicated hardware needed.

### Somfy tahoma

<a href="https://github.com/Luligu/matterbridge-somfy-tahoma">
  <img src="./screenshots/Somfy.svg" alt="Somfy plugin logo" width="100" />
</a>

Matterbridge Somfy Tahoma is a matterbridge production-level plugin that expose the Somfy Tahoma screen devices to Matter.

### Home Assistant

<a href="https://github.com/Luligu/matterbridge-hass">
  <img src="./screenshots/HomeAssistant.svg" alt="Hass logo" width="100" />
</a>

Matterbridge Home Assistant plugin allows you to expose the Home Assistant devices and entities to Matter.

It is the ideal companion of the official [Matterbridge Home Assistant Add-on](https://github.com/Luligu/matterbridge-home-assistant-addon).

### Webhooks

<a href="https://github.com/Luligu/matterbridge-webhooks">
  <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge logo" width="100" />
</a>

Matterbridge Webhooks plugin allows you to expose any webhooks to Matter.

### BTHome

<a href="https://github.com/Luligu/matterbridge-webhooks">
  <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge logo" width="100" />
</a>

Matterbridge BTHome allows you to expose any BTHome device to Matter using the native bluetooth of the host machine.

Features:

- The bluetooth works correctly on all platforms and is based on the @stoprocent fork of noble.
- The discovered BTHome devices are stored with all attributes to easily restart the plugin.
- The plugin has also a command line to test and verify the bluetooth adapter and the ble network.

### Accessory platform example

This is an example of an accessory platform plugin.

It exposes a virtual cover device that continuously moves position and shows how to use the command handlers (you can control the device).

An Accessory platform plugin only exposes one device.

[See the plugin homepage here](https://github.com/Luligu/matterbridge-example-accessory-platform)

### Dynamic platform example

This is an example of a dynamic platform plugin.

It exposes 57 virtual devices.

All these virtual devices continuously change state and position. The plugin also shows how to use all the command handlers (you can control all the devices).

A Dynamic platform plugin exposes as many devices as you need (the limit for the Home app is 150 accessories for bridge).

[See the plugin homepage here](https://github.com/Luligu/matterbridge-example-dynamic-platform)

### Example plugins to show the usage of history in matter

[Door plugin with history](https://github.com/Luligu/matterbridge-eve-door)

[Motion plugin with history](https://github.com/Luligu/matterbridge-eve-motion)

[Energy plugin with history](https://github.com/Luligu/matterbridge-eve-energy)

[Weather plugin with history](https://github.com/Luligu/matterbridge-eve-weather)

[Room plugin with history](https://github.com/Luligu/matterbridge-eve-room)

The history works in both bridge and childbridge mode.

The Eve app only shows the history when the plugins run like an AccessoryPlatform in childbridge mode (this means the plugin is paired directly).

## Third-party plugins

### [Loxone](https://github.com/andrasg/matterbridge-loxone)

A matterbridge plugin that allows connecting Loxone devices to Matter.

### [Dyson robot](https://github.com/thoukydides/matterbridge-dyson-robot)

A Matterbridge plugin that connects Dyson robot vacuums and air treatment devices.
to the Matter smart home ecosystem via their local MQTT APIs.

### [Aeg robot](https://github.com/thoukydides/matterbridge-aeg-robot)

AEG RX 9 / Electrolux Pure i9 robot vacuum plugin for Matterbridge.

### [Airthings](https://github.com/michaelahern/matterbridge-airthings)

A Matterbridge plugin for Airthings air quality monitors via the Airthings Consumer API.

### [Daikin AC](https://github.com/andrasg/matterbridge-daikin-ac)

The plugin uses local connection to Daikin Wifi modules. The plugin does not work with Daikin cloud (Onecta) connected devices.

### [Roborock](https://github.com/RinDevJunior/matterbridge-roborock-vacuum-plugin)

Matterbridge Roborock Platform Plugin is a dynamic platform plugin for Matterbridge that integrates Roborock vacuums into the Matter ecosystem, enabling control via Apple Home and other Matter-compatible apps.

### [Wyze Robot Vacuum](https://github.com/RMCob/matterbridge-wyze-robovac)

Matterbridge plugin to control and report status of the Wyze S200 Robot Vacuum.

### [Matterbridge Litetouch 2000](https://github.com/signal15/matterbridge-litetouch)

Matterbridge plugin that exposes Litetouch 2000 lighting loads as Matter devices.

## How to install and add a plugin with the frontend (best option)

Just open the frontend on the link provided in the log, select a plugin and click install.

## How to install and add a plugin manually from a terminal (from npm)

To install i.e. https://github.com/Luligu/matterbridge-zigbee2mqtt

On windows:

```powershell
cd $HOME\Matterbridge
npm install -g matterbridge-zigbee2mqtt --omit=dev
matterbridge --add matterbridge-zigbee2mqtt
```

On linux or macOS:

```bash
cd ~/Matterbridge
sudo npm install -g matterbridge-zigbee2mqtt --omit=dev
matterbridge --add matterbridge-zigbee2mqtt
```

## How to add a plugin to Matterbridge from a terminal

```bash
matterbridge --add [plugin path or plugin name]
```

## How to remove a plugin from Matterbridge from a terminal

```bash
matterbridge --remove [plugin path or plugin name]
```

## How to disable a registered plugin from a terminal

```bash
matterbridge --disable [plugin path or plugin name]
```

## How to enable a registered plugin from a terminal

```bash
matterbridge --enable [plugin path or plugin name]
```

## How to remove the commissioning information for Matterbridge so you can pair it again (bridge mode). Shutdown Matterbridge before!

```bash
matterbridge --reset
```

## How to remove the commissioning information for a registered plugin so you can pair it again (childbridge mode). Shutdown Matterbridge before!

```bash
matterbridge --reset [plugin path or plugin name]
```

## How to factory reset Matterbridge. Shutdown Matterbridge before!

```bash
matterbridge --factoryreset
```

This will reset the internal storages. All commissioning informations will be lost. All plugins will be unregistered.

# Frequently asked questions

## How to enable HTTPS for the frontend

### Provide your own standard certificate, key and ca (optional)

Place your own certificates in the `.matterbridge/cert` directory:

- `cert.pem`
- `key.pem`
- `ca.pem` (optional)

![image](./screenshots/Screenshot%20Certificates.png)

Matterbridge looks first for .p12 certificate and if it is not found it looks for cert.pem and key.pem.

### Provide your own 'PKCS#12' certificate and the passphrase

Place your own p12 certificate (binary file) and the passphrase (text file) in the `.matterbridge/cert` directory:

- `cert.p12`
- `cert.pass`

Matterbridge looks first for .p12 certificate and if it is not found it looks for cert.pem and key.pem.

### Change the command line

Add the **--ssl** parameter to the command line.

If desired, you can also change the frontend port with **-frontend 443**.

```bash
matterbridge --ssl --frontend 443
```

Add the **--mtls** parameter to the command line if you want Matterbridge to request the client (your browser) to authenticate itself (this is the most secure connection possible).

The browser must provide the client certificate: on Windows you need to import it in Current User → Personal → Certificates with certmgr.msc.

```bash
matterbridge --ssl --mtls --frontend 443
```

### Restart

If the certificate are correctly configured, you will be able to connect with https to the frontend.

![image](./screenshots/Screenshot%20Browser%20Secured.png)

## How to send the debug log files

### Enable debug and log on file

In the frontend, go to settings and enable debug mode as shown below:

![Debug Matterbridge Settings](./screenshots/Screenshot%20Matterbridge%20Logger%20Debug.png)

![Debug Matter Settings](./screenshots/Screenshot%20Matter%20Logger%20Debug.png)

### Restart

Wait a few minutes to allow the logs to to accumulate.

Then, from the dots menu in the frontend, download the `matterbridge.log` and `matter.log` files.

![image](./screenshots/Screenshot%20Debug%20Download%20Logs.png)

Don't forget to unselect the debug mode when is no more needed. The network traffic and cpu usage is very high in debug mode.

## How to pair a second controller

There are two ways to pair a second controller:

- from the first controller find the `share` or `turn on pairing mode` method and get a new (QR)code and use it to pair the second controller;

- from Matterbridge frontend click `Turn on pairing mode` in the `Paired fabrics` panel and proceed like for the first controller.

![alt text](./screenshots/Turn%20on%20pairing%20mode.png)

Be patient cause the procedure can fail sometimes.

## How to avoid race condition on start / restart

We have a race condition when, after a blackout or with docker compose or with other systems that start more then one process, Matterbridge always starts before other required system or network components.

Race condition can cause missing configuration or missed devices on the controller side. All Matterbridge official plugins already wait for system and network components to be ready so there is no need of delay.

To solve the race condition on blackout, use the --delay parameter. There is no delay on normal restart cause the delay is applied only in the first 5 minutes from system reboot.

To solve the race condition on docker compose, use the --fixed_delay parameter. The start will always be delayed so use it only if strictly necessary.

## How to use the regex search in the Log page

The regex search is activated when the search string starts with `/` and ends with `/`.

Examples:

```text
/^error/          -> match log names (the part with [...]) or lines that start with "error"
/timeout/         -> match "timeout" anywhere in the line (beginning/middle/end)
/disconnected$/   -> match lines that end with "disconnected"
/error|warning/   -> match either "error" OR "warning" (double search)
```

## Window Covering cluster and position explained

In Matter spec the Window Covering cluster uses:

- 10000 = fully closed
- 0 = fully opened

So you should see 100% for fully closed and 0% for fully open.

Some controllers interpret the position the other way around (they show “open” as “closed” and vice versa). If the percentages look reversed, it’s a controller-specific UI behavior. Alexa is a common example.

## How to disable Restart matterbridge and update matterbridge

In the settings page of the frontend, set virtual devices to Disabled.

## Data structure for backup and restore

Matterbridge uses three directories. These are the default locations (some advanced setups may change them, so check your configuration):

```text
~/.matterbridge
~/Matterbridge
~/.mattercert
```

### Backup

From the frontend (three-dots menu), select **Create backup**, then **Download backup** when it is ready.
The backup file is a standard `.zip` archive.

### Restore

Restore must be done manually because the archive paths depend on your setup.

Make sure Matterbridge is not running. Stop it if needed.

Extract the backup and replace the corresponding directories on your system with the ones from the backup:

```text
.matterbridge
Matterbridge
.mattercert
```

Ensure permissions are correct for the restored directories.

# Known general issues

## Session XYZ does not exist or Cannot find a session for ID XYZ

This message may appear after Matterbridge restarts, indicating that the controller is still using a session from the previous connection that has since been closed.
After some time, the controller will reconnect.
In this context, the message is not indicative of a problem.

## Apple Home

The HomePods, being a WiFi devices, sometimes pruduce message trasmission errors. The Apple TV with network cable is more reliable (but also more expensive).

All issues have been solved from the version 17.5 of the HomePod/AppleTV. Now they are stable.

If you have more then one Apple TV or Home Pod, you can herve better results setting to disabled "Automatic Selection" in "Home Setting", "Home Hubs & Bridges". When "Automatic selection" is disabled, select your Apple Tv if you have one or any of your Home Pod. In this way you should not have anymore more then one session for fabric.

### Appliances

As of version 18.4.x, all Appliances device types are not supported by the Home app. They don't even appear like unsupported accessories.

### Robot

As of version 18.4.x, the Robot is supported by the Home app only as a single, non-bridged device or if it is the only device in the bridge. Furthermore the device cannot be a composed device. The only device type supported is the rvc.

If a Robot is present alongside other devices in the bridge, the entire bridge becomes unstable in the Home app.

A workaround has been released in Matterbridge 3.1.1. Ask the plugin authors to update the code.

## Home Assistant

So far is the only controller supporting all Matter 1.2, 1.3 and 1.4 device type.

## Home Assistant issues

- If HA doesn't show all devices, reload the Matter Server Integration or reboot HA
- Home Assistant doesn't seem to always react when a device is removed from the bridge: they remain in HA unavailable forever. A full Home Assistant restart solves the problem.

## Google Home

If you face a problem pairing to Google Home from iOS app the solution is there https://github.com/Luligu/matterbridge/issues/61.

If you face a problem changing the brightness check this for the explanation: https://github.com/Luligu/matterbridge-zigbee2mqtt/issues/80

If you encounter a “Something Went Wrong” screen while commissioning MatterBridge devices in Google Home on Android, it’s due to an Android bug. Android fails to send the country code, which is mandatory under the Matter specification.

There is also a known issue with the thermostat Fahrenheit to Celsius Conversion (https://github.com/Luligu/matterbridge/issues/462).

### Workaround

Install Google Home on an iPhone and complete the commissioning there. Once set up, the devices will appear and function normally on your Android phone and other Nest devices in your home. By [Artem Kovalov](https://github.com/artemkovalyov).

## Alexa

Tested by [Tamer Salah](https://github.com/tammeryousef1006).

Alexa integrates with Matterbridge to locally control non-native devices by acting as a Matter Controller.
While Amazon has expanded support to include core categories like lighting, plugs, thermostats, locks, and sensors, many advanced or specialized device types defined in the latest Matter specifications are not yet recognized by the Alexa ecosystem.

Alexa Support vs. Matterbridge Test Results

During testing, Alexa successfully managed most standard smart home categories but failed to recognize or fully support the following types exposed via Matterbridge:

- Appliances & Kitchen: Cooktop, Microwave Oven, Oven, Refrigerator, Laundry Washer/Dryer, and Extractor Hood.
- Energy & Utilities: Battery Storage, EVSE (Electric Vehicle Supply Equipment), and Solar Power.
- Water & Infrastructure: Water Valve, Water Heater, Water Leak/Freeze sensors, Pump, and Rain Sensor.
- Media & Controls: Basic Video Player and Speaker.
- Specialized Sensors/Inputs: Heat Pump, Latching Switch, Flow, and Pressure.
- Limited Support: Cover Lift and Tilt devices only functioned for lift operations, with tilt functionality unsupported.

Integration Limitations

Even when a device is recognized, Alexa may face specific bridge-related limitations:

- Device Caps: Alexa currently supports a maximum of 50 bridged devices per connection; exceeding this limit may cause devices to disappear from the Alexa App.
- Latency: While Matter is designed for local control, status updates in the Alexa app may occasionally lag if the app remains open during external state changes.
- Feature Gaps: Advanced features for certain types, such as unlocking specific smart locks, may be disabled by default for security and require manual activation within the app

Known issues:

- the cover position is inverted in Alexa
- humidity takes long to update

In the zigbee2mqtt and shelly plugins select the option to expose the switch devices like light or outlet cause they don't show up like switch
(Matterbridge uses a switch device type without client cluster).

## SmartThings

Tested by [Tamer Salah](https://github.com/tammeryousef1006).

No issues reported so far.

## eWeLink

Tested by [Tamer Salah](https://github.com/tammeryousef1006).

eWeLink needs the standard port 5540 for commissioning.

## Tuya/Smart Life

Check the matter.js readme.

## Code of Conduct

We believe in a welcoming and respectful community for all. Please make sure to follow our [Code of Conduct](LINK_TO_CODE_OF_CONDUCT) in all your interactions with the project.

## Support

If you find this project helpful and you wish to support the ongoing development, you can do so by buying me a coffee.

On my side I sponsor the packages that I use in this project and single developers. It would be nice to have sponsors too.

Click on the badge below to get started:

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="120">
</a>

Thank you for your support!

# Licensing

Matterbridge is licensed under the [Apache License 2.0](./LICENSE).
