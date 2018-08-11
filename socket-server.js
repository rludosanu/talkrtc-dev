const app = require('express')();
const jwt = require('jsonwebtoken');

class SocketServer {
	constructor(configs) {
		this.configs = configs;

		this.httpServer = require('http').Server(app);
		this.io = require('socket.io')(this.httpServer);

		this.io.on('connection', function(socket) {
			console.log('(' + socket.id + ') Connection');
			socket.emit('event-message', 'Hello mate ! Welcome to TalkRTC Webchat app :)');

			socket.on('send-message', function(message) {
				console.log('(' + socket.id + ') (send-message) ' + message);
			});

			socket.on('disconnect', () => {
				console.log('Socket "' + socket.id + '" disconnected')
			});
		});
	}

	start() {
		this.httpServer.listen(this.configs.socketServer.port, (error) => {
			if (error) {
				console.log(error);
				process.exit(1);
			}
			console.log('Socket server is running on port ' + this.configs.socketServer.port);
		});
	}
}

module.exports = function(configs) {
	return new SocketServer(configs);
};
