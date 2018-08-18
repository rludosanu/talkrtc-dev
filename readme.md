# TalkRTC

TalkRTC is a WebRTC POC based on Express.js, Socket.io and AngularJS supported by Docker and PostgreSQL.
It allows to create virtual one-to-one conference rooms, secured by a personal access code, where anybody can exchange instant messages and audio calls.

# Demo

The current live demo is hosted at https://82.67.201.36:3000.
Since the https servers are using self-signed SSL certificates, your browser will display a "not secured" warning you must ignore.

## Configuration

Before running the apps, you must complete the configuration files.

```
$> cat ./client/configs/index.js
{
  // Running port
  server: {
    host: '',
    port: 3000
  },
  // Signaling server ip
  signaling: {
    host: '',
    port: 3001
  },
  // Database connection options
  database: {
    host: '',
    port: 5432 || 3306,
    dialect: 'postgres || mysql',
    operatorsAliases: Sequelize.Op,
    database: 'talkrc',
    username: '',
    password: ''
  },
  // Reset database tables
  models: {
    sync: false
  },
  // Node mailer options
  mail: {
    service: '',
    auth: {
      user: '',
      pass: ''
    }
  }
}

$> cat ./signaling/configs/index.js
{
  // Running port
  server: {
    port: 3001
  }
}
```

## Setup

### MacOS and Linux

Create the virtual host.

```
$> docker-machine create --driver virtualbox talkrtc

$> docker-machine start talkrtc

$> eval $(docker-machine env talkrtc)
```

Build the client and signaling servers containers.

```
$> cd client ; docker build -t talkrtc-client .

$> cd signaling ; docker build -t talkrtc-signaling .
```

Run the MySQL or the PostgreSQL database. Note that the version of MySQL must be <= 5.6 otherwise Sequelize will fail on authentication.

```
$> docker run -d -p 3306:3306 -e "MYSQL_ROOT_PASSWORD=__root_password__" -e "MYSQL_DATABASE=talkrtc" -e "MYSQL_USER=__user__" -e "MYSQL_PASSWORD=__password__" mysql:5.6

# or

$> docker run -d -p 5432:5432 -e "POSTGRES_PASSWORD=__password__" -e "POSTGRES_USER=__user__" -e "POSTGRES_DB=talkrtc" postgres
```

Run the client and signaling servers.

```
$> docker run -d -p 3000:3000 talkrtc-client

$> docker run -d -p 3001:3001 talkrtc-signaling
```

Enjoy !

### Raspberry Pi 3

Replace the client and signaling Dockerfiles FROM command.

```
FROM node:alpine

# by

FROM resin/raspberry-pi-alpine-node
```

Build the client and signaling servers containers.

```
$> cd client ; docker build -t talkrtc-client .

$> cd signaling ; docker build -t talkrtc-signaling .
```

Run the PostgreSQL database.

```
$> docker run -d -p 5432:5432 -e "POSTGRES_PASSWORD=__password__" -e "POSTGRES_USER=__user__" -e "POSTGRES_DB=talkrtc" tobi312/rpi-postgresql
```

Run the client and signaling servers.

```
$> docker run -d -p 3000:3000 talkrtc-client

$> docker run -d -p 3001:3001 talkrtc-signaling
```

Enjoy !
