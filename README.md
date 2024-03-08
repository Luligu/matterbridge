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

Matterbridge exposes only itself and you have to pair it scanning the QR code showed in the frontend or in the console.

### mode childbridge

```
matterbridge -childbridge
```

Matterbridge exposes each registered plugins and you have to pair each plugin scanning the QR code showed in the frontend or in the console.

### command line syntax 

```
matterbridge -help
```


## Frontend

Matterbridge has a frontend (under development) available http://localhost:3000

It is possible to change the port adding the parameter frontend
```
matterbridge -frontend [port number]
```

Home page
![See the screenshot here](https://github.com/Luligu/matterbridge/blob/main/Screenshot%20home%20page.png)

Devices page
![See the screenshot here](https://github.com/Luligu/matterbridge/blob/main/Screenshot%20devices%20page.png)
