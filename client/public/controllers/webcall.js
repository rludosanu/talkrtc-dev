(function() {
  var app = angular.module('app', ['ngCookies', 'ngAnimate']);

  var getServer = function(type) {
    var scripts = document.getElementsByTagName('script');

    for (var i = 0 ; i < scripts.length ; i++) {
      var url = scripts[i].getAttribute(type + '-server');

      if (url) {
        return url;
      }
    }
  };

  // Angular factory for socket.io defined as "socket"
  app.factory('socket', function ($rootScope) {
    var socket = io('https://' + getServer('signaling') + '/webcall');

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
          state: 'waiting',
          states: {
            enum: {
              waiting: {
                message: 'Waiting for your correspondant to connect.',
                state: 'waiting'
              },
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

      /*
      ** NAME
      **    createPeerConnection
      **
      ** DESCRIPTION
      **    Create a new RTCPeerConnection object.
      */
      createPeerConnection(role = 'caller') {
        console.log('createPeerConnection() : (' + role + ') Creating new RTCPeerConnection');
        var self = this;

        if (self.rtc.peerConnection) {
          console.log('createPeerConnection() : (' + role + ') RTCPeerConnection object already set');
          return false;
        }

        self.rtc.peerConnection = new RTCPeerConnection({
          iceServers: self.rtc.iceServers
        });

        // console.info(self.rtc.peerConnection);
        console.log('createPeerConnection() : Setting up RTCPeerConnection handlers');

        self.rtc.peerConnection.onicecandidate = self.sendICECandidate.bind(self);
        self.rtc.peerConnection.onaddstream = self.addRemoteStream.bind(self);
        self.rtc.peerConnection.onremovestream = self.removeRemoteStream.bind(self);
        self.rtc.peerConnection.oniceconnectionstatechange = self.updateICEConnectionState.bind(self);
        self.rtc.peerConnection.onicegatheringstatechange = self.updateICEGatheringState.bind(self);
        self.rtc.peerConnection.onsignalingstatechange = self.updateSignalingState.bind(self);
        if (role == 'caller') {
          self.rtc.peerConnection.onnegotiationneeded = self.createOffer.bind(self);
        } else {
          self.rtc.peerConnection.onnegotiationneeded = null;
        }

        return true;
      }

      /*
      ** NAME
      **    destroyPeerConnection
      **
      ** DESCRIPTION
      **    Destroy RTCPeerConnection object and stop streams / tracks attached to html videos tags.
      */
      destroyPeerConnection() {
        var self = this;

        if (self.rtc.localVideo.srcObject) {
          self.rtc.localVideo.srcObject.getTracks().forEach(track => track.stop());
          self.rtc.localVideo.srcObject = null;
          console.log('destroyPeerConnection() : Local audio/video stream stopped');
        }

        if (self.rtc.remoteVideo.srcObject) {
          self.rtc.remoteVideo.srcObject.getTracks().forEach(track => track.stop());
          self.rtc.remoteVideo.srcObject = null;
          console.log('destroyPeerConnection() : Remote audio/video stream stopped');
        }

        if (self.rtc.peerConnection) {
          self.rtc.peerConnection.close();
          self.rtc.peerConnection = null;
          console.log('destroyPeerConnection() : RTCPeerConnection closed');
        }
      }

      /*
      ** NAME
      **    getMediaAccess
      **
      ** DESCRIPTION
      **    Request local microphone and camera access.
      */
      getMediaAccess() {
        var self = this;

        console.log('getMediaAccess() : Requesting local microphone and camera access');
        navigator.mediaDevices.getUserMedia(self.rtc.mediaConstraints)
        .then(function(stream) {
          console.log('getMediaAccess() : Attaching local stream');
          // console.info(stream);
          if ('srcObject' in self.rtc.localVideo) {
            self.rtc.localVideo.srcObject = stream;
          } else {
            self.rtc.localVideo.src = window.URL.createObjectURL(stream);
          }

          self.rtc.localVideo.onloadedmetadata = function(e) {
            self.rtc.localVideo.play();
          };

          console.log('getMediaAccess() : Attaching local tracks');
          stream.getTracks().forEach(track => {
            // console.info(track);
            self.rtc.peerConnection.addTrack(track, stream)
          });
        })
        .catch(error => console.error(error));
      }

      /*
      ** NAME
      **    sendICECandidate
      **
      ** DESCRIPTION
      **    Send new ICE candidate found by the ICE framework to peer.
      */
      sendICECandidate(event) {
        var self = this;

        if (event.candidate) {
          console.log('sendICECandidate() : Sending ICE candidate to peer');
          // console.info(event.candidate);
          self.signaling.emit('webrtc-ice-candidate', event.candidate);
        }
      }

      /*
      ** NAME
      **    addIceCandidate
      **
      ** DESCRIPTION
      **    Add new ICE candidate to RTCPeerConnection send by peer.
      */
      addIceCandidate(candidate) {
        var self = this;

        console.log('addIceCandidate() : Adding ICE candidate to RTCPeerConnection');
        // console.info(candidate);
        self.rtc.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
        .catch(error => console.error(error));
      }

      /*
      ** NAME
      **    addRemoteStream
      **
      ** DESCRIPTION
      **    Attach peer stream to remote video tag.
      */
      addRemoteStream(event) {
        var self = this;

        console.log('addRemoteStream() : Attaching remote stream');
        // console.info(event.stream);

        if ('srcObject' in self.rtc.remoteVideo) {
          self.rtc.remoteVideo.srcObject = event.stream;
        } else {
          self.rtc.remoteVideo.src = window.URL.createObjectURL(event.stream);
        }

        self.rtc.remoteVideo.onloadedmetadata = function(e) {
          self.rtc.remoteVideo.play();
        };
      }

      /*
      ** NAME
      **    removeRemoteStream
      **
      ** DESCRIPTION
      **   Remove peer stream from remote video tag.
      */
      removeRemoteStream(event) {
        console.log('removeRemoteStream() : Removing remote stream');
        // console.info(event);
      }

      /*
      ** NAME
      **    updateICEConnectionState
      **
      ** DESCRIPTION
      **   Describe the current state of the ICE agent and its connection to the ICE server.
      */
      updateICEConnectionState(event) {
        var self = this;

        switch (event.currentTarget.iceConnectionState) {
          // ICE agent is gathering addresses.
          case "new":
            console.log('ICE Connection State => "new"');
            break;

          // ICE agent is checking pairs of local and remote candidates.
          case "checking":
            console.log('ICE Connection State => "checking"');
            break;

          // A usable pairing of local and remote candidates has been found.
          case "connected":
            console.log('ICE Connection State => "connected"');
            self.updateState('ongoing');
            break;

          // ICE agent has finished gathering candidates.
          case "completed":
            console.log('ICE Connection State => "completed"');
            break;

          // ICE agent has failed to find compatible matches.
          case "failed":
            console.log('ICE Connection State => "failed"');

            self.updateState('failed');
            self.destroyPeerConnection();
            break;

          // Checks to ensure that components are still connected.
          // May trigger intermittently and resolve just as spontaneously or during temporary disconnections.
          // When the problem resolves, the connection may return to the "connected" state.
          case "disconnected":
            console.log('ICE Connection State => "disconnected"');

            self.updateState('reconnecting');
            break;

          // ICE agent has shut down and is no longer handling requests.
          case "closed":
            console.log('ICE Connection State => "closed"');

            self.updateState('ended');
            self.destroyPeerConnection();
            break;
        }
      }

      /*
      ** NAME
      **    updateICEGatheringState
      */
      updateICEGatheringState(event) {
        console.log('updateICEGatheringState()');
      }

      /*
      ** NAME
      **    updateSignalingState
      **
      ** DESCRIPTION
      **   Indicates where the process of offer and answer currently is.
      */
      updateSignalingState(event) {
        switch (event.currentTarget.signalingState) {
          // No ongoing exchange of offer and answer underway.
          // Negotiation is complete and a connection has been established.
          case 'stable':
            console.log('Signaling State => "stable"');
            break;

          // The local peer has called RTCPeerConnection.setLocalDescription(), passing in SDP representing an offer (usually created by calling
          // RTCPeerConnection.createOffer()), and the offer has been applied successfully.
          case 'have-local-offer':
            console.log('Signaling State => "have-local-offer"');
            break;

          // The remote peer has created an offer and used the signaling server to deliver it to the local peer, which has set the offer as the
          // remote description by calling RTCPeerConnection.setRemoteDescription().
          case 'have-remote-offer':
            console.log('Signaling State => "have-remote-offer"');
            break;

          // The offer sent by the remote peer has been applied and an answer has been created (usually by calling RTCPeerConnection.createAnswer())
          // and applied by calling RTCPeerConnection.setLocalDescription(). This provisional answer describes the supported media formats and so forth,
          // but may not have a complete set of ICE candidates included. Further candidates will be delivered separately later.
          case 'have-local-pranswer':
            console.log('Signaling State => "have-local-pranswer"');
            break;

          // A provisional answer has been received and successfully applied in response to an offer previously sent and established by calling
          // setLocalDescription().
          case 'have-remote-pranswer':
            console.log('Signaling State => "have-remote-pranswer"');
            break;

          // The connection is closed.
          case 'closed':
            console.log('Signaling State => "closed"');
            break;

        }
      }

      /*
      ** NAME
      **    createOffer
      **
      ** DESCRIPTION
      **   Create a new SDP offer.
      */
      createOffer() {
        var self = this;

        console.log('createOffer() : Creating new SDP offer');
        self.rtc.peerConnection.createOffer()
        .then(function(offer) {
          console.log('createOffer() : Attaching local SDP');
          return self.rtc.peerConnection.setLocalDescription(offer);
        })
        .then(function() {
          console.log('createOffer() : Sending local SDP to peer');
          self.signaling.emit('webrtc-offer', self.rtc.peerConnection.localDescription);
        })
        .catch(error => console.error(error));
      }

      /*
      ** NAME
      **    createAnswer
      **
      ** DESCRIPTION
      **   Create a new SDP answer.
      */
      createAnswer(sdp) {
        var self = this;

        self.createPeerConnection('callee');

        console.log('createAnswer() : Attaching remote SDP');
        self.rtc.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp))
        .then(function () {
          console.log('getMediaAccess() : Requesting local microphone and camera access');
          return navigator.mediaDevices.getUserMedia(self.rtc.mediaConstraints);
        })
        .then(function(stream) {
          console.log('createAnswer() : Attaching local stream');
          // console.info(stream);
          if ('srcObject' in self.rtc.localVideo) {
            self.rtc.localVideo.srcObject = stream;
          } else {
            self.rtc.localVideo.src = window.URL.createObjectURL(stream);
          }

          self.rtc.localVideo.onloadedmetadata = function(e) {
            self.rtc.localVideo.play();
          };

          console.log('createAnswer() : Attaching local tracks');
          stream.getTracks().forEach(track => {
            // console.info(track);
            self.rtc.peerConnection.addTrack(track, stream);
          });

          return Promise.resolve();
        })
        .then(function() {
          console.log('createAnswer() : Creating new SDP answer');
          return self.rtc.peerConnection.createAnswer();
        })
        .then(function(answer) {
          console.log('createAnswer() : Attaching local SDP answer');
          return self.rtc.peerConnection.setLocalDescription(answer);
        })
        .then(function() {
          console.log('createAnswer() : Sending SDP answer to peer');
          self.signaling.emit('webrtc-answer', self.rtc.peerConnection.localDescription);
        })
        .catch(error => console.error(error));
      }

      /*
      ** NAME
      **    setRemoteSessionDescription
      **
      ** DESCRIPTION
      **   Attaching SDP answer from peer.
      */
      setRemoteSessionDescription(sdp) {
        var self = this;

        console.log('setRemoteSessionDescription() : Attaching remote SDP answer');
        self.rtc.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp))
        .catch(error => console.error(error));
      }

      /*
      ** NAME
      **    startRingtone
      **
      ** DESCRIPTION
      **   Play ringtone sound.
      */
      startRingtone() {
        var self = this;

        console.log('startRingtone() : Playing ringtone');
        self.call.ringtone.addEventListener('ended', function() {
          this.currentTime = 0;
          this.play();
        }, false);
        self.call.ringtone.play();
      }

      /*
      ** NAME
      **    stopRingtone
      **
      ** DESCRIPTION
      **   Stop ringtone sound.
      */
      stopRingtone() {
        var self = this;

        console.log('stopRingtone() : Stopping ringtone');
        self.call.ringtone.pause();
      }

      /*
      ** NAME
      **    updateState
      **
      ** DESCRIPTION
      **   Update the app internal state and the angular view.
      */
      updateState(state) {
        var self = this;

        // "waiting" => In waiting for the peer connection or login
        if (state == self.call.states.enum.waiting.state) {
          if (self.call.state === self.call.states.enum.waiting.state) {
            return ;
          }
          console.info('updateState() : Updating state from "' + self.call.state + '" to "' + state + '"');

          self.call.state = state;
          self.call.muted = false;

          self.stopTimer();
          self.stopRingtone();

          $scope.call.state = state;
          $scope.call.message = self.call.states.enum.waiting.message;
        }
        // "idle" => Both peers are connected
        else if (state == self.call.states.enum.idle.state) {
          if (self.call.state === self.call.states.enum.idle.state) {
            return ;
          }
          console.info('updateState() : Updating state from "' + self.call.state + '" to "' + state + '"');

          self.call.state = state;
          self.call.muted = false;

          self.stopTimer();
          self.stopRingtone();

          $scope.call.state = state;
          $scope.call.message = self.call.states.enum.idle.message;
        }
        // "calling" => Waiting for the peer to accept or reject the call
        else if (state == self.call.states.enum.calling.state) {
          if (self.call.state === self.call.states.enum.calling.state) {
            return ;
          }
          console.info('updateState() : Updating state from "' + self.call.state + '" to "' + state + '"');

          self.call.state = state;

          $scope.call.state = state;
          $scope.call.message = self.call.states.enum.calling.message;
        }
        // "ringing" => Either accept or reject the incoming call
        else if (state == self.call.states.enum.ringing.state) {
          if (self.call.state === self.call.states.enum.ringing.state) {
            return ;
          }
          console.info('updateState() : Updating state from "' + self.call.state + '" to "' + state + '"');

          self.call.state = state;
          self.startRingtone();

          $scope.call.state = state;
          $scope.call.message = self.call.states.enum.ringing.message;
          $scope.push.outgoing.show = false;
        }
        // "connecting" => The call has been accepted WebRTC can connect
        else if (state == self.call.states.enum.connecting.state) {
          if (self.call.state === self.call.states.enum.connecting.state) {
            return ;
          }
          console.info('updateState() : Updating state from "' + self.call.state + '" to "' + state + '"');

          self.call.state = state;
          self.stopRingtone();

          $scope.call.state = state;
          $scope.call.message = self.call.states.enum.connecting.message;
        }
        // "reconnecting" => WebRTC is trying to reconnect
        else if (state == self.call.states.enum.reconnecting.state) {
          if (self.call.state === self.call.states.enum.reconnecting.state) {
            return ;
          }
          console.info('updateState() : Updating state from "' + self.call.state + '" to "' + state + '"');

          self.call.state = state;

          $scope.call.state = state;
          $scope.call.message = self.call.states.enum.reconnecting.message;
        }
        // "ongoing" => WebRTC has connected
        else if (state == self.call.states.enum.ongoing.state) {
          if (self.call.state === self.call.states.enum.ongoing.state) {
            return ;
          }
          console.info('updateState() : Updating state from "' + self.call.state + '" to "' + state + '"');

          self.call.state = state;
          self.startTimer();

          $scope.call.state = state;
          $scope.call.message = self.call.states.enum.ongoing.message;
        }
        // "ended" => Normal WebRTC termination
        else if (state == self.call.states.enum.ended.state) {
          if (self.call.state === self.call.states.enum.ended.state) {
            return ;
          }
          console.info('updateState() : Updating state from "' + self.call.state + '" to "' + state + '"');

          self.call.state = state;
          self.stopTimer();
          self.stopRingtone();

          $scope.call.state = state;
          $scope.call.message = self.call.states.enum.ended.message;
        }
        // "failed" => WebRTC connection failed due to network problems
        else if (state == self.call.states.enum.failed.state) {
          if (self.call.state === self.call.states.enum.failed.state) {
            return ;
          }
          console.info('updateState() : Updating state from "' + self.call.state + '" to "' + state + '"');

          self.call.state = state;
          self.call.muted = false;
          self.stopTimer();

          $scope.call.state = state;
          $scope.call.message = self.call.states.enum.failed.message;
        }
        // "rejected" => Peer rejected the call
        else if (state == self.call.states.enum.rejected.state) {
          if (self.call.state === self.call.states.enum.rejected.state) {
            return ;
          }
          console.info('updateState() : Updating state from "' + self.call.state + '" to "' + state + '"');

          self.call.state = state;

          $scope.call.state = state;
          $scope.call.message = self.call.states.enum.rejected.message;
        }
        // "unknown" => Reset to "idle" state
        else {
          console.info('updateState() : Updating state from "' + self.call.state + '" to "idle" => "' + state + '(unknown)"');
          self.updateState('idle');
        }
      }

      /*
      ** NAME
      **    convertTimerToHMS
      **
      ** DESCRIPTION
      **    Converts call timer from integer to "HH:MM:SS" format
      */
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

        if (hours == 0)
          return minutes + ':' + seconds;
        else
          return hours + ':' + minutes + ':' + seconds;
      }

      /*
      ** NAME
      **    startTimer
      **
      ** DESCRIPTION
      **    Starts the call timer.
      */
      startTimer() {
        var self = this;

        if (self.call.timer.handle)
          return ;

        console.log('startTimer() : Starting call timer');
        self.call.timer.handle = $interval(function() {
          self.call.timer.counter += 1;
          $scope.call.timer = self.convertTimerToHMS();
        }, 1000);
      }

      /*
      ** NAME
      **    stopTimer
      **
      ** DESCRIPTION
      **    Stops and resets the call timer.
      */
      stopTimer() {
        var self = this;

        if (!self.call.timer.handle)
          return ;

        console.log('stopTimer() : Call timer stopped');
        $interval.cancel(self.call.timer.handle);
        self.call.timer.handle = null;
        self.call.timer.counter = 0;
        $scope.call.timer = '00:00';
      }

      /*
      ** NAME
      **    inviteCall
      **
      ** DESCRIPTION
      **    Sends a call invitation to peer and waits for a "call-accept" or "call-reject" message from the signaling server.
      */
      inviteCall() {
        var self = this;

        console.log('inviteCall() : Sending a "call-invite" message');

        self.updateState('calling');
        self.signaling.emit('call-invite');
      }

      /*
      ** NAME
      **    makeCall
      **
      ** DESCRIPTION
      **    Start WebRTC peer connection proccess.
      */
      makeCall() {
        var self = this;

        console.log('makeCall() : Making a new call');
        self.createPeerConnection();
        self.getMediaAccess();
      }

      /*
      ** NAME
      **    hangupCall
      **
      ** DESCRIPTION
      **    Hang up the current call. Kill the WebRTC connection if it exists
      **    and notify the peer by sending a "call-hangup" message.
      */
      hangupCall() {
        var self = this;

        console.log('hangupCall() : Hanging up current call');

        self.signaling.emit('call-hangup');
        self.updateState('ended');
        self.destroyPeerConnection();
      }

      /*
      ** NAME
      **    acceptCall
      **
      ** DESCRIPTION
      **    Send a "accept-call" message to peer.
      */
      acceptCall() {
        var self = this;

        console.log('acceptCall() : Incoming call accepted');
        self.signaling.emit('call-accept');
        self.updateState('connecting');
      }

      /*
      ** NAME
      **    rejectCall
      **
      ** DESCRIPTION
      **    Send a "reject-call" message to peer.
      */
      rejectCall() {
        var self = this;

        console.log('acceptCall() : Incoming call rejected');
        self.signaling.emit('call-reject');
        self.updateState('idle');
      }

      /*
      ** NAME
      **    toggleMuteCall
      **
      ** DESCRIPTION
      **    Mute or unmute local microphone.
      */
      toggleMuteCall() {
        if (!this.call.muted) {
          console.log('toggleMuteCall() : Local microphone muted');
        } else {
          console.log('toggleMuteCall() : Local microphone unmuted');
        }

        this.rtc.localVideo.srcObject.getAudioTracks()[0].enabled = this.call.muted;
        this.call.muted = !this.call.muted;

        $scope.call.muted = this.call.muted;
      }

      /*
      ** NAME
      **    rateCall
      **
      ** DESCRIPTION
      **    Rate the call on a 1-5 scale.
      */
      rateCall(rate) {
        if (rate > 0 && rate <= 5) {
          console.log('rateCall() : Call rate value: "' + rate + '"');
          this.call.rate = rate;
        } else {
          console.error('rateCall() : Error. Invalid call rate value: "' + rate + '"');
        }

        this.updateState('idle');
      }

      /*
      ** NAME
      **    sendPush
      **
      ** DESCRIPTION
      **    Send a push message.
      */
      sendPush() {
        if ($scope.push.outgoing.content) {
          console.log('sendPush() : "user-message" message sent');
          this.signaling.emit('user-message', $scope.push.outgoing.content);
          $scope.push.outgoing.content = '';
          $scope.push.outgoing.show = false;
        }
      }

      /*
      ** NAME
      **    login
      **
      ** DESCRIPTION
      **    Log in the signaling server.
      */
      login(datas) {
        this.signaling.emit('user-login', datas);
      }

      /*
      ** NAME
      **    createSignalingEndpoints
      **
      ** DESCRIPTION
      **    Create endpoints for signaling server incoming messages.
      */
      createSignalingEndpoints() {
        var self = this;

        // Incoming push notification from server or user
        self.signaling.on('user-message', function(message) {
          console.log('signaling() : Received "user-message"');

          $scope.push.incoming.from = message.from;
          $scope.push.incoming.content = message.content;
          $scope.push.incoming.show = true;

          $timeout(function() {
          	$scope.push.incoming.show = false;
          }, 5000);
        });

        // Peer is connected
        self.signaling.on('user-connect', function() {
          console.log('signaling() : Received "user-connect"');

          self.updateState('idle');
          self.rtc.paired = true;

          $scope.logged.remote = true;
        });

        // Peer is disconnected
        self.signaling.on('user-disconnect', function() {
          console.log('signaling() : Received "user-disconnect"');

          self.rtc.paired = false;
          self.updateState('waiting');
          self.destroyPeerConnection();

          $scope.logged.remote = false;
        });

        // Incoming call invitation
        self.signaling.on('call-invite', function() {
          console.log('signaling() : Received "call-invite"');

          self.updateState('ringing');
        });

        // Call invitation accepted
        self.signaling.on('call-accept', function() {
          console.log('signaling() : Received "call-accept"');

          self.updateState('connecting');
          self.makeCall();
        });

        // Call invitation rejected
        self.signaling.on('call-reject', function() {
          console.log('signaling() : Received "call-reject"');

          self.updateState('rejected');
        });

        // Peer has hanged up the call.
        self.signaling.on('call-hangup', function() {
          console.log('signaling() : Received "call-hangup"');

          self.updateState('ended');
          self.destroyPeerConnection();
        });

        // Peer ICE candidate
        self.signaling.on('webrtc-ice-candidate', function(candidate) {
          console.log('signaling() : Received "webrtc-ice-candidate"');

          self.addIceCandidate(candidate);
        });

        // Peer SDP offer
        self.signaling.on('webrtc-offer', function(sdp) {
          console.log('signaling() : Received "webrtc-offer"');
          console.log(sdp);

          self.createAnswer(sdp);
        });

        // Peer SDP answer
        self.signaling.on('webrtc-answer', function(sdp) {
          console.log('signaling() : Received "webrtc-answer"');

          self.setRemoteSessionDescription(sdp);
        });

        // Disconnection
        self.signaling.on('disconnect', function() {
          self.updateState('ended');
          self.destroyPeerConnection();

          $scope.logged.local = false;
        });
      }
    }

    var wclient = new WebcallClient(socket);

    wclient.createSignalingEndpoints();

    // User
    $scope.logged = {
      local: false,
      remote: false
    };

    // Setup call informations
    $scope.call = {
      state: 'waiting',
      message: wclient.call.states.enum['waiting'].message,
      timer: '00:00',
      muted: false,
      paired: false,
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
      message: 'Enter your access code',
      reset: function() {
        this.message = 'Enter your access code';
        this.secret = '';
      },
      click: function(number) {
        var self = this;
        var url = $location.absUrl().split('/');

        if (self.secret.length == 0 || self.secret.length == 6)
          self.reset();

        self.secret += number;

        if (self.secret.length == 6) {
          $http({
            method: 'POST',
            url: 'https://' + getServer('client') + '/api/conference/login',
            data: {
              token: url[url.length - 1],
              accessCode: parseInt(self.secret)
            }
          })
          .then((result) => {
            $scope.logged.local = true;
            $scope.call.username = (result.data.role == 'host') ? result.data.guestName : result.data.hostName;
            wclient.login(result.data);
          })
          .catch((error) => {
            self.message = 'Invalid access code';
          });
        }
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
