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

  function makeGameTree(board, player, wasPassed, nest) {
    return {
      board: board,
      player: player,
      moves: listPossibleMoves(board, player, wasPassed, nest)
    };
  }

  function listPossibleMoves(board, player, wasPassed, nest) {
    return completePassingMove(
      listAttackingMoves(board, player, nest),
      board,
      player,
      wasPassed,
      nest
    );
  }

  function completePassingMove(attackingMoves, board, player, wasPassed, nest) {
    if (0 < attackingMoves.length)
      return attackingMoves;
    else if (!wasPassed)
      return [makeGameTree(board, nextPlayer(player), true, nest + 1)];
    else
      return [];
  }

  function listAttackingMoves(board, player, nest) {
    var moves = [];

    for (var x = 0; x < N; x++) {
      for (var y = 0; y < N; y++) {
        if (canAttack(board, x, y, player)) {
          moves.push(
            makeGameTree(
              makeAttackedBoard(board, x, y, player),
              nextPlayer(player),
              false,
              nest + 1
            )
          );
        }
      }
    }

    return moves;
  }

  function nextPlayer(player) {
    return player == BLACK ? WHITE : BLACK;
  }

  function canAttack(board, x, y, player) {
    return listVulnerableCells(board, x, y, player).length;
  }

  function makeAttackedBoard(board, x, y, player) {
    var newBoard = JSON.parse(JSON.stringify(board));
    var vulnerableCells = listVulnerableCells(board, x, y, player);
    for (i = 0; i < vulnerableCells.length; i++)
      newBoard[vulnerableCells[i]] = player;
    return newBoard;
  }

  function listVulnerableCells(board, x, y, player) {
    var vulnerableCells = [];

    if (board[[x, y]] != EMPTY)
      return vulnerableCells;

    var opponent = nextPlayer(player);
    for (var dx = -1; dx <= 1; dx++) {
      for (var dy = -1; dy <= 1; dy++) {
        if (dx == 0 && dy == 0)
          continue;
        for (var i = 1; i < N; i++) {
          var nx = x + i * dx;
          var ny = y + i * dy;
          if (nx < 0 || N <= nx || ny < 0 || N <= ny)
            break;
          var cell = board[[nx, ny]];
          if (cell == player && 2 <= i) {
            for (j = 0; j < i; j++)
              vulnerableCells.push([x + j * dx, y + j * dy]);
            break;
          }
          if (cell != opponent)
            break;
        }
      }
    }

    return vulnerableCells;
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
