const Sequelize = require('sequelize');

module.exports = {
  server: {
    host: '192.168.99.100',
    port: 3000
  },
  signaling: {
    host: '192.168.99.100',
    port: 3001
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
    sync: false
  },
  mail: {
    service: 'gmail',
    auth: {
      user: 'talkrtc@gmail.com',
      pass: '/R=r8/p\\'
    }
  }
};
