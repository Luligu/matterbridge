# <img src="https://github.com/Luligu/matterbridge/blob/main/frontend/public/matterbridge%2064x64.png" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge

[![npm version](https://img.shields.io/npm/v/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge?label=docker%20version&sort=semver)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge.svg)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge/actions/workflows/build.yml/badge.svg)

[![power by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![power by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![power by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---


Matterbridge is a matter.js plugin manager. 

It allows you to have all your Matter devices up and running in a couple of minutes without
having to deal with the pairing process of each single device. 

The developer just focuses on the device development extending the provided classes.

Just pair Matterbridge once, and it will load all your registered plugins.

This project aims to allow the porting of homebridge plugins to matterbridge plugins without recoding everything.

It creates a device to pair in any ecosystem like Apple Home, Google Home, Amazon Alexa, or 
any other ecosystem supporting Matter like Home Assistant.

You don't need a hub or a dedicated new machine.

No complex setup just copy paste the installation scripts.

Matterbridge is light weight and run also on slow Linux machine with 512MB of memory. 

It runs perfectly on Windows too.

The project is build on top of https://github.com/project-chip/matter.js. 

A special thank to Apollon77 for his incredible work.

## Installation

Follow these steps to install Matterbridge:

on Windows:
```
npm install -g matterbridge
```

on Linux (you need the necessary permissions):
```
sudo npm install -g matterbridge
```

Test the installation with:
```
matterbridge -bridge
```

Now it is possible to open the frontend at the link provided (default: http://localhost:8283)

## Usage

### mode bridge

```
matterbridge -bridge
```

Matterbridge only exposes itself, and you have to pair it scanning the QR code shown in the frontend or in the console.

### mode childbridge

```
matterbridge -childbridge
```

Matterbridge exposes each registered plugins, and you have to pair each one by scanning the QR code shown in the frontend or in the console.

### Use matterbridge -help to see the command line syntax 

```
matterbridge -help
```

## Frontend

Matterbridge has a frontend available on http://localhost:8283

You can change the default port by adding the frontend parameter when you launch it.

Here's how to specify a different port number:
```
matterbridge -bridge -frontend [port number]
```

```
matterbridge -childbridge -frontend [port number]
```

Home page:
![See the screenshot here](https://github.com/Luligu/matterbridge/blob/main/Screenshot%20home.jpg)

Devices page:
![See the screenshot here](https://github.com/Luligu/matterbridge/blob/main/Screenshot%20devices.jpg)

Logs page:
![See the screenshot here](https://github.com/Luligu/matterbridge/blob/main/Screenshot%20logs.jpg)

Config editor:
![See the screenshot here](https://github.com/Luligu/matterbridge/blob/main/Screenshot%20config%20editor.jpg)

## Plugins

### Accessory platform example

This an example of an accessory platform plugin. 

It exposes a virtual cover device that continuously moves position and shows how to use the command handlers (you can control the device).

An Accessory platform plugin only exposes one device.

[See the plugin homepage here](https://github.com/Luligu/matterbridge-example-accessory-platform)

### Dynamic platform example

This an example of a dynamic platform plugin.

It exposes a switch with onOff, a light with onOff-levelControl-colorControl, an outlet with onOff and a WindoweCovering device.

All these virtual devices continuously change state and position. The plugin also shows how to use all the command handlers (you can control all the devices).

A Dynamic platform plugin exposes as many devices as you need (the limit for the Home app is 150 accessories for bridge).

Matterbridge can run as many plugins as you want.

[See the plugin homepage here](https://github.com/Luligu/matterbridge-example-dynamic-platform)

### Example plugins to show the usage of history in matter

[Door plugin with history](https://github.com/Luligu/matterbridge-eve-door)

[Motion plugin with history](https://github.com/Luligu/matterbridge-eve-motion)

[Energy plugin with history](https://github.com/Luligu/matterbridge-eve-energy)

[Weather plugin with history](https://github.com/Luligu/matterbridge-eve-weather)

[Room plugin with history](https://github.com/Luligu/matterbridge-eve-room)

The history works in both bridge and childbridge mode. 

The Eve app only shows the history when the plugins run like an AccessoryPlatform in childbridge mode (this means the plugin is paired directly).

### Production-level plugins

[zigbee2mqtt](https://github.com/Luligu/matterbridge-zigbee2mqtt)

Matterbridge zigbee2mqtt is a matterbridge production-level plugin that expose all zigbee2mqtt devices and groups to Matter.

No hub or dedicated hardware needed.

[somy-tahoma](https://github.com/Luligu/matterbridge-somfy-tahoma)

Matterbridge Somfy Tahoma is a matterbridge production-level plugin that expose all Somfy Tahoma devices to Matter.

## How to install and register a production-level plugin (from npm)

To install i.e. https://github.com/Luligu/matterbridge-zigbee2mqtt

On windows:
```
cd $HOME\Matterbridge
npm install -g matterbridge-zigbee2mqtt
matterbridge -add matterbridge-zigbee2mqtt
```

On linux:
```
cd ~/Matterbridge
sudo npm install -g matterbridge-zigbee2mqtt
matterbridge -add matterbridge-zigbee2mqtt
```

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

## How to add a plugin to Matterbridge

```
matterbridge -add [plugin path or plugin name]
```

## How to remove a plugin from Matterbridge

```
matterbridge -remove [plugin path or plugin name]
```

## How to disable a registered plugin 

```
matterbridge -disable [plugin path or plugin name]
```

## How to enable a registered plugin 

```
matterbridge -enable [plugin path or plugin name]
```

## How to remove the commissioning information for Matterbridge so you can pair it again (bridge mode). Shutdown Matterbridge before!

```
matterbridge -reset
```

## How to remove the commissioning information for a registered plugin so you can pair it again (childbridge mode). Shutdown Matterbridge before!

```
matterbridge -reset [plugin path or plugin name]
```

## How to factory reset Matterbridge. Shutdown Matterbridge before!

```
matterbridge -factoryreset
```

This will reset the internal storages. All commissioning informations will be lost. All plugins will be unregistered.

## How to create your plugin

The easiest way is to clone:

- https://github.com/Luligu/matterbridge-example-accessory-platform if you want to create an Accessory Platform Plugin.


- https://github.com/Luligu/matterbridge-example-dynamic-platform if you want to create a Dynamic Platform Plugin.

Then change the name (keep matterbridge- at the beginning of the name), version, description and author in the package.json.

Add your plugin logic in platform.ts.

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

# Advanced configuration

## Run matterbridge as a daemon with systemctl (Linux only)

Create a systemctl configuration file for Matterbridge

```
sudo nano /etc/systemd/system/matterbridge.service
```

Add the following to this file, replacing twice (!) USER with your user name (e.g. WorkingDirectory=/home/pi/Matterbridge and User=pi):

```
[Unit]
Description=matterbridge
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/matterbridge -bridge -service
WorkingDirectory=/home/<USER>/Matterbridge
StandardOutput=inherit
StandardError=inherit
Restart=always
RestartSec=10s
TimeoutStopSec=30s
User=<USER>

[Install]
WantedBy=multi-user.target
```

If you modify it after, then run:
```
sudo systemctl daemon-reload
```

### Start Matterbridge
```
sudo systemctl start matterbridge
```

### Stop Matterbridge
```
sudo systemctl stop matterbridge
```

### Show Matterbridge status
```
sudo systemctl status matterbridge.service
```

### View the log of Matterbridge in real time (this will show the log with colors)
```
sudo journalctl -u matterbridge.service -f --output cat
```

### Delete the logs older then 3 days (all of them not only the ones of Matterbridge!)
```
sudo journalctl --vacuum-time=3d
```

### Enable Matterbridge to start automatically on boot

```
sudo systemctl enable matterbridge.service
```

### Disable Matterbridge from starting automatically on boot

```
sudo systemctl disable matterbridge.service
```

## Run matterbridge with docker (Linux only)

The Matterbridge Docker image, which includes a manifest list for the linux/amd64, linux/arm64 and linux/arm/v7 architectures, is published on Docker Hub.

### First create the Matterbridge directories

This will create the required directories if they don't exist

```
cd ~
mkdir -p ./Matterbridge
mkdir -p ./.matterbridge
sudo chown -R $USER:$USER ./Matterbridge ./.matterbridge
```

### Run the Docker container and start it

The container has full access to the host network (needed for mdns).

```
docker run --name matterbridge \
  -v ${HOME}/Matterbridge:/root/Matterbridge \
  -v ${HOME}/.matterbridge:/root/.matterbridge \
  --network host --restart always -d luligu/matterbridge:latest
```

### Run with docker compose

The docker-compose.yml file is available in the docker directory of the package

```
services:
  matterbridge:
    container_name: matterbridge
    image: luligu/matterbridge:latest # Matterbridge image with the latest tag
    network_mode: host # Ensures the Matter mdns works
    restart: always # Ensures the container always restarts automatically
    volumes:
      - "${HOME}/Matterbridge:/root/Matterbridge" # Mounts the Matterbridge plugin directory
      - "${HOME}/.matterbridge:/root/.matterbridge" # Mounts the Matterbridge storage directory
```
copy it in the home directory or edit the existing one to add the matterbridge service.

Then start docker compose with:

```
docker compose up -d
```

### Stop with docker compose
```
docker compose down
```

### Update with docker compose
```
docker compose pull
```

### Inspect the container
```
docker container inspect matterbridge
```

### Start the Docker container
```
docker start matterbridge
```

### Stop the Docker container
```
docker stop matterbridge
```

### Restart the Docker container
```
docker restart matterbridge
```

### Shows the logs
```
docker logs matterbridge
```

### Shows the logs real time (tail)
```
docker logs --tail 1000 -f matterbridge
```

# Known general issues

## Session XYZ does not exist 
This message may appear after Matterbridge restarts, indicating that the controller is still using a session from the previous connection that has since been closed.
After some time, the controller will reconnect. 
In this context, the message is not indicative of a problem.

## Apple Home

The HomePods, being a WiFi devices, sometimes pruduce message trasmission errors. The Apple TV with network cable is more reliable (but also more expensive).

Solved with the version 17.5 of the HomePod/AppleTV. Now they are stable.

### DoorLock issue

The DoorLock cluster in the Home app takes a while to get online. The Home app shows no response for 1 or 2 seconds but then the accessory goes online. With the Eve app or the Controller app this issue is not present.

Solved with the version 17.5 of the HomePod/AppleTV.

## Home Assistant 

So far is the only controller supporting some Matter 1.3 device type:
- air quality sensor

HA also support electrical measurements from EveHistoryCluster (used in Matterbridge plugins)

## Home Assistant issues (Matter Server for HA is still in Beta)

- If HA doesn't show all devices just reload the Matter Server or reboot HA
- Home Assistant doesn't seem to react when a device is removed from the bridge: they remain in HA unavailable forever...
- In the Home Assistant Core log you can see sometimes error messages relating to unique id not found but it seems to be an issue related to missing some matter packet during the commissioning and subscription phase...
- Version 6.1.0 is more stable and has solved the problem of the commissioning window: now pairing is again easy. Use Apple Home when you have to choose the controller type even if you pair Matterbridge directly with HA.

## Google Home

No issues reported so far.

## Alexa issues

Tested by Tamer Salah

Alexa needs the standard port 5540 to pair (from matter.js readme).

There is no support for these Matter device types:
- pressure sensor
- flow sensor
- light sensor

Devices with child endpoints are not shown correctly.

In the zigbee2mqtt and shelly plugins select the option to expose 
the switch devices like light or outlet cause they don't show up like switch
(Matterbridge uses a modified switch device type without client cluster).

## SmartThings

Tested by Tamer Salah

No issues reported so far.

## eWeLink

Tested by Tamer Salah

eWeLink needs the standard port 5540 for commissioning.

## Tuya/Smart Life


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

## Code of Conduct

We believe in a welcoming and respectful community for all. Please make sure to follow our [Code of Conduct](LINK_TO_CODE_OF_CONDUCT) in all your interactions with the project.

## Support

If you find this project helpful and you wish to support the ongoing development, you can do so by buying me a coffee. 
On my side I sponsor the packages that I use in this project. It would be nice to have sponsors too.
Click on the badge below to get started:

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="./yellow-button.png" alt="Buy me a coffee" width="120">
</a>

Thank you for your support!