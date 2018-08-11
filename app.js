const configs = require('./configs/index');
const expressServer = require('./express-server')(configs);
const socketServer = require('./socket-server')(configs);

expressServer.start();
socketServer.start();
