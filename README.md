# <img src="https://github.com/Luligu/matterbridge/blob/main/frontend/public/matterbridge%2064x64.png" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge

[![npm version](https://img.shields.io/npm/v/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)

[![power by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![power by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![power by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---


Matterbridge is a Matter.js plugin manager. 

It allows you to have all your Matter devices up and running in a couple of minutes without
having to deal with the pairing process of each single device. 

The developer just focuses on the device development extending the provided classes.

Just pair Matterbridge once, and it will load all your registered plugins.

This project aims to allow the porting of homebridge plugins to matterbridge plugins without recoding everything.

It creates a device to pair in any ecosystem like Apple Home, Google Home, Amazon Alexa, or 
any other ecosystem supporting Matter.

The project is build on top of https://github.com/project-chip/matter.js. 

A special thank to Apollon77 for his incredible work.

## Installation

Follow these steps to install Matterbridge:

on Windows:
``` powershell
npm install -g matterbridge
```

on Linux (you need the necessary permissions):
``` bash
sudo npm install -g matterbridge
```

Test the installation with:
```
matterbridge -bridge
```
Now it is possible to open the frontend at the link provided (default: http://localhost:3000)

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

Matterbridge has a frontend available on http://localhost:3000

You can change the default port by adding the frontend parameter when you launch it.
Here's how to specify a different port number:
```
matterbridge -bridge -frontend [port number]
```
```
matterbridge -childbridge -frontend [port number]
```

Home page:
![See the screenshot here](https://github.com/Luligu/matterbridge/blob/main/Screenshot%20home%20page.png)

Devices page:
![See the screenshot here](https://github.com/Luligu/matterbridge/blob/main/Screenshot%20devices%20page.png)

## Plugins

### Accessory platform example

This an example of an accessory platform plugin. 

It exposes a cover device that continouosly moves position and shows how to use the command handlers (you can control the device).

An Accessory platform plugin only exposes one device.

[See the plugin homepage here](https://github.com/Luligu/matterbridge-example-accessory-platform)

### Dynamic platform example

This an example of a dynamic platform plugin.

It exposes a switch with onOff, a light with onOff-levelControl-colorControl, an outlet with onOff and a cover device.

All these devices continouosly change state and position. The plugin also shows how to use all the command handlers (you can control all the devices).

A Dynamic platform plugin exposes as many devices as you need (the limit for the Home app is 150 accessories for bridge).

Matterbridge can run as many plugins as you want.

[See the plugin homepage here](https://github.com/Luligu/matterbridge-example-dynamic-platform)

### Example plugins to show the usage of history in matter

[Door plugin with history](https://github.com/Luligu/matterbridge-eve-door)

[Motion plugin with history](https://github.com/Luligu/matterbridge-eve-motion)

[Energy plugin with history](https://github.com/Luligu/matterbridge-eve-energy)

[Weather plugin with history](https://github.com/Luligu/matterbridge-eve-weather)

[Room plugin with history](https://github.com/Luligu/matterbridge-eve-room)

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

## How to install and register a plugin for development (from git)

To install i.e. https://github.com/Luligu/matterbridge-example-accessory-platform

On windows:
```
cd $HOME\Matterbridge
```

On linux:
```
cd ~/Matterbridge
```

then

```
git clone https://github.com/Luligu/matterbridge-example-accessory-platform
cd matterbridge-example-accessory-platform
npm install
```

Then add the plugin to Matterbridge
```
matterbridge -add .\
```

## How to add a plugin to Matterbridge

```
matterbridge -add [plugin path]
```

## How to remove a plugin from Matterbridge

```
matterbridge -remove [plugin path]
```

## How to disable a registered plugin 

```
matterbridge -disable [plugin path]
```

## How to enable a registered plugin 

```
matterbridge -enable [plugin path]
```

## How to create your plugin

The easiest way is to clone:

- https://github.com/Luligu/matterbridge-example-accessory-platform if you want to create an Accessory Platform Plugin.


- https://github.com/Luligu/matterbridge-example-dynamic-platform if you want to create a Dynamic Platform Plugin.

Then change the name, version, description and author in the package.json.

Add your plugin logic in platform.ts.

## MatterbridgeDynamicPlatform and MatterbridgeAccessoryPlatform api

### name: string
The plugin name.

### type: string
The plugin platform type.

### config: object
The plugin config (loaded before onStart() is called and save after onShutdown() is called).

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

