# Matterbridge

[![npm version](https://img.shields.io/npm/v/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)


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

Matterbridge has a frontend (currently under development) available http://localhost:3000

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

Accessory platform plugins only expose one device.

[See the plugin homepage here](https://github.com/Luligu/matterbridge-example-accessory-platform)

### Dynamic platform example

This an example of a dynamic platform plugin.

Dynamic platform plugins expose as many devices as you need (the limit for the Home app is 150 accessories for bridge).

Matterbridge can run as many plugins as you want.

[See the plugin homepage here](https://github.com/Luligu/matterbridge-example-dynamic-platform)

### Example plugins to show the usage of history in matter

[Contact plugin with history](https://github.com/Luligu/matterbridge-eve-door)

[Motion plugin with history](https://github.com/Luligu/matterbridge-eve-motion)

[Energy plugin with history](https://github.com/Luligu/matterbridge-eve-energy)

[Weather plugin with history](https://github.com/Luligu/matterbridge-eve-weather)

[Room plugin with history](https://github.com/Luligu/matterbridge-eve-room)

## How to install a plugin

To install i.e. https://github.com/Luligu/matterbridge-example-accessory-platform

```
git clone https://github.com/Luligu/matterbridge-example-accessory-platform
cd matterbridge-example-accessory-platform
npm install
```

Then add the plugin to Matterbridge
```
matterbridge -add .\
```

### How to add a plugin to Matterbridge

```
matterbridge -add .\
```

### How to remove a plugin from Matterbridge

```
matterbridge -remove .\
```

### How to disable a registerd plugin 

```
matterbridge -disable .\
```

### How to enable a registerd plugin 

```
matterbridge -enable .\
```

## How to create your plugin

The easiest way is to clone:

- https://github.com/Luligu/matterbridge-example-accessory-platform if you want to create an Accessory Platform Plugin.


- https://github.com/Luligu/matterbridge-example-dynamic-platform if you want to create a Dynamic Platform Plugin.

Then change the name, version, description and author in the package.json.

Add your plugin logic in platform.ts:

### onStart(reason?: string)
The method onStart() is where you have to create your MatterbridgeDevice and add all needed clusters and command handlers. 

The MatterbridgeDevice class has the create cluster methods already done and all command handlers needed (see plugin examples).

The method is called when Matterbridge load the plugin.

### onConfigure()
The method onConfigure() is where you can configure or initialize your device. 

The method is called when the platform is commissioned.

### onShutdown(reason?: string)
The method onShutdown() is where you have to eventually cleanup some resources. 

The method is called when Matterbridge is shutting down.
