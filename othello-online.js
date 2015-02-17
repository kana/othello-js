angular.module('OthelloOnline', ['ngRoute', 'firebase'])
.config(function ($routeProvider) {
  $routeProvider
    .when('/games', {
      controller: 'GameList',
      templateUrl: 'othello-online-game-list.html'
    })
    .when('/games/:gameId', {
      controller: 'GameDetail',
      templateUrl: 'othello-online-game-detail.html'
    })
    .otherwise({
      redirectTo: '/games'
    });
})
.controller('GameList', function ($scope) {
  // TODO
})
.controller('GameDetail', function ($scope) {
  // TODO
});
// vim: expandtab softtabstop=2 shiftwidth=2 foldmethod=marker
