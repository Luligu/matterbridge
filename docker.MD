## Docker commands


### Give docker permissions as the current user
```
sudo usermod -aG docker $USER
```

### Login to docker hub
```
docker login
```

### Build the Docker image
```
git pull
npm run deepClean
npm install
npm run build
docker build -t luligu/matterbridge:latest .
docker push luligu/matterbridge:latest
```
or
```
git pull
npm run deepClean
npm install
npm run build
docker build -t luligu/matterbridge:latest .
docker push luligu/matterbridge:latest
docker build -t luligu/matterbridge:v1.2.11 .
docker push luligu/matterbridge:v1.2.11
```

### Install or update all plugins inside the container
```
docker stop matterbridge
docker exec matterbridge npm -g install matterbridge
docker exec matterbridge npm -g install matterbridge-example-accessory-platform
docker exec matterbridge npm -g install matterbridge-example-dynamic-platform
docker exec matterbridge npm -g install matterbridge-zigbee2mqtt
docker exec matterbridge npm -g install matterbridge-somfy-tahoma
docker exec matterbridge npm -g install matterbridge-eve-door
docker exec matterbridge npm -g install matterbridge-eve-motion
docker exec matterbridge npm -g install matterbridge-eve-energy
docker exec matterbridge npm -g install matterbridge-eve-room
docker exec matterbridge npm -g install matterbridge-eve-weather
docker start matterbridge
```

### Add all plugins inside the container
```
docker stop matterbridge
docker exec matterbridge matterbridge -add matterbridge-example-accessory-platform
docker exec matterbridge matterbridge -add matterbridge-example-dynamic-platform
docker exec matterbridge matterbridge -add matterbridge-zigbee2mqtt
docker exec matterbridge matterbridge -add matterbridge-somfy-tahoma
docker exec matterbridge matterbridge -add matterbridge-eve-door
docker exec matterbridge matterbridge -add matterbridge-eve-motion
docker exec matterbridge matterbridge -add matterbridge-eve-energy
docker exec matterbridge matterbridge -add matterbridge-eve-room
docker exec matterbridge matterbridge -add matterbridge-eve-weather
docker start matterbridge
```

### Remove the matterbridge container, the matterbridge image and the volumes
```
docker stop matterbridge
docker rm matterbridge
docker rmi luligu/matterbridge
docker volume rm matterbridge_plugin
docker volume rm matterbridge_storage

```

### Run the Docker container and start it (this is currently not working due to mdns)
```
docker run --name matterbridge \
  -v matterbridge_plugin:/root/Matterbridge \
  -v matterbridge_storage:/root/.matterbridge \
  -p 8283:8283 -p 8284:8284 -p 5353:5353/tcp -p 5353:5353/udp -p 5550:5550 \
  --restart always -d luligu/matterbridge
```
If this fails check who is using the ports:
```
sudo netstat -lunp | grep 8283
sudo netstat -lunp | grep 8284
sudo netstat -lunp | grep 5350
sudo netstat -lunp | grep 5353
```
If it is homebridge:
```
sudo hb-service stop
sudo systemctl disable avahi-daemon
sudo systemctl stop avahi-daemon
```

### Run the Docker container and start it with full access to the host network
```
docker run --name matterbridge \
  --network host \
  --restart always -d luligu/matterbridge:latest
```

### Run the Docker container and start it with full access to the host network and with volume for the plugin and data directory
```
docker run --name matterbridge \
  -v ${HOME}/Matterbridge:/root/Matterbridge \
  -v ${HOME}/.matterbridge:/root/.matterbridge \
  --network host --restart always -d luligu/matterbridge:latest
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

### Run with docker-compose
```
docker compose up -d
```

### Stop with docker-compose
```
docker compose down
```

### Shows the logs
```
docker logs matterbridge
```

### Shows the logs real time (tail)
```
docker logs --tail 1000 -f matterbridge
```

### Inspect the Matterbridge plugin volume
```
docker volume inspect matterbridge_plugin
```

### Inspect the Matterbridge storage volume
```
docker volume inspect matterbridge_storage
```

### Execute a command inside the container
```
docker exec matterbridge <COMMAND>
```

### Remove the Docker container
```
docker rm matterbridge
```

### Remove the Docker image
```
docker rmi matterbridge
```

### Remove the Docker volumes
```
docker volume rm matterbridge_plugin
docker volume rm matterbridge_storage
```

### Here are some additional Docker commands that you might find useful:

Lists all running Docker containers.
```
docker ps
```

Lists all Docker containers, both running and stopped.
```
docker ps -a 
```

Lists all Docker images on your system.
```
docker images
```

Shows the logs for a specific Docker container.
```
docker logs <container_name>
```

Opens a bash shell inside a running Docker container. Replace /bin/bash with /bin/sh if bash is not available.
```
docker exec -it <container_name> /bin/bash
```

Downloads a Docker image from Docker Hub.
```
docker pull <image_name>
```

Uploads a Docker image to Docker Hub.
```
docker push <image_name>
```

Exports a Docker image to a tar file.
```
docker save -o <path_for_exported_file> <image_name>
```

Imports a Docker image from a tar file.
```
docker load -i <path_to_exported_file>
```

Lists all Docker networks.
```
docker network ls
```

Lists all Docker volumes.
```
docker volume ls
```
