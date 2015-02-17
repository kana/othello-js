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
  // TODO: Fetch recent games from Firebase.
  $scope.games = [
    {id: 4, black: 'George', white: 'Hans', state: 'preparing', created_at: '2015-02-18T00:12:46+09:00'},
    {id: 3, black: 'Eve', white: 'Fiona', state: 'preparing', created_at: '2015-02-18T00:11:39+09:00'},
    {id: 2, black: 'Chris', white: 'Dave', state: 'finished', created_at: '2015-02-18T00:10:00+09:00'},
    {id: 1, black: 'Alice', white: 'Bob', state: 'playing', created_at: '2015-02-18T00:09:51+09:00'}
  ];
})
.controller('GameDetail', function ($scope) {
  // TODO
});
// vim: expandtab softtabstop=2 shiftwidth=2 foldmethod=marker
