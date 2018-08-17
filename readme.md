# TalkRTC

## Description

TalkRTC is a WebRTC POC based on Express.js, Socket.io and AngularJS. It allows to create virtual 1-to-1 conference rooms, secured by a personal access code, where anybody can exchange instant messages or make audio and video calls.

## Configuration

Before running the app, you must complete the configuration file located in the configs directory.

```
{
  // Main server running port
  expressServer: {
    port: 3000
  },
  // Signaling server running port
  socketServer: {
    port: 3001
  },
  // Database connection options
  database: {
    host: '127.0.0.1',
    port: 3306,
    dialect: 'mysql',
    operatorsAliases: Sequelize.Op,
    database: 'talkrtcdb',
    username: 'talkadmin',
    password: 'abcdef123456'
  },
  // Sync force models on server startup
  models: {
    sync: false
  },
  // Node mailer options
  mail: {
    service: 'gmail',
    auth: {
      user: 'talkadmin@gmail.com',
      pass: 'abcdef123456'
    }
  },
  // Json Web Token secret encryption string
  jsonwebtoken: {
    secret: 'abcdef123456'
  }
}
```
