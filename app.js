const configs = require('./configs/dev');
const expressServer = require('./express-server')(configs);
const socketServer = require('./socket-server')(configs);

expressServer.start();
socketServer.start();
