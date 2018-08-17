# TalkRTC

TalkRTC is a WebRTC POC based on Express.js, Socket.io and AngularJS supported by Docker and MySQL.
It allows to create virtual one-to-one conference rooms, secured by a personal access code, where anybody can exchange instant messages or make audio and video calls.

## Configuration

Before running the apps, you must complete the configuration files.

```
$> cat ./client/configs/index.js
{
  // Running port
  server: {
    host: '192.168.99.100',
    port: 3000
  },
  // Signaling server ip
  signaling: {
    host: '192.168.99.100',
    port: 3001
  },
  // Database connection options
  database: {
    host: '127.0.0.1',
    port: 3306,
    dialect: 'mysql',
    operatorsAliases: Sequelize.Op,
    database: 'talkrtc',
    username: 'admin',
    password: 'admin'
  },
  // Reset database tables
  models: {
    sync: false
  },
  // Node mailer options
  mail: {
    service: 'gmail',
    auth: {
      user: 'admin@talkrtc.com',
      pass: 'admin'
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

### Create virtual host

```
# Create the virtual host
$> docker-machine create --driver virtualbox talkrtc

# Get the host running
$> docker-machine start talkrtc

# Setup the host environ
$> eval $(docker-machine env talkrtc)
```

### Build images

```
# Enter the client directory and run the build command
$> cd client ; docker build -t talkrtc-client .

# Enter the signaling directory and run the build command
$> cd signaling ; docker build -t talkrtc-signaling .
```

### Run database

```
# Run MySQL container
docker run -d -p 3306:3306 -e "MYSQL_ROOT_PASSWORD=root" -e "MYSQL_DATABASE=talkrtc" -e "MYSQL_USER=admin" -e "MYSQL_PASSWORD=admin" mysql:5.6
```

### Run servers

```
# Run client container
docker run -d -p 443:3000 talkrtc-server

# Run signaling container
docker run -d -p 3001:3001 talkrtc-signaling
```
