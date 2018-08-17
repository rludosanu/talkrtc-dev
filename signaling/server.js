// Load modules
const express = require('express');
const app = express();
const cors = require('cors');
const fs = require('fs');
const https = require('https');
const config = require('./config/index');
const server = https.createServer({
	key: fs.readFileSync('./ssl/key.pem'),
	cert: fs.readFileSync('./ssl/cert.pem')
}, app);
const io = require('socket.io')(server);

// Authorise server to accept CORS requests
app.use(cors());

// Create a webcall room
webcall = io.of('/webcall');

// Start listening
server.listen(config.server.port, (error) => {
	if (error) {
		console.log(error);
		process.exit(1);
	}
	console.log('Socket server is running on port ' + config.server.port);
});

// Connection
webcall.on('connection', function(socket) {
	console.log('[' + socket.id + '] New socket connection. Waiting for login.');
	socket.conference = null;

	socket.on('user-login', function(datas) {
		console.log('[' + socket.id + '] Login in...');
		socket.conference = datas;
		console.log('[' + socket.id + '] Joining room "' + datas.token + '"');
		// Before joining, check if the room contains already 2 users
		// If it is the case, send an error message to the user
		socket.join(socket.conference.token);
		socket.emit('user-message', {
			from: 'TalkRTC Team',
			content: 'Hi ! Your are now connected to the server. Click anywhere on this message to make it disappear. Enjoy your conference !'
		});
		if (webcall.adapter.rooms[socket.conference.token].length == 2) {
			webcall.to(socket.conference.token).emit('user-connect');
			webcall.to(socket.conference.token).emit('user-message', {
				from: 'TalkRTC Server',
				content: 'Your correspondent is now connected.'
			});
		}
	});

	// Call invitation
	socket.on('user-message', function(message) {
		console.log('[' + socket.id + '] User message "' + message + '"');
		var username = null;

		if (!socket.conference) return ;
		username = (socket.conference.role == 'host') ? socket.conference.hostName : socket.conference.guestName;
		socket.to(socket.conference.token).emit('user-message', {
			from: username,
			content: message
		});
	});

	// Call invitation
	socket.on('call-invite', function(type) {
		console.log('[' + socket.id + '] Call invitation ("' + type + '").');
		if (!socket.conference) return ;
		socket.to(socket.conference.token).emit('call-invite', type);
	});

	// Call hanged up
	socket.on('call-hangup', function() {
		console.log('[' + socket.id + '] Call hanged up');
		if (!socket.conference) return ;
		socket.to(socket.conference.token).emit('call-hangup');
	});

	// Call accepted
	socket.on('call-accept', function() {
		console.log('[' + socket.id + '] Call accepted.');
		if (!socket.conference) return ;
		socket.to(socket.conference.token).emit('call-accept');
	});

	// Call rejected
	socket.on('call-reject', function() {
		console.log('[' + socket.id + '] Call rejected.');
		if (!socket.conference) return ;
		socket.to(socket.conference.token).emit('call-reject');
	});

	// RTC video offer
	socket.on('webrtc-offer', function(sdp) {
		console.log('[' + socket.id + '] WebRTC offer.');
		if (!socket.conference) return ;
		socket.to(socket.conference.token).emit('webrtc-offer', sdp);
	});

	// RTC video answer
	socket.on('webrtc-answer', function(sdp) {
		console.log('[' + socket.id + '] WebRTC answer.');
		if (!socket.conference) return ;
		socket.to(socket.conference.token).emit('webrtc-answer', sdp);
	});

	// ICE candidates
	socket.on('webrtc-ice-candidate', function(candidate) {
		console.log('[' + socket.id + '] WebRTC ICE candidate');
		if (!socket.conference) return ;
		socket.to(socket.conference.token).emit('webrtc-ice-candidate', candidate);
	});

	// Socket disconnection
	socket.on('disconnect', function() {
		console.log('[' + socket.id + '] User disconnected.');
		if (!socket.conference) return ;
		webcall.to(socket.conference.token).emit('user-disconnect');
		webcall.to(socket.conference.token).emit('user-message', {
			from: 'TalkRTC Server',
			content: 'Your correspondent is now disconnected.'
		});
		socket.leave(socket.conference.token);
		socket.conference = null;
	});
});
