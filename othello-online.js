angular.module('OthelloOnline', ['ngRoute', 'firebase'])
.value('fbUrl', 'https://brilliant-inferno-6551.firebaseio.com/')
.service('fbRef', function (fbUrl) {
  return new Firebase(fbUrl)
})
.service('fbAuth', function ($q, $firebase, $firebaseAuth, fbRef) {
  var auth;
  return function (mode) {
    if (mode === 'signOut') {
      auth = null;
      $firebaseAuth(fbRef).$unauth();
      return;
    }

    if (auth)
      return $q.when(auth);

    var authObj = $firebaseAuth(fbRef);
    auth = authObj.$getAuth();
    if (auth)
      return $q.when(auth);

    if (mode === 'check')
      return $q.when(null);

    var deferred = $q.defer();
    authObj.$authWithOAuthPopup('twitter').then(function (authData) {
      auth = authData;
      fbRef.child('users/' + auth.uid).set({
        userName: auth.twitter.username,
        displayName: auth.twitter.displayName,
        iconImageUrl: auth.twitter.cachedUserProfile.profile_image_url
      });
      deferred.resolve(authData);
    }).catch(function (error) {
      console.log(error);
      alert(error);
    });
    return deferred.promise;
  }
})
.service('GameOutlines', function ($q, $firebase, fbRef) {
  var self = this;
  self.fetch = function () {
    if (self.gameOutlines)
      return $q.when(self.gameOutlines);
    var deferred = $q.defer();
    var ref = fbRef.child('gameOutlines');
    var $gameOutlines = $firebase(ref);
    ref.on('value', function (snapshot) {
      if (snapshot.val() === null)
        $gameOutlines.$set([]);
      self.gameOutlines = $gameOutlines.$asArray();
      deferred.resolve(self.gameOutlines);
    });
    return deferred.promise;
  };
})
.service('fbFetch', function ($q, $firebase, fbRef) {
  return function (path, opt_type) {
    var type = opt_type || 'Object';
    var deferred = $q.defer();
    var ref = fbRef.child(path);
    var $ref = $firebase(ref);
    ref.on('value', function (snapshot) {
      deferred.resolve($ref['$as' + type]());
    });
    return deferred.promise;
  };
})
.config(function ($routeProvider) {
  $routeProvider
    .when('/games', {
      controller: 'GameList',
      templateUrl: 'othello-online-game-list.html',
      resolve: {
        gameOutlines: function (GameOutlines) {
          return GameOutlines.fetch();
        }
      }
    })
    .when('/games/new', {
      controller: 'GameCreation',
      templateUrl: 'othello-online-game-detail.html'
    })
    .when('/games/:gameId', {
      controller: 'GameDetail',
      templateUrl: 'othello-online-game-detail.html',
      resolve: {
        gameOutline: function ($route, fbFetch) {
          return fbFetch('gameOutlines/' + $route.current.params.gameId);
        },
        gameDetail: function ($route, fbFetch) {
          return fbFetch('gameDetails/' + $route.current.params.gameId);
        }
      }
    })
    .otherwise({
      redirectTo: '/games'
    });
})
.controller('Base', function ($scope, fbAuth, fbFetch) {
  function fetchAndBindUser(auth) {
    if (auth) {
      fbFetch('users/' + auth.uid).then(function (user) {
        $scope.user = user;
      });
    }
  }
  fbAuth('check').then(fetchAndBindUser);
  $scope.signIn = function () {
    fbAuth('signIn').then(fetchAndBindUser);
  };
  $scope.signOut = function () {
    fbAuth('signOut');
    $scope.user = null;
  };
})
.controller('GameList', function ($scope, gameOutlines) {
  $scope.games = gameOutlines;
})
.controller('GameCreation', function ($scope, fbRef, $location) {
  var go = fbRef.child('gameOutlines').push({
    black: null,
    white: null,
    state: 'preparing',
    created_at: Firebase.ServerValue.TIMESTAMP
  });
  var gd = fbRef.child('gameDetails').child(go.key()).set({
    moves: [],
    turn: 'black'
  });
  $location.path('/games/' + go.key());
})
.controller('GameDetail', function ($scope, gameOutline, gameDetail, fbAuth) {
  $scope.outline = gameOutline;
  $scope.detail = gameDetail;
  // TODO: Construct from moves.
  $scope.board = '__bbbw_________bbww___b____ww___w____bbb________________________';
  // TODO: Update .profile on this change.
  // TODO: Start a game if both players are ready.
  $scope.join = function (player) {
    fbAuth('signIn').then(function (auth) {
      gameOutline[player] = auth.uid;
      gameOutline.$save();
    });
  };
});
// vim: expandtab softtabstop=2 shiftwidth=2 foldmethod=marker
