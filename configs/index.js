const Sequelize = require('sequelize');

module.exports = {
  server: {
    port: 3000
  },
  database: {
    host: '192.168.99.100',
    port: 3306,
    dialect: 'mysql',
    operatorsAliases: Sequelize.Op,
    database: 'talkrtc',
    username: 'admin',
    password: 'admin'
  },
  models: {
    sync: true
  },
  mail: {
    service: 'gmail',
    auth: {
      user: 'talkrtc@gmail.com',
      pass: '/R=r8/p\\'
    }
  },
  jsonwebtoken: {
    secret: '4ade8c6f3262cd49276'
  }
};
