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
			if (error) {
				console.log(error);
				process.exit(1);
			}
			console.log('Socket server is running on port ' + self.configs.socketServer.port);
		});

		self.webcall.on('connection', function(socket) {
			console.log('[' + socket.id + '] New socket connection. Waiting for login.');

			socket.conference = null;

			socket.on('user-login', function(datas) {
				console.log('[' + socket.id + '] Login in...');

				socket.conference = datas;

				console.log('[' + socket.id + '] Joining room "' + datas.token + '"');
				socket.join(socket.conference.token);

				socket.emit('user-message', {
					from: 'TalkRTC Team',
					content: 'Hi ! Your are now connected to the server. Click anywhere on this message to make it disappear. Enjoy your conference !'
				});

				if (self.webcall.adapter.rooms[socket.conference.token].length == 2) {
					self.webcall.to(socket.conference.token).emit('user-connect');
					self.webcall.to(socket.conference.token).emit('user-message', {
						from: 'TalkRTC Server',
						content: 'Your correspondent is now connected.'
					});
				}
			});

			// Call invitation
			socket.on('user-message', function(message) {
				console.log('[' + socket.id + '] User message "' + message + '"');
				var username = (socket.conference.role == 'host') ? socket.conference.hostName : socket.conference.guestName;

				socket.to(socket.conference.token).emit('user-message', {
					from: username,
					content: message
				});
			});

			// Call invitation
			socket.on('call-invite', function() {
				console.log('[' + socket.id + '] Call invitation.');

				socket.to(socket.conference.token).emit('call-invite');
			});

			// Call hanged up
			socket.on('call-hangup', function() {
				console.log('[' + socket.id + '] Call hanged up');

				socket.to(socket.conference.token).emit('call-hangup');
			});

			// Call accepted
			socket.on('call-accept', function() {
				console.log('[' + socket.id + '] Call accepted.');

				socket.to(socket.conference.token).emit('call-accept');
			});

			// Call rejected
			socket.on('call-reject', function() {
				console.log('[' + socket.id + '] Call rejected.');

				socket.to(socket.conference.token).emit('call-reject');
			});

			// RTC video offer
	    socket.on('webrtc-offer', function(sdp) {
        console.log('[' + socket.id + '] WebRTC offer.');

        socket.to(socket.conference.token).emit('webrtc-offer', sdp);
	    });

	    // RTC video answer
	    socket.on('webrtc-answer', function(sdp) {
				console.log('[ webcall ] [ ' + socket.id + ' ] WebRTC answer.');

        socket.to(socket.conference.token).emit('webrtc-answer', sdp);
	    });

	    // ICE candidates
	    socket.on('webrtc-ice-candidate', function(candidate) {
				console.log('[' + socket.id + '] WebRTC ICE candidate');

        socket.to(socket.conference.token).emit('webrtc-ice-candidate', candidate);
	    });

			// Socket disconnection
			socket.on('disconnect', function() {
				console.log('[' + socket.id + '] User disconnected.');

				if (!socket.conference) {
					return;
				}

				self.webcall.to(socket.conference.token).emit('user-disconnect');

				self.webcall.to(socket.conference.token).emit('user-message', {
					from: 'TalkRTC Server',
					content: 'Your correspondent is now disconnected.'
				});

				socket.leave(socket.conference.token);

				socket.conference = null;
			});
		});
	}
}

module.exports = function(configs) {
	return new SocketServer(configs);
};
