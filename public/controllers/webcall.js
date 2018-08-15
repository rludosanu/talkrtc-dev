(function() {
  var app = angular.module('app', ['ngCookies', 'ngAnimate']);

  // Angular factory for socket.io defined as "socket"
  app.factory('socket', function ($rootScope) {
    var socket = io('https://192.168.1.26:3001/webcall');

    return {
      on: function (eventName, callback) {
        socket.on(eventName, function () {
          var args = arguments;
          $rootScope.$apply(function () {
            callback.apply(socket, args);
          });
        });
      },
      emit: function (eventName, data, callback) {
        socket.emit(eventName, data, function () {
          var args = arguments;
          $rootScope.$apply(function () {
            if (callback) {
              callback.apply(socket, args);
            }
          });
        })
      }
    };
  });

  app.controller('webcall', function($scope, $http, $window, $location, $cookies, $interval, $timeout, socket) {
    class WebcallClient {
      constructor(signaling) {
        // Compatibility
        window.URL = window.URL || window.webkitURL || window.mozURL;

        // Call state
        this.call = {
          state: 'idle',
          states: {
            enum: {
              idle: {
                message: 'Send a message or make a call.',
                state: 'idle'
              },
              calling: {
                message: 'Calling...',
                state: 'calling'
              },
              ringing: {
                message: 'Ringing...',
                state: 'ringing'
              },
              connecting: {
                message: 'Connecting...',
                state: 'connecting'
              },
              reconnecting: {
                message: 'Network error. Reconnecting...',
                state: 'reconnecting'
              },
              ongoing: {
                message: 'Ongoing...',
                state: 'ongoing'
              },
              ended: {
                message: 'Call ended. Please rate your experience.',
                state: 'ended'
              },
              failed: {
                message: 'Network error. Click to make a call.',
                state: 'failed'
              },
              rejected: {
                message: 'Call rejected. Click to make a call.',
                state: 'rejected'
              }
            }
          },
          timer: {
            counter: 0,
            handle: null
          },
          ringtone: new Audio('/public/sounds/ringtone.mp3'),
          rate: 0,
          muted: false,
          paired: false
        };

        // WebRTC
        this.rtc = {
          peerConnection: null,
          iceServers: [{
            url: 'stun:stun1.l.google.com:19302'
          }],
          mediaConstraints: {
            audio: true,
            video: false
          },
          localVideo: document.getElementById('local-video'),
          remoteVideo: document.getElementById('remote-video')
        };

        // Signaling handler (socket.io)
        this.signaling = signaling;
      }

      createPeerConnection(role = 'caller') {
        console.log('wclient->createPeerConnection() : creating new peer connection...');
        var self = this;

        // Check peer connection object
        if (self.rtc.peerConnection) {
          console.error('wclient->createPeerConnection() : peer connection already exists');
          return false;
        }

        // Create a new peer connection object
        self.rtc.peerConnection = new RTCPeerConnection({
          iceServers: self.rtc.iceServers
        });

        console.log('wclient->createPeerConnection() : peer connection created');
        console.info(self.rtc.peerConnection);

        // Setup WebRTC handlers
        console.log('wclient->createPeerConnection() : setting up handlers...');
        self.rtc.peerConnection.onicecandidate = self.sendICECandidate.bind(self);
        self.rtc.peerConnection.onaddstream = self.addRemoteStream.bind(self);
        self.rtc.peerConnection.onremovestream = self.removeRemoteStream.bind(self);
        self.rtc.peerConnection.oniceconnectionstatechange = self.updateICEConnectionState.bind(self);
        self.rtc.peerConnection.onicegatheringstatechange = self.updateICEGatheringState.bind(self);
        self.rtc.peerConnection.onsignalingstatechange = self.updateSignalingState.bind(self);
        self.rtc.peerConnection.onnegotiationneeded = (role == 'caller') ? self.createOffer.bind(self) : null;
        console.log('wclient->createPeerConnection() : handlers set up');

        return true;
      }

      destroyPeerConnection() {
        console.log('wclient->destroyPeerConnection() : destroying peer connection and stopping audio/video streams');
        var self = this;

        if (self.rtc.localVideo.srcObject) {
          self.rtc.localVideo.srcObject.getTracks().forEach(track => track.stop());
          self.rtc.localVideo.srcObject = null;
          console.log('wclient->destroyPeerConnection() : local audio/video stream stopped.');
        } else {
          console.log('wclient->destroyPeerConnection() : local audio/video already stopped.');
        }

        if (self.rtc.remoteVideo.srcObject) {
          self.rtc.remoteVideo.srcObject.getTracks().forEach(track => track.stop());
          self.rtc.remoteVideo.srcObject = null;
          console.log('wclient->destroyPeerConnection() : remote audio/video stream stopped.');
        } else {
          console.log('wclient->destroyPeerConnection() : remote audio/video stream already stopped.');
        }

        if (self.rtc.peerConnection) {
          self.rtc.peerConnection.close();
          self.rtc.peerConnection = null;
          console.log('wclient->destroyPeerConnection() : peer connection closed');
        } else {
          console.log('wclient->destroyPeerConnection() : peer connection already closed.');
        }
      }

      getMediaAccess() {
        console.log('wclient->getMediaAccess() : accessing microphone and camera');
        var self = this;

        navigator.mediaDevices.getUserMedia(self.rtc.mediaConstraints)
        .then(function(stream) {
          console.log('wclient->getMediaAccess() : attaching local stream');
          console.info(stream);
          if ('srcObject' in self.rtc.localVideo) {
            self.rtc.localVideo.srcObject = stream;
          } else {
            self.rtc.localVideo.src = window.URL.createObjectURL(stream);
          }

          self.rtc.localVideo.onloadedmetadata = function(e) {
            self.rtc.localVideo.play();
          };

          console.log('wclient->getMediaAccess() : attaching local tracks');
          stream.getTracks().forEach(track => {
            console.info(track);
            self.rtc.peerConnection.addTrack(track, stream)
          });
        })
        .catch(error => console.error(error));
      }

      sendICECandidate(event) {
        var self = this;

        if (event.candidate) {
          console.log('wclient->sendICECandidate() : sending new ICE candidate to peer');
          console.info(event.candidate);
          self.signaling.emit('webrtc-ice-candidate', event.candidate);
        }
      }

      addIceCandidate(candidate) {
        var self = this;

        console.log('wclient->addIceCandidate() : adding new candidate to peer connection');
        console.info(candidate);
        self.rtc.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
        .catch(error => console.error(error));
      }

      addRemoteStream() {
        var self = this;

        if ('srcObject' in self.rtc.remoteVideo) {
          self.rtc.remoteVideo.srcObject = event.stream;
        } else {
          self.rtc.remoteVideo.src = window.URL.createObjectURL(event.stream);
        }
        console.log('wclient->addRemoteStream() : attaching remote stream');
        console.info(event.stream);

        self.rtc.remoteVideo.onloadedmetadata = function(e) {
          self.rtc.remoteVideo.play();
        };
      }

      removeRemoteStream(event) {
        console.log('wclient->removeRemoteStream() : removing remote stream');
        console.info(event);
      }

      /*
      ** Describes the current state of the ICE agent and its connection to the ICE server
      */
      updateICEConnectionState(event) {
        var self = this;

        switch (event.currentTarget.iceConnectionState) {
          // The ICE agent is gathering addresses
          case "new":
            console.log('wclient->updateICEConnectionState() : state is now "new"');
            break;

          // The ICE agent is checking pairs of local and remote candidates
          // Gathering of candidates may still be underway
          case "checking":
            console.log('wclient->updateICEConnectionState() : state is now "checking"');
            break;

          // A usable pairing of local and remote candidates has been found.
          // Gathering of candidates may still be underway to find a better connection option
          case "connected":
            console.log('wclient->updateICEConnectionState() : state is now "connected"');
            self.updateState('ongoing');
            break;

          // The ICE agent has finished gathering candidates
          case "completed":
            console.log('wclient->updateICEConnectionState() : state is now "completed"');
            break;

          // The ICE agent has failed to find compatible matches
          case "failed":
            console.log('wclient->updateICEConnectionState() : state is now "failed"');
            self.updateState('failed');
            self.destroyPeerConnection();
            break;

          // Checks to ensure that components are still connected.
          // May trigger intermittently and resolve just as spontaneously or during temporary disconnections.
          // When the problem resolves, the connection may return to the "connected" state.
          case "disconnected":
            console.log('wclient->updateICEConnectionState() : state is now "disconnected"');
            self.updateState('reconnecting');
            break;

          // The ICE agent has shut down and is no longer handling requests
          case "closed":
            console.log('wclient->updateICEConnectionState() : state is now "closed"');
            self.updateState('ended');
            self.destroyPeerConnection();
            break;
        }
      }

      updateICEGatheringState(event) {
        console.log('wclient->updateICEGatheringState()', event);
      }

      /*
      ** Indicates where in the process of signaling the exchange of offer and answer the connection currently is
      */
      updateSignalingState(event) {
        switch (event.currentTarget.signalingState) {
          // No ongoing exchange of offer and answer underway.
          // Negotiation is complete and a connection has been established.
          case 'stable':
            console.log('wclient->updateSignalingState() : state is now "stable"');
            break;

          // The local peer has called RTCPeerConnection.setLocalDescription(), passing in SDP representing an offer (usually created by calling
          // RTCPeerConnection.createOffer()), and the offer has been applied successfully.
          case 'have-local-offer':
            console.log('wclient->updateSignalingState() : state is now "have-local-offer"');
            break;

          // The remote peer has created an offer and used the signaling server to deliver it to the local peer, which has set the offer as the
          // remote description by calling RTCPeerConnection.setRemoteDescription().
          case 'have-remote-offer':
            console.log('wclient->updateSignalingState() : state is now "have-remote-offer"');
            break;

          // The offer sent by the remote peer has been applied and an answer has been created (usually by calling RTCPeerConnection.createAnswer())
          // and applied by calling RTCPeerConnection.setLocalDescription(). This provisional answer describes the supported media formats and so forth,
          // but may not have a complete set of ICE candidates included. Further candidates will be delivered separately later.
          case 'have-local-pranswer':
            console.log('wclient->updateSignalingState() : state is now "have-local-pranswer"');
            break;

          // A provisional answer has been received and successfully applied in response to an offer previously sent and established by calling
          // setLocalDescription().
          case 'have-remote-pranswer':
            console.log('wclient->updateSignalingState() : state is now "have-remote-pranswer"');
            break;

          // The connection is closed.
          case 'closed':
            console.log('wclient->updateSignalingState() : state is now "closed"');
            break;

        }
      }

      createOffer() {
        var self = this;

        console.log('wclient->createOffer() : creating new offer');
        self.rtc.peerConnection.createOffer()
        .then(function(offer) {
          console.log('wclient->createOffer() : setting up local session description');
          return self.rtc.peerConnection.setLocalDescription(offer);
        })
        .then(function() {
          console.log('wclient->createOffer() : sending offer to peer');
          self.signaling.emit('webrtc-offer', self.rtc.peerConnection.localDescription);
        })
        .catch(error => console.error(error));
      }

      createAnswer(sdp) {
        var self = this;

        self.createPeerConnection('callee');

        console.log('wclient->createAnswer() : creating answer...');
        console.log('wclient->createAnswer() : setting up remote session description');
        self.rtc.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp))
        .then(function () {
          console.log('wclient->createAnswer() : getting access to devices');
          return navigator.mediaDevices.getUserMedia(self.rtc.mediaConstraints);
        })
        .then(function(stream) {
          console.log('wclient->createAnswer() : attaching local stream');
          console.info(stream);
          if ('srcObject' in self.rtc.localVideo) {
            self.rtc.localVideo.srcObject = stream;
          } else {
            self.rtc.localVideo.src = window.URL.createObjectURL(stream);
          }

          self.rtc.localVideo.onloadedmetadata = function(e) {
            self.rtc.localVideo.play();
          };

          console.log('wclient->createAnswer() : attaching local tracks');
          stream.getTracks().forEach(track => {
            console.info(track);
            self.rtc.peerConnection.addTrack(track, stream);
          });

          return Promise.resolve();
        })
        .then(function() {
          console.log('wclient->createAnswer() : creating a peer answer');
          return self.rtc.peerConnection.createAnswer();
        })
        .then(function(answer) {
          console.log('wclient->createAnswer() : setting up local session description');
          return self.rtc.peerConnection.setLocalDescription(answer);
        })
        .then(function() {
          console.log('wclient->createAnswer() : sending "webrtc-answer" message');
          self.signaling.emit('webrtc-answer', self.rtc.peerConnection.localDescription);
        })
        .catch(error => console.error(error));
      }

      setRemoteSessionDescription(sdp) {
        var self = this;

        console.log('wclient->setRemoteSessionDescription() : setting up remote session description');
        self.rtc.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp))
        .catch(error => console.error(error));
      }

      // Start playing rintone
      startRingtone() {
        var self = this;

        console.log('wclient->startRingtone() : starting ringtone loop');
        self.call.ringtone.addEventListener('ended', function() {
          this.currentTime = 0;
          this.play();
        }, false);
        self.call.ringtone.play();
      }

      // Stop playing rintone
      stopRingtone() {
        var self = this;

        console.log('wclient->stopRingtone() : stopping ringtone loop');
        self.call.ringtone.pause();
      }

      // Updates the app state
      updateState(state) {
        var self = this;

        switch(state) {
          // On "idle" either us or the peer can start a new call.
          case self.call.states.enum.idle.state:
            // Do nothing if the current state is the next state
            if (self.call.state === self.call.states.enum.idle.state) return ;

            console.info('wclient->updateState() : updating state from "' + self.call.state + '" to "' + state + '"');
            // Update internal state
            self.call.state = state;
            self.call.muted = false;

            // Update angular state
            $scope.call.state = state;
            $scope.call.message = self.call.states.enum.idle.message;

            // Stop and reset timer
            self.stopTimer();

            // Stop playing ringtone
            self.stopRingtone();
            break;

          // On "calling" we are waiting for the peer to answer our connection request
          case self.call.states.enum.calling.state:
            // Do nothing if the current state is the next state
            if (self.call.state === self.call.states.enum.calling.state) return ;

            console.info('wclient->updateState() : updating state from "' + self.call.state + '" to "' + state + '"');
            // Update internal state
            self.call.state = state;

            // Update angular state
            $scope.call.state = state;
            $scope.call.message = self.call.states.enum.calling.message;
            break;

          // On "ringing" we need to either accept or reject the peer connection request
          case self.call.states.enum.ringing.state:
            // Do nothing if the current state is the next state
            if (self.call.state === self.call.states.enum.ringing.state) return ;

            console.info('wclient->updateState() : updating state from "' + self.call.state + '" to "' + state + '"');
            // Update internal state
            self.call.state = state;

            // Update angular state
            $scope.call.state = state;
            $scope.call.message = self.call.states.enum.ringing.message;

            // Start playing ringtone
            self.startRingtone();
            break;

          // On "connecting" the call connection has been accepted, we can start the WebRTC connection proccess.
          case self.call.states.enum.connecting.state:
            // Do nothing if the current state is the next state
            if (self.call.state === self.call.states.enum.connecting.state) return ;

            console.info('wclient->updateState() : updating state from "' + self.call.state + '" to "' + state + '"');
            // Update internal state
            self.call.state = state;

            // Update angular state
            $scope.call.state = state;
            $scope.call.message = self.call.states.enum.connecting.message;

            // Stop playing ringtone
            self.stopRingtone();
            break;

          // On "reconnecting" we need to wait 3 seconds before killing the WebRTC connection.
          case self.call.states.enum.reconnecting.state:
            // Do nothing if the current state is the next state
            if (self.call.state === self.call.states.enum.reconnecting.state) return ;

            console.info('wclient->updateState() : updating state from "' + self.call.state + '" to "' + state + '"');
            // Update internal state
            self.call.state = state;

            // Update angular state
            $scope.call.state = state;
            $scope.call.message = self.call.states.enum.reconnecting.message;
            break;

          // On "ongoing" the WebRTC connection has been established.
          case self.call.states.enum.ongoing.state:
            // Do nothing if the current state is the next state
            if (self.call.state === self.call.states.enum.ongoing.state) return ;

            console.info('wclient->updateState() : updating state from "' + self.call.state + '" to "' + state + '"');
            // Update internal state
            self.call.state = state;

            // Update angular state
            $scope.call.state = state;
            $scope.call.message = self.call.states.enum.ongoing.message;

            // Start timer
            self.startTimer();
            break;

          // On "ended" the call has naturally ended with a hangup.
          case self.call.states.enum.ended.state:
            // Do nothing if the current state is the next state
            if (self.call.state === self.call.states.enum.ended.state) return ;

            console.info('wclient->updateState() : updating state from "' + self.call.state + '" to "' + state + '"');
            // Update internal state
            self.call.state = state;
            self.call.muted = false;

            // Update angular state
            $scope.call.state = state;
            $scope.call.message = self.call.states.enum.ended.message;

            // Stop and reset timer
            self.stopTimer();

            // Stop playing ringtone
            self.stopRingtone();
            break;

          // On "failed" the WebRTC connection proccess has failed or the ongoing call has failed due to network problems.
          case self.call.states.enum.failed.state:
            // Do nothing if the current state is the next state
            if (self.call.state === self.call.states.enum.failed.state) return ;

            console.info('wclient->updateState() : updating state from "' + self.call.state + '" to "' + state + '"');
            // Update internal state
            self.call.state = state;
            self.call.muted = false;

            // Update angular state
            $scope.call.state = state;
            $scope.call.message = self.call.states.enum.failed.message;

            // Stop and reset timer
            self.stopTimer();

            // Stop playing ringtone
            self.stopRingtone();
            break;

          // On "rejected" the peer has sent us a "call-reject" message.
          case self.call.states.enum.rejected.state:
            // Do nothing if the current state is the next state
            if (self.call.state === self.call.states.enum.rejected.state) return ;

            console.info('wclient->updateState() : updating state from "' + self.call.state + '" to "' + state + '"');
            // Update internal state
            self.call.state = state;
            self.call.muted = false;

            // Update angular state
            $scope.call.state = state;
            $scope.call.message = self.call.states.enum.rejected.message;
            break;

          // On "unknown" we just reset everything.
          default:
            console.info('wclient->updateState() : updating state from "' + self.call.state + '" to "idle" => "' + state + '(unknown)"');
            // Update internal state
            self.call.state = self.call.states.enum.idle.state;
            self.call.muted = false;

            // Update angular state
            $scope.call.state = self.call.states.enum.idle.state;
            $scope.call.message = self.call.states.enum.idle.message;

            // Stop and reset timer
            self.stopTimer();

            // Stop playing ringtone
            self.stopRingtone();
            break;
        }
      }

      // Converts the current call timer from an integer to a human readable format. For example from 70 to "01:10".
      convertTimerToHMS() {
        var self = this;
        var sec_num = parseInt(self.call.timer.counter, 10);
        var hours = Math.floor(sec_num / 3600);
        var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
        var seconds = sec_num - (hours * 3600) - (minutes * 60);

        if (hours < 10)
          hours = '0' + hours;
        if (minutes < 10)
          minutes = '0' + minutes;
        if (seconds < 10)
          seconds = '0' + seconds;

        if (hours == 0) {
          return minutes + ':' + seconds;
        } else {
          return hours + ':' + minutes + ':' + seconds;
        }
      }

      // Starts the current call timer.
      startTimer() {
        var self = this;

        if (self.call.timer.handle) {
          console.error('wclient->startTimer() : Cannot start timer handle is already set');
          return ;
        }
        self.call.timer.handle = $interval(function() {
          self.call.timer.counter += 1;
          $scope.call.timer = self.convertTimerToHMS();
        }, 1000);
        console.log('wclient->startTimer() : timer started');
      }

      // Stops and resets the current call timer.
      stopTimer() {
        var self = this;

        if (!self.call.timer.handle) {
          console.error('wclient->stopTimer() : Cannot stop timer handle is not set');
          return ;
        }
        $interval.cancel(self.call.timer.handle);
        self.call.timer.handle = null;
        self.call.timer.counter = 0;
        $scope.call.timer = '00:00';
        console.log('wclient->stopTimer() : timer stopped');
      }

      // Sends a call invitation to peer and waits for a "call-accept" or "call-reject" message from the signaling server.
      inviteCall() {
        console.log('wclient->inviteCall() : "call-invite" message sent');
        var self = this;

        self.signaling.emit('call-invite');
        self.updateState('calling');
      }

      makeCall() {
        var self = this;

        self.createPeerConnection();
        self.getMediaAccess();
      }

      // Hangs up the current call, kills the webrtc connection if one exists and notifies the peer by sending a "call-hangup" message.
      hangupCall() {
        console.log('wclient->hangupCall() : "call-hangup" message sent');
        var self = this;

        self.signaling.emit('call-hangup');
        self.updateState('ended');
        self.destroyPeerConnection();
      }

      // Sends an "accept-call" message to peer so he can start the WebRTC connection proccess.
      acceptCall() {
        console.log('wclient->acceptCall() : "call-accept" message sent');
        var self = this;

        self.signaling.emit('call-accept');
        self.updateState('connecting');
      }

      // Sends an "call-reject" message to peer.
      rejectCall() {
        console.log('wclient->rejectCall() : "call-reject" message sent');
        var self = this;

        self.signaling.emit('call-reject');
        self.updateState('idle');
      }

      // Toggles muting / unmuting microphone
      toggleMuteCall() {
        this.rtc.localVideo.srcObject.getAudioTracks()[0].enabled = this.call.muted;
        this.call.muted = !this.call.muted;
        $scope.call.muted = this.call.muted;

        if (this.call.muted) {
          console.log('wclient->toggleMuteCall() : call muted');
        } else {
          console.log('wclient->toggleMuteCall() : call unmuted');
        }
      }

      // Rates the last call on a scale from 1 to 5
      rateCall(rate) {
        if (rate > 0 && rate <= 5) {
          console.log('wclient->rateCall() : rate value "' + rate + '"');
          this.call.rate = rate;
        } else {
          console.log('wclient->rateCall() : invalid rate value "' + rate + '"');
        }
        this.updateState('idle');
      }

      // Sends a push message
      sendPush() {
        if ($scope.push.outgoing.content) {
          console.log('wclient->sendPush() : "user-message" message sent');
          this.signaling.emit('user-message', $scope.push.outgoing.content);
          $scope.push.outgoing.content = '';
          $scope.push.outgoing.show = false;
        }
      }

      // Create signaling endpoints for socket server
      createSignalingEndpoints() {
        // Incoming message either from server or from peer
        this.signaling.on('user-message', (message) => {
          console.log('wclient->signaling() : "user-message" message received');
          $scope.push.incoming.from = message.from;
          $scope.push.incoming.content = message.content;
          $scope.push.incoming.show = true;
          $timeout(function() {
          	$scope.push.incoming.show = false;
          }, 5000);
        });

        // Peer is connected to the room
        this.signaling.on('user-connect', () => {
          console.log('wclient->signaling() : "user-connect" message received');
          this.rtc.paired = true;
          $scope.call.paired = true;
        });

        // Peer is disconnected from the room
        this.signaling.on('user-disconnect', () => {
          console.log('wclient->signaling() : "user-disconnect" message received');
          this.rtc.paired = false;
          $scope.call.paired = false;
          this.updateState('failed');
          this.destroyPeerConnection();
        });

        // Peer is sending us an invitation to accept the call.
        this.signaling.on('call-invite', () => {
          console.log('wclient->signaling() : "call-invite" message received');
          this.updateState('ringing');
        });

        // Peer has accepted the incoming call, the webrtc connection process can now start.
        this.signaling.on('call-accept', () => {
          console.log('wclient->signaling() : "call-accept" message received');
          this.updateState('connecting');
          this.makeCall();
        });

        // Peer has rejected our call invitation.
        this.signaling.on('call-reject', () => {
          console.log('wclient->signaling() : "call-reject" message received');
          this.updateState('rejected');
        });

        // Peer has hanged up the call.
        this.signaling.on('call-hangup', () => {
          console.log('wclient->signaling() : "call-hangup" message received');
          this.updateState('ended');
          this.destroyPeerConnection();
        });

        // Peer has sent us a new ICE candidate to be added to our peer connection.
        this.signaling.on('webrtc-ice-candidate', (candidate) => {
          console.log('wclient->signaling() : "webrtc-ice-candidate" message received');
          this.addIceCandidate(candidate);
        });

        // Peer has sent us his local session description to be added to our peer connection.
        // This is an offer so we need to respond with an answer.
        this.signaling.on('webrtc-offer', (sdp) => {
          console.log('wclient->signaling() : "webrtc-offer" message received');
          this.createAnswer(sdp);
        });

        // Peer has sent us his local session description to be added to our peer connection.
        // This is an answer to the offer we sent.
        this.signaling.on('webrtc-answer', (sdp) => {
          console.log('wclient->signaling() : "webrtc-answer" message received');
          this.setRemoteSessionDescription(sdp);
        });

        this.signaling.on('disconnect', function() {
          $scope.isLoggedIn = false;
          this.updateState('ended');
          this.destroyPeerConnection();
        });
      }
    }

    var wclient = new WebcallClient(socket);

    wclient.createSignalingEndpoints();

    $scope.isLoggedIn = false;

    // Setup call informations
    $scope.call = {
      state: wclient.call.state,
      message: wclient.call.states.enum[wclient.call.state].message,
      timer: '00:00',
      muted: wclient.call.muted,
      paired: wclient.call.paired,
      username: ''
    };

    // Push notifications
    $scope.push = {
      handle: null,
      incoming: {
        show: false,
        from: '',
        content: ''
      },
      outgoing: {
        show: false,
        from: '',
        content: ''
      }
    };

    // Keypad for login
    $scope.keypad = {
      secret: '',
      title: 'Enter your access code'
    };

    $scope.keypad.reset = function() {
      $scope.keypad.title = 'Enter your access code';
      $scope.keypad.secret = '';
    };

    $scope.keypad.click = function(num) {
      var url = $location.absUrl().split('/');

      if ($scope.keypad.secret.length == 0 || $scope.keypad.secret.length == 6) {
        $scope.keypad.reset();
      }

      $scope.keypad.secret += num;

      if ($scope.keypad.secret.length == 6) {
        $http({
          method: 'POST',
          url: 'https://192.168.1.26:3000/api/conference/login',
          data: {
            token: url[url.length - 1],
            accessCode: parseInt($scope.keypad.secret)
          }
        })
        .then(result => {
          $scope.isLoggedIn = true;
          $scope.call.username = (result.data.role == 'host') ? result.data.guestName : result.data.hostName;
          socket.emit('user-login', result.data);
        })
        .catch(error => {
          $scope.keypad.title = 'Invalid access code';
        });
      }
    };

    // Setup call handlers
    $scope.inviteCall = wclient.inviteCall.bind(wclient);
    $scope.hangupCall = wclient.hangupCall.bind(wclient);
    $scope.acceptCall = wclient.acceptCall.bind(wclient);
    $scope.rejectCall = wclient.rejectCall.bind(wclient);
    $scope.toggleMuteCall = wclient.toggleMuteCall.bind(wclient);
    $scope.rateCall = wclient.rateCall.bind(wclient);
    $scope.sendPush = wclient.sendPush.bind(wclient);

  });
})();
