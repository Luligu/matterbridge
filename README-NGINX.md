# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge NGINX configuration

[![npm version](https://img.shields.io/npm/v/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge/latest?label=docker%20version)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge?label=docker%20pulls)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge/actions/workflows/build.yml/badge.svg)
![CodeQL](https://github.com/Luligu/matterbridge/actions/workflows/codeql.yml/badge.svg)
[![codecov](https://codecov.io/gh/Luligu/matterbridge/branch/main/graph/badge.svg)](https://codecov.io/gh/Luligu/matterbridge)

[![power by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![power by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![power by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---

# Advanced configuration to use NGINX

## Run matterbridge with nginx

### Install nginx if it is not installed

```bash
sudo apt update
sudo apt install nginx
```

### Create a basic nginx configuration file that redirect from http://yourhost to http://yourhost:8283

Create or edit the matterbridge configuration file

```bash
sudo nano /etc/nginx/sites-available/matterbridge
```

paste this configuration and if desired change the port to listen (here is 80) and the server_name using yours:

```
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location / {
        # Redirect to Matterbridge frontend from http:/yourhost:80
        proxy_pass http://localhost:8283/;
        proxy_set_header Host                 $host;
        proxy_set_header X-Real-IP            $remote_addr;
        proxy_set_header X-Forwarded-For      $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto    $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade              $http_upgrade;
        proxy_set_header Connection           $http_connection;
    }
}
```

Add matterbridge to enabled sites

```bash
sudo ln -s /etc/nginx/sites-available/matterbridge /etc/nginx/sites-enabled/
```

Restart nginx and test the configuration

```bash
sudo systemctl restart nginx
sudo nginx -t
```

### Create a basic nginx configuration file that redirect from http://yourhost/matterbridge to http://yourhost:8283/matterbridge

Create or edit the matterbridge configuration file

```bash
sudo nano /etc/nginx/sites-available/matterbridge
```

paste this configuration and if desired change the port to listen (here is 80) and the server_name using yours:

```
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location /matterbridge/ {
        # Redirect to Matterbridge frontend from http:/yourhost/matterbridge:80
        proxy_pass http://localhost:8283/;
        proxy_set_header Host                     $host;
        proxy_set_header X-Real-IP                $remote_addr;
        proxy_set_header X-Forwarded-For          $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto        $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade                  $http_upgrade;
        proxy_set_header Connection               $http_connection;
    }
}
```

Add matterbridge to enabled sites

```bash
sudo ln -s /etc/nginx/sites-available/matterbridge /etc/nginx/sites-enabled/
```

Restart nginx and test the configuration

```bash
sudo systemctl restart nginx
sudo nginx -t
```

### Create an advanced nginx configuration file that redirect from http://yourhost or https://yourhost to http://yourhost:8283 with ssl

Add your certificates in /etc/nginx/certs: `cert.pem` and `key.pem`

Create or edit the matterbridge configuration file

```bash
sudo nano /etc/nginx/sites-available/matterbridge
```

paste this configuration:

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

    location / {
      # Redirect to Matterbridge frontend from https:/yourhost:443
      proxy_pass http://localhost:8283/;
      proxy_set_header Host                 $host;
      proxy_set_header X-Real-IP            $remote_addr;
      proxy_set_header X-Forwarded-For      $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto    $scheme;

      # WebSocket support
      proxy_http_version 1.1;
      proxy_set_header Upgrade              $http_upgrade;
      proxy_set_header Connection           $http_connection;
    }
}
```

Add matterbridge to enabled sites

```bash
sudo ln -s /etc/nginx/sites-available/matterbridge /etc/nginx/sites-enabled/
```

Restart nginx and test the configuration

```bash
sudo systemctl restart nginx
sudo nginx -t
```

### Create an advanced nginx configuration file that redirect from http://yourhost/matterbridge or https://yourhost/matterbridge to http://yourhost/matterbridge with ssl

Add your certificates in /etc/nginx/certs: `cert.pem` and `key.pem`

Create or edit the matterbridge configuration file

```bash
sudo nano /etc/nginx/sites-available/matterbridge
```

paste this configuration:

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
    # Redirect to Matterbridge frontend from https:/yourhost/matterbridge:443
      proxy_pass http://localhost:8283/;
      proxy_set_header Host                       $host;
      proxy_set_header X-Real-IP                  $remote_addr;
      proxy_set_header X-Forwarded-For            $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto          $scheme;

    # WebSocket support
      proxy_http_version 1.1;
      proxy_set_header Upgrade                    $http_upgrade;
      proxy_set_header Connection                 $http_connection;
  }
}
```

Add matterbridge to enabled sites

```bash
sudo ln -s /etc/nginx/sites-available/matterbridge /etc/nginx/sites-enabled/
```

Restart nginx and test the configuration

```bash
sudo systemctl restart nginx
sudo nginx -t
```
