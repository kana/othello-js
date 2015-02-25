angular.module('OthelloOnline', ['ngRoute', 'firebase'])
.value('fbUrl', 'https://brilliant-inferno-6551.firebaseio.com/')
.service('fbRef', function (fbUrl) {
  return new Firebase(fbUrl)
})
.service('fbAuth', function ($q, $firebase, $firebaseAuth, fbRef) {
  function simplifyAuthData(auth) {
    return {
      id: auth.uid,
      name: auth.twitter.username
    };
  }
  var user;
  return function (mode) {
    if (mode === 'signOut') {
      user = null;
      $firebaseAuth(fbRef).$unauth();
      return;
    }

    if (user)
      return $q.when(user);

    var authObj = $firebaseAuth(fbRef);
    var auth = authObj.$getAuth();
    if (auth) {
      user = simplifyAuthData(auth);
      return $q.when(user);
    }

    if (mode === 'check')
      return $q.when(null);

    var deferred = $q.defer();
    authObj.$authWithOAuthPopup('twitter').then(function (auth) {
      user = simplifyAuthData(auth);
      deferred.resolve(user);
    }).catch(function (error) {
      console.log(error);
      alert(error);
    });
    return deferred.promise;
  }
})
.service('GameOutlines', function ($q, fbFetch) {
  var self = this;
  self.fetch = function () {
    if (self.gameOutlines)
      return $q.when(self.gameOutlines);

    return fbFetch('gameOutlines', 'Array').then(function (data) {
      self.gameOutlines = data;
      return data;
    });
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
.service('fbCache', function ($q, fbFetch) {
  var memo = {};
  return function (path, opt_type) {
    if (memo[path])
      return $q.when(memo[path]);
    return fbFetch(path, opt_type).then(function (data) {
      memo[path] = data;
      return data;
    });
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
        moves: function ($route, fbFetch) {
          return fbFetch(
            'gameDetails/' + $route.current.params.gameId + '/moves',
            'Array'
          );
        }
      }
    })
    .otherwise({
      redirectTo: '/games'
    });
})
.controller('Base', function ($scope, fbAuth) {
  function fetchAndBindUser(user) {
    $scope.user = user;
    return user;
  }
  fbAuth('check').then(fetchAndBindUser);
  $scope.signIn = function () {
    return fbAuth('signIn').then(fetchAndBindUser);
  };
  $scope.signOut = function () {
    $scope.user = null;
    return fbAuth('signOut');
  };
})
.controller('GameList', function ($scope, gameOutlines) {
  $scope.games = gameOutlines;
})
.controller('GameCreation', function ($scope, fbRef, $location) {
  // NB: Firebase does not save "empty" objects by design.
  var go = fbRef.child('gameOutlines').push({
    // blackId: null,
    // blackName: null,
    // whiteId: null,
    // whiteName: null,
    state: 'preparing',
    created_at: Firebase.ServerValue.TIMESTAMP
  });
  // var gd = fbRef.child('gameDetails').child(go.key()).set({
  //   moves: []
  // });
  $location.path('/games/' + go.key());
})
.controller('GameDetail', function ($scope, gameOutline, moves) {
  // gameDetails/$game_id/moves is directly watched, because it is troublesome
  // to deal with empty moves by watching gameDetails/$game_id.
  $scope.outline = gameOutline;
  $scope.moves = moves;
  // TODO: Construct from moves.
  $scope.board = '__bbbw_________bbww___b____ww___w____bbb________________________';

  // TODO: Start a game if both players are ready.
  $scope.join = function (color) {
    $scope.signIn().then(function (user) {
      $scope.outline[color + 'Id'] = user.id;
      $scope.outline[color + 'Name'] = user.name;
      if ($scope.outline.blackId && $scope.outline.whiteId)
        $scope.outline.state = 'playing';
      $scope.outline.$save();
    });
  };
  $scope.leave = function (color) {
    $scope.outline[color + 'Id'] = null;
    $scope.outline[color + 'Name'] = null;
    $scope.outline.$save();
  };
  // TODO: Add UI to replay the game if it is finished.

  // TODO: Replace with the actual game engine.
  function delay(expressionAsFunction) {
    return expressionAsFunction;
  }
  function force(promise) {
    return promise();
  }
  function random(n) {
    return Math.floor(Math.random() * n);
  }
  function makeGameTree(color, passedCount) {
    return {
      turn: color,
      moves: generateMoves(color, passedCount)
    };
  }
  function generateMoves(color, passedCount) {
    if (passedCount === 2)
      return [];
    var moveNames = [];
    var x = random(8);
    var y = random(8);
    for (var i = 0; i < 4; i++)
      moveNames.push('abcdefgh'[(x + i) % 8] + '12345678'[(y + 3*i) % 8]);
    moveNames.push('pass');
    return moveNames.map(function (moveName) {
      return {
        name: moveName,
        gameTreePromise: delay(function () {
          return makeGameTree(
            color === 'black' ? 'white' : 'black',
            passedCount + (moveName === 'pass' ? 1 : 0)
          );
        })
      };
    });
  }
  $scope.gameTree = makeGameTree('black', 0);
  $scope.choose = function (moveName) {
    var validMoveNames = $scope.gameTree.moves.map(function (m) {return m.name;});
    var i = validMoveNames.indexOf(moveName);
    if (0 <= i) {
      $scope.gameTree = force($scope.gameTree.moves[i].gameTreePromise);
      $scope.moves.push(moveName);
      $scope.moves.$save();
      if ($scope.gameTree.moves.length === 0) {
        $scope.outline.state = 'finished';
        $scope.outline.$save();
      }
    } else {
      alert(
        'Error: Unexpected move "' + moveName + '" is chosen\n' +
        'but valid moves are ' + validMoveNames.join(', ') + '.'
      );
    }
  };
});
// vim: expandtab softtabstop=2 shiftwidth=2 foldmethod=marker
