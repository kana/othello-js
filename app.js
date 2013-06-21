(function () {
  var N = 4;

  var EMPTY = 'empty';
  var WHITE = 'white';
  var BLACK = 'black';

  function makeInitialGameBoard() {
    var board = {};

    for (var x = 0; x < N; x++)
      for (var y = 0; y < N; y++)
        board[[x, y]] = EMPTY;

    var x2 = x >> 1;
    var y2 = y >> 1;
    board[[x2 - 1, y2 - 1]] = WHITE;
    board[[x2 - 1, y2 - 0]] = BLACK;
    board[[x2 - 0, y2 - 1]] = BLACK;
    board[[x2 - 0, y2 - 0]] = WHITE;

    return board;
  }

  function drawGameBoard(board) {
    var ss = [];

    ss.push('<table>');
    for (var x = 0; x < N; x++) {
      ss.push('<tr>');
      for (var y = 0; y < N; y++) {
        ss.push('<td class="cell">');
        ss.push('<span class="disc ');
        ss.push(board[[x, y]]);
        ss.push('"></span>');
        ss.push('</td>');
      }
      ss.push('</tr>');
    }
    ss.push('</table>');

    $('#game-board').html(ss.join(''));
  }

  function resetGame() {
    drawGameBoard(makeInitialGameBoard());
  }

  resetGame();
})();
// vim: expandtab softtabstop=2 shiftwidth=2
