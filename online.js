angular.module('OthelloOnline', ['ngRoute', 'firebase'])
.value('fbUrl', 'https://othelloonline.firebaseio.com/')
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
      templateUrl: 'online-game-list.html',
      resolve: {
        gameOutlines: function (GameOutlines) {
          return GameOutlines.fetch();
        }
      }
    })
    .when('/games/new', {
      controller: 'GameCreation',
      templateUrl: 'online-game-detail.html'
    })
    .when('/games/:gameId', {
      controller: 'GameDetail',
      templateUrl: 'online-game-detail.html',
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
  var O = othello;
  $scope.O = othello;

  // gameDetails/$game_id/moves is directly watched, because it is troublesome
  // to deal with empty moves by watching gameDetails/$game_id.
  $scope.outline = gameOutline;
  $scope.moves = moves;

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

  function play(moveName) {
    var validMoveNames =
      $scope.gameTree.moves.map(function (m) {return O.nameMove(m);});
    var i = validMoveNames.indexOf(moveName);
    if (0 <= i) {
      $scope.gameTree = O.force($scope.gameTree.moves[i].gameTreePromise);
    } else {
      throw new Error(
        'Error: Unexpected move "' + moveName + '" is chosen\n' +
        'but valid moves are ' + validMoveNames.join(', ') + '.'
      );
    }
  }
  function visualizedBoardFrom(gameTree) {
    var player = gameTree.player;
    var board = gameTree.board;
    var attackable = [];
    gameTree.moves.forEach(function (m) {
      if (!m.isPassingMove)
        attackable[O.ix(m.x, m.y)] = m;
    });

    var newBoard = [];
    for (var y = -1; y < O.N; y++) {
      var row = [];
      for (var x = -1; x < O.N; x++) {
        if (0 <= y && 0 <= x) {
          var a = attackable[O.ix(x, y)];
          var b = board[O.ix(x, y)];
          row.push({
            cell: true,
            black: player === O.BLACK && a || b == O.BLACK,
            white: player === O.WHITE && a || b == O.WHITE,
            attackable: a
          });
        } else if (0 <= x && y === -1) {
          row.push({
            header: true,
            name: String.fromCharCode('a'.charCodeAt(0) + x)
          });
        } else if (x === -1 && 0 <= y) {
          row.push({
            header: true,
            name: y + 1
          });
        } else /* if (x === -1 && y === -1) */ {
          row.push({});
        }
      }
      newBoard.push(row);
    }
    return newBoard;
  }

  $scope.$watch('gameTree', function () {
    $scope.visualizedBoard = visualizedBoardFrom($scope.gameTree);
  });
  $scope.gameTree = O.makeInitialGameTree();
  $scope.moves.$watch(function (e) {
    if (e.event == 'child_added') {
      play($scope.moves[$scope.moves.length - 1].$value);
    }
  });

  $scope.isMyTurn = function () {
    return $scope.user.id === $scope.outline[$scope.gameTree.player + 'Id'];
  };
  $scope.isPassingMove = function (move) {
    return move.isPassingMove;
  };
  $scope.choose = function (move) {
    var moveName = O.nameMove(move);
    play(moveName);
    $scope.moves.$add(moveName);
    if ($scope.gameTree.moves.length === 0) {
      $scope.outline.state = 'finished';
      $scope.outline.$save();
    }
  };
});
// vim: expandtab softtabstop=2 shiftwidth=2 foldmethod=marker
