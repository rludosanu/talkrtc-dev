const Sequelize = require('sequelize');

module.exports = {
  server: {
    host: '82.67.201.36',
    port: 3000
  },
  signaling: {
    host: '82.67.201.36',
    port: 3001
  },
  database: {
    host: '82.67.201.36',
    port: 5432,
    dialect: 'postgres',
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
