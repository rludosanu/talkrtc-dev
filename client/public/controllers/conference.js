(function() {
  var app = angular.module('app', []);

  app.controller('conferenceCreate', function($scope, $http, $window, $location) {
    var getClientServer = function() {
      var scripts = document.getElementsByTagName('script');

      for (var i = 0 ; i < scripts.length ; i++) {
        var url = scripts[i].getAttribute('client-server');

        if (url) {
          return url;
        }
      }
    };

    var formatDatetime = function(datetime) {
      var d = new Date(datetime);
      var f = function(s) {
        s = s.toString();
        return (s.length == 1) ? '0' + s : s;
      }
      var dt = {
        y: d.getFullYear(),
        m: f(d.getMonth() + 1),
        d: f(d.getDate()),
        h: f(d.getHours()),
        i: f(d.getMinutes())
      };

      return `${dt.y}-${dt.m}-${dt.d} ${dt.h}:${dt.i}:00`;
    }

    $scope.conference = {
      datetime: '',
      host: {
        email: '',
        name: ''
      },
      guest: {
        email: '',
        name: ''
      },
      created: false
    };

    $scope.submit = function() {
      $http({
        method: 'POST',
        url: 'https://' + getClientServer() + '/api/conference',
        data: {
          date: formatDatetime($scope.conference.datetime),
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
