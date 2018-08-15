(function() {
  var app = angular.module('app', []);

  app.controller('conferenceCreate', function($scope, $http, $window, $location) {
    var formatDatetime = function(date, time) {
      var d = new Date(date);
      var t = new Date(time);
      var f = function(s) {
        s = s.toString();
        return (s.length == 1) ? '0' + s : s;
      }
      var dt = {
        y: d.getFullYear(),
        m: f(d.getMonth() + 1),
        d: f(d.getDate()),
        h: f(t.getHours()),
        i: f(t.getMinutes())
      };

      return `${dt.y}-${dt.m}-${dt.d} ${dt.h}:${dt.i}:00`;
    }

    $scope.conference = {
      date: '',
      time: '',
      host: {
        email: 'talkrtc@gmail.com',
        name: 'TalkRTC Team'
      },
      guest: {
        email: 'r.ludosanu@gmail.com',
        name: 'Razvan Ludosanu'
      },
      created: false
    };

    $scope.submit = function() {
      $http({
        method: 'POST',
        url: 'https://192.168.1.26:3000/api/conference',
        data: {
          date: formatDatetime($scope.conference.date, $scope.conference.time),
          hostEmail: $scope.conference.host.email,
          hostName: $scope.conference.host.name,
          guestEmail: $scope.conference.guest.email,
          guestName: $scope.conference.guest.name
        }
      })
      .then(result => {
        $scope.conference.created = true;
      })
      .catch(error => {
        console.log(error);
      });
    }
  });
})();
