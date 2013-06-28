(function () {
  // Utilities {{{1

  function memoize(f) {
    var memo = {};
    var first = 0;
    var second = 0;
    return function () {
      if (arguments[0] == 'stat')
        return [first, second];
      var key = JSON.stringify(arguments);
      if (memo[key] === undefined) {
        memo[key] = f.apply(this, arguments);
        first++;
      } else {
        second++;
      }
      return memo[key];
    };
  }

  function delay(expressionAsFunction) {
    var result;
    var isEvaluated = false;

    return function () {
      if (!isEvaluated) {
        result = expressionAsFunction();
        isEvaluated = true;
      }
      return result;
    };
  }

  function force(promise) {
    return promise();
  }




  // Core logic {{{1

  var N = 8;

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

  function _makeGameTree(board, player, wasPassed, nest) {
    return {
      board: board,
      player: player,
      moves: listPossibleMoves(board, player, wasPassed, nest)
    };
  }
  var makeGameTree = memoize(_makeGameTree);

  function makeWholeGameTree() {
    return makeGameTree(makeInitialGameBoard(), BLACK, false, 1);
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
      return [{
        isPassingMove: true,
        gameTreePromise: delay(function () {
          return makeGameTree(board, nextPlayer(player), true, nest + 1);
        })
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
            gameTreePromise: (function (x, y) {
              return delay(function () {
                return makeGameTree(
                  makeAttackedBoard(board, x, y, player),
                  nextPlayer(player),
                  false,
                  nest + 1
                );
              });
            })(x, y)
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

  function _listVulnerableCells(board, x, y, player) {
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
  var listVulnerableCells = memoize(_listVulnerableCells);




  // AI {{{1

  var AI_LEVEL = 4;

  function findTheBestMoveByAI(gameTree) {
    var ratings = calculateRatings(
      limitGameTreeDepth(gameTree, AI_LEVEL),
      gameTree.player
    );
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
      return ratePosition(force(m.gameTreePromise), player);
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
              gameTreePromise: delay(function () {
                return limitGameTreeDepth(gameTree, depth - 1);
              })
            };
          })
    };
  }




  // UI {{{1

  function drawGameBoard(gameTree) {
    var ss = [];
    var board = gameTree.board;
    var attackable = {};
    gameTree.moves.forEach(function (m) {
      if (!m.isPassingMove)
        attackable[[m.x, m.y]] = true;
    });

    ss.push('<table>');
    for (var y = -1; y < N; y++) {
      ss.push('<tr>');
      for (var x = -1; x < N; x++) {
        if (0 <= y && 0 <= x) {
          ss.push('<td class="');
          ss.push('cell');
          ss.push(' ');
          ss.push(attackable[[x, y]] ? gameTree.player : board[[x, y]]);
          ss.push(' ');
          ss.push(attackable[[x, y]] ? 'attackable' : '');
          ss.push('" id="');
          ss.push('cell' + x + y);
          ss.push('">');
          ss.push('<span class="disc"></span>');
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

  function setUpUIToChooseMove(gameTree) {
    $('#message').text('Choose your move.');
    gameTree.moves.forEach(function (m, i) {
      if (m.isPassingMove) {
        $('#console').append(
          $('<input type="button" class="btn">')
          .val(makeLabelForMove(m))
          .click(function () {
            shiftToNewGameTree(force(m.gameTreePromise));
          })
        );
      } else {
        $('#cell' + m.x + m.y)
        .click(function () {
          shiftToNewGameTree(force(m.gameTreePromise));
        })
      }
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
        shiftToNewGameTree(force(findTheBestMoveByAI(gameTree).gameTreePromise));
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
        setUpUIToChooseMove(gameTree);
      else
        chooseMoveByAI(gameTree);
    }
  }

  function resetGame() {
    $('#preference-pane :input').removeAttr('disabled');
  }

  function startNewGame() {
    $('#preference-pane :input').attr('disabled', 'disabled');
    shiftToNewGameTree(makeWholeGameTree());
  }




  // Startup {{{1

  $('#start-button').click(function () {startNewGame();});
  resetGame();
})();
// vim: expandtab softtabstop=2 shiftwidth=2 foldmethod=marker
