(function () {
  // Core logic {{{1

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
    if (4 < nest)  // Cut deep subtrees for ease of debug.  TODO: Remove this.
      return [];
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
      return [{
        isPassingMove: true,
        gameTree: makeGameTree(board, nextPlayer(player), true, nest + 1)
      }];
    else
      return [];
  }

  function listAttackingMoves(board, player, nest) {
    var moves = [];

    for (var x = 0; x < N; x++) {
      for (var y = 0; y < N; y++) {
        if (canAttack(board, x, y, player)) {
          moves.push({
            x: x,
            y: y,
            gameTree: makeGameTree(
              makeAttackedBoard(board, x, y, player),
              nextPlayer(player),
              false,
              nest + 1
            )
          });
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




  // AI {{{1

  var AI_LEVEL = 4;

  function findTheBestMoveByAI(gameTree) {
    var ratings = calculateRatings(gameTree, gameTree.player);
    var maxRating = Math.max.apply(null, ratings);
    return gameTree.moves[ratings.indexOf(maxRating)];
  }

  function scoreBoard(board, player) {
    // TODO: Calculate a more proper score.
    return $.map(board, function (v) {return v == player;}).length;
  }

  function ratePosition(gameTree, player) {
    var moves = gameTree.moves;
    if (1 <= moves.length) {
      var choose = gameTree.player == player ? Math.max : Math.min;
      return choose.apply(null, calculateRatings(gameTree, player));
    } else {
      return scoreBoard(gameTree.board, player);
    }
  }

  function calculateRatings(gameTree, player) {
    return gameTree.moves.map(function (m) {
      return ratePosition(m.gameTree, player);
    });
  }

  function limitGameTreeDepth(gameTree, depth) {
    return {
      board: gameTree.board,
      player: gameTree.player,
      moves:
        depth == 0
        ? []
        : gameTree.moves.map(function (m) {
            return {
              isPassingMove: m.isPassingMove,
              x: m.x,
              y: m.y,
              gameTree: limitGameTreeDepth(gameTree, depth - 1)
            };
          })
    };
  }




  // UI {{{1

  function drawGameBoard(gameTree) {
    var ss = [];
    var board = gameTree.board;

    ss.push('<table>');
    for (var y = -1; y < N; y++) {
      ss.push('<tr>');
      for (var x = -1; x < N; x++) {
        if (0 <= y && 0 <= x) {
          ss.push('<td class="cell">');
          ss.push('<span class="disc ');
          ss.push(board[[x, y]]);
          ss.push('"></span>');
          ss.push('</td>');
        } else if (0 <= x && y == -1) {
          ss.push('<th>' + 'abcdefgh'[x] + '</th>');
        } else if (x == -1 && 0 <= y) {
          ss.push('<th>' + '12345678'[y] + '</th>');
        } else /* if (x == -1 && y == -1) */ {
          ss.push('<th></th>');
        }
      }
      ss.push('</tr>');
    }
    ss.push('</table>');

    $('#game-board').html(ss.join(''));
    $('#current-player-name').text(gameTree.player);
  }

  function resetUI() {
    $('#console').empty();
    $('#message').empty();
  }

  function setUpUIToChooseMove(moves) {
    $('#message').text('Choose your move:');
    moves.forEach(function (m, i) {
      $('#console').append(
        $('<input type="button" class="btn">')
        .val(makeLabelForMove(m))  // TODO: More useful UI.
        .click(function () {
          shiftToNewGameTree(moves[i].gameTree);
        })
      );
    });
  }

  function makeLabelForMove(move) {
    if (move.isPassingMove)
      return 'Pass';
    else
      return 'abcdefgh'[move.x] + '12345678'[move.y];
  }

  function setUpUIToReset() {
    $('#console').append(
      $('<input type="button" class="btn">')
      .val('Start a new game')
      .click(function () {
        resetGame();
      })
    );
  }

  function chooseMoveByAI(gameTree) {
    $('#message').text('Now thinking...');
    setTimeout(
      function () {
        shiftToNewGameTree(findTheBestMoveByAI(gameTree).gameTree);
      },
      500
    );
  }

  function showWinner(board) {
    var nt = {};
    nt[BLACK] = 0;
    nt[WHITE] = 0;

    for (var x = 0; x < N; x++)
      for (var y = 0; y < N; y++)
        nt[board[[x, y]]]++;

    $('#message').text(
      nt[BLACK] == nt[WHITE]
      ? 'The game ends in a draw.'
      : 'The winner is ' + (nt[WHITE] < nt[BLACK] ? BLACK : WHITE) + '.'
    );
  }

  var currentTree;

  function shiftToNewGameTree(gameTree) {
    currentTree = gameTree;

    drawGameBoard(gameTree);
    resetUI();
    if (gameTree.moves.length == 0) {
      showWinner(gameTree.board);
      setUpUIToReset();
    } else {
      if (gameTree.player == BLACK)
        setUpUIToChooseMove(gameTree.moves);
      else
        chooseMoveByAI(gameTree);
    }
  }

  function resetGame() {
    shiftToNewGameTree(makeGameTree(makeInitialGameBoard(), BLACK, false, 1));
  }




  // Startup {{{1

  resetGame();
})();
// vim: expandtab softtabstop=2 shiftwidth=2 foldmethod=marker
