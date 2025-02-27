# <img src="frontend/public/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge

[![npm version](https://img.shields.io/npm/v/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge?label=docker%20version&sort=semver)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge.svg)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge/actions/workflows/build.yml/badge.svg)

[![power by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![power by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![power by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---

# Advanced configuration to use NGINX

## Run matterbridge with nginx

### Create a basic nginx configuration file

```
sudo nano /etc/nginx/sites-available/matterbridge
```

paste this configuration and if desired change the port to listen (here is 80) and the server_name using yours:

```
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location /matterbridge/ {
        # Redirect to Matterbridge frontend
        proxy_pass http://localhost:8283/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Add matterbridge to enabled sites

```
sudo ln -s /etc/nginx/sites-available/matterbridge /etc/nginx/sites-enabled/
```

### Create an advanced nginx configuration file that redirect to ssl

```
sudo nano /etc/nginx/sites-available/matterbridge
```

paste this configuration adding your certificates:

```
# Redirect all HTTP requests to HTTPS
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    return 301 https://$host$request_uri;
}

# HTTPS server configuration
server {
	listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
	http2 on;
	server_name _;

	# SSL certificate paths
    ssl_certificate /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/key.pem;

    # SSL security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

	root /var/www/html;
	index index.html index.htm index.nginx-debian.html;

	location / {
		# First attempt to serve request as file, then
		# as directory, then fall back to displaying a 404.
		try_files $uri $uri/ =404;
	}

    location /matterbridge/ {
	    # Redirect to Matterbridge frontend
        proxy_pass http://localhost:8283/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

	    # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Add matterbridge to enabled sites

```
sudo ln -s /etc/nginx/sites-available/matterbridge /etc/nginx/sites-enabled/
```

### Restart nginx and test the configuration

```
sudo systemctl restart nginx
sudo nginx -t
```

### Use matterbridge with nginx

http://ubuntu/matterbridge/

or

https://ubuntu/matterbridge/
