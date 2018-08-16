const Sequelize = require('sequelize');

module.exports = {
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
    host: '',
    port: 3306,
    dialect: 'mysql',
    operatorsAliases: Sequelize.Op,
    database: '',
    username: '',
    password: ''
  },
  // Sync force models on server startup
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
  },
  // Json Web Token secret encryption string
  jsonwebtoken: {
    secret: ''
  }
};
