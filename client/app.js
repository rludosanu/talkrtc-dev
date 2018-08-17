const config = require('./config/index');
const server = require('./server')(config);

server.start();
