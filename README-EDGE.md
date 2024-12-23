# <img src="https://github.com/Luligu/matterbridge/blob/main/frontend/public/matterbridge%2064x64.png" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge

# Matterbridge edge

Matterbridge Edge is the version of Matterbridge running with the new Matter.js API.

After months of work, the migration of Matterbridge from the old API to the new API is now complete. This includes the conversion of the entire old storage format to the new API storage format, encompassing fabrics, resumption records, network, commissioning, operational credentials, ACL, and part numbers.

A special thanks goes to Apollon for answering my countless questions and helping to resolve the many small issues that arose during this process.

I also want to express my gratitude to Tamer, who continues to test everything daily to ensure we reach a level of confidence needed to release the update with the latest tag.

## Storage conversion

Starting from version 1.6.8 (1.6.8-dev.11 before it is published with tag latest), the conversion process is automatic and is triggered each time you shut down, restart, or update Matterbridge using the frontend.

A message is displayed to inform you when the conversion is complete.

Once you run Matterbridge in Edge mode for the first time, the conversion will no longer be triggered.

The conversion only creates a new storage directory in the new format. It does not modify the old storage in any way, so there is no risk in trying Edge mode before its official release. You can also revert to normal mode by simply removing the -edge parameter. After the conversion is complete, the two storages will be identical. However, once you start using Edge mode, any changes made to one storage will not be reflected in the other. Therefore, it is recommended to let the conversion complete, switch to Edge mode, and continue using it exclusively.
There is no conversion back to the old storage.

## When it will be released

Matterbridge Edge will be officially released as version 2.0.0, as it represents a major update.

## How to run matterbridge in edge mode 

To start Matterbridge in Edge mode before its official release, you need to add the -edge parameter to the command line or Docker command.

### When you run matterbridge from a terminal

```
matterbridge -edge
```

### When you run matterbridge with systemctl

Modify your /etc/systemd/system/matterbridge.service

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