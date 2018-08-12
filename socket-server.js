const app = require('express')();
const cors = require('cors');

app.use(cors());

const fs = require('fs');
const server = require('https').createServer({
	key: fs.readFileSync('./ssl/key.pem'),
  cert: fs.readFileSync('./ssl/cert.pem')
}, app);
const io = require('socket.io')(server);
const jwt = require('jsonwebtoken');

class SocketServer {
	constructor(configs) {
		this.configs = configs;
		this.server = server;
		this.io = io;
		this.webchat = io.of('/webchat');
		this.webcall = io.of('/webcall');
	}

	start() {
		var self = this;

		self.server.listen(this.configs.socketServer.port, (error) => {
			/*
			** Starting socket server
			*/
			if (error) {
				console.log(error);
				process.exit(1);
			}
			console.log('Socket server is running on port ' + self.configs.socketServer.port);

			/*
			** Webchat app namespace
			*/
			self.webchat.on('connection', function(socket) {
				console.log('[ webchat ] [ ' + socket.id + ' ] New socket connection. Checking token...');

				var getSocketCookie = function(socket, name) {
					var cookies = socket.handshake.headers.cookie.split(';');

					for (let i = 0 ; i < cookies.length ; i++) {
						var cookie = cookies[i].split('=');

						if (cookie[0] == name) {
							return cookie[1];
						}
					}
					return null;
				}

				jwt.verify(getSocketCookie(socket, 'token'), self.configs.jsonwebtoken.secret, function(error, decoded) {
					if (error) {
						console.log('[ webchat ] [ ' + socket.id + ' ] Invalid token.');
						socket.emit('event-message', 'Invalid token.');
					} else {
						console.log('[ webchat ] [ ' + socket.id + ' ] Valid token.');
						socket.emit('event-message', 'Hi ! Welcome to TalkRTC Webchat app.');
					}

					socket.conference = decoded;
					socket.join(socket.conference.token);
					socket.to(socket.conference.token).emit('event-message', 'Your correspondent has arrived.');
				});

				socket.on('send-message', function(message) {
					console.log('[ webchat ] [ ' + socket.id + ' ] Sending message "' + message + '"');
					socket.to(socket.conference.token).emit('recieve-message', message);
				});

				socket.on('disconnect', function() {
					console.log('[ webchat ] [ ' + socket.id + ' ] Socket disconnection.');
					self.io.in(socket.conference.token).emit('event-message', 'Your correspondent has left.');
				});
			});
		});

		/*
		** Webcall app namespace
		*/
		self.webcall.on('connection', function(socket) {
			console.log('[ webcall ] [ ' + socket.id + ' ] New socket connection.');

			var room = 'webcall-room';

			// Join room
			socket.join(room);

			// Call invitation
			socket.on('call-invite', function() {
				console.log('[ webcall ] [ ' + socket.id + ' ] Inviting client to call.');
				socket.to(room).emit('call-invite');
			});

			// Call hanged up
			socket.on('call-hangup', function() {
				console.log('[ webcall ] [ ' + socket.id + ' ] Hanging up call.');
				socket.to(room).emit('call-hangup');
			});

			// Call answered
			socket.on('call-answer', function() {
				console.log('[ webcall ] [ ' + socket.id + ' ] Answering call.');
				socket.to(room).emit('call-answer');
			});

			// Call rejected
			socket.on('call-reject', function() {
				console.log('[ webcall ] [ ' + socket.id + ' ] Reject call.');
				socket.to(room).emit('call-reject');
			});

			// RTC video offer
	    socket.on('webrtc-offer', function(sdp) {
        console.log('[ webcall ] [ ' + socket.id + ' ] webrtc-offer.');
        socket.to(room).emit('webrtc-offer', sdp);
	    });

	    // RTC video answer
	    socket.on('webrtc-answer', function(sdp) {
				console.log('[ webcall ] [ ' + socket.id + ' ] webrtc-answer.');
        socket.to(room).emit('webrtc-answer', sdp);
	    });

	    // ICE candidates
	    socket.on('webrtc-ice-candidate', function(candidate) {
				console.log('[ webcall ] [ ' + socket.id + ' ] webrtc-ice-candidate')
        socket.to(room).emit('webrtc-ice-candidate', candidate);
	    });

			// Socket disconnection
			socket.on('disconnect', function() {
				self.io.to(room).emit('call-hangup');
			});
		});
	}
}

module.exports = function(configs) {
	return new SocketServer(configs);
};
