# <img src="https://github.com/Luligu/matterbridge/blob/main/frontend/public/matterbridge%2064x64.png" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge

# Matterbridge edge

Matterbridge edge is the version of matterbridge running with matter.js new api.

The conversion of matterbridge from the old api to new api is now finished with the conversion of the whole old storage to the new api storage format.

## Storage conversion

Starting from version 1.6.8, the conversion is automatic and is triggered each time you shutdown, resrtart or update matterbridge using the frontend.

A message is displayed informing that the conversion has been completed.

The first time you run matterbridge in edge mode, the conversion will not be triggered anymore.

## When it will be released

Matterbridge in edge mode will be released as 2.0.0 since it is a major update.

## How to run matterbridge in edge mode 

To start matterbridge in edge mode, before it is offcially released, you have to add the -edge parameter to the command line or docker command.

### When you run matterbridge from a terminal

```
matterbridge -edge
```

### When you run matterbridge with systemctl

```
ExecStart=matterbridge -service -edge
```

### When you run matterbridge with docker

```
sudo docker run --name matterbridge \
  -v ${HOME}/Matterbridge:/root/Matterbridge \
  -v ${HOME}/.matterbridge:/root/.matterbridge \
  --network host --restart always -d luligu/matterbridge:latest \
  matterbridge -docker -edge
```

### When you run matterbridge with docker compose

```
services:
  matterbridge:
    container_name: matterbridge
    image: luligu/matterbridge:latest                   # Matterbridge image with the latest tag
    network_mode: host                                  # Ensures the Matter mdns works
    restart: always                                     # Ensures the container always restarts automatically
    volumes:
      - "${HOME}/Matterbridge:/root/Matterbridge"       # Mounts the Matterbridge plugin directory
      - "${HOME}/.matterbridge:/root/.matterbridge"     # Mounts the Matterbridge storage directory
    command: [ "matterbridge", "-docker", "-edge" ]     # Override the image command adding -edge
```