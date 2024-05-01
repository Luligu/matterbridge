# Use an official Node.js runtime
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the current directory contents into the container at /usr/src/app
COPY package.json tsconfig.json ./
COPY src ./src
COPY frontend/build ./frontend/build

# Install any needed packages specified in package.json
RUN npm install

# Build the project
RUN npm run build

# Link Matterbridge
RUN npm link

# Install all Matterbridge plugins in the container
RUN npm -g install matterbridge-example-accessory-platform
RUN npm -g install matterbridge-example-dynamic-platform
RUN npm -g install matterbridge-zigbee2mqtt
RUN npm -g install matterbridge-somfy-tahoma
RUN npm -g install matterbridge-eve-door
RUN npm -g install matterbridge-eve-motion
RUN npm -g install matterbridge-eve-energy
RUN npm -g install matterbridge-eve-room
RUN npm -g install matterbridge-eve-weather

# Make port available to the world outside this container
# EXPOSE 1883 8883
# EXPOSE 8283 
# EXPOSE 8284
# EXPOSE 5353/tcp 
# EXPOSE 5353/udp 
# EXPOSE 5550/tcp 
# EXPOSE 5550/udp
# We need --network host the mdns doesn't work without it apparently

# Define environment variable
# ENV NAME Value

# Run dist/cli.js when the container launches
CMD ["node", "dist/cli.js", "-bridge", "-docker", "-frontend", "8283", "-port", "5550"]
