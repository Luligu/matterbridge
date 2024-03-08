# Matterbridge

Matterbridge is a Matter.js plugin manager. 

It allows you to have all your Matter devices up and running in a couple of minutes without
having to deal with the pairing process of each single device. 

The developer just focuses on the device development extending the provided classes.

Just pair Matterbridge once, and it will load all your registered plugins.

This project aims to allow the porting of homebridge plugins to matterbridge plugins without recoding everything.

It creates a device to pair in any ecosystem like Apple Home, Google Home, Amazon Alexa, or 
any other ecosystem supporting Matter.

The project is build on top of https://github.com/project-chip/matter.js. 

A special thank to Apollon77 for is incredible work.

## Installation

Follow these steps to install Matterbridge:
```
npm install -g matterbridge
```

Test the installation with:
```
matterbridge
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

You can change the port by adding the frontend parameter when you launch it.
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

[See the homepage here](https://github.com/Luligu/matterbridge-example-accessory-platform)

### Dynamic platform example

This an example of a dynamic platform plugin.

Dynamic platform plugins expose as many devices as you need (the limit for the Home app is 150 accessories for bridge).

[See the homepage here](https://github.com/Luligu/matterbridge-example-dynamic-platform)

### Example plugins to show the usage of history

[Contact plugin with history](https://github.com/Luligu/matterbridge-eve-door)

[Motion plugin with history](https://github.com/Luligu/matterbridge-eve-motion)

[Energy plugin with history](https://github.com/Luligu/matterbridge-eve-energy)
