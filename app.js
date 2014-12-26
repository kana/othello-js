var othello = {};

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

  function sum(ns) {
    return ns.reduce(function (t, n) {return t + n;});
  }




  // Core logic {{{1

  var m = location.href.match(/\?n=(\d+)$/);
  var N = m == null ? 8 : parseInt(m[1]);

  var EMPTY = 'empty';
  var WHITE = 'white';
  var BLACK = 'black';

  function I(x, y) {
    return x + y * N;
  }

  function makeInitialGameBoard() {
    var board = [];

    for (var x = 0; x < N; x++)
      for (var y = 0; y < N; y++)
        board[I(x, y)] = EMPTY;

    var x2 = x >> 1;
    var y2 = y >> 1;
    board[I(x2 - 1, y2 - 1)] = WHITE;
    board[I(x2 - 1, y2 - 0)] = BLACK;
    board[I(x2 - 0, y2 - 1)] = BLACK;
    board[I(x2 - 0, y2 - 0)] = WHITE;

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
        var vulnerableCells = listVulnerableCells(board, x, y, player);
        if (canAttack(vulnerableCells)) {
          moves.push({
            x: x,
            y: y,
            gameTreePromise: (function (x, y, vulnerableCells) {
              return delay(function () {
                return makeGameTree(
                  makeAttackedBoard(board, vulnerableCells, player),
                  nextPlayer(player),
                  false,
                  nest + 1
                );
              });
            })(x, y, vulnerableCells)
          });
        }
      }
    }

    return moves;
  }

  function nextPlayer(player) {
    return player == BLACK ? WHITE : BLACK;
  }

  function canAttack(vulnerableCells) {
    return vulnerableCells.length;
  }

  function makeAttackedBoard(board, vulnerableCells, player) {
    var newBoard = JSON.parse(JSON.stringify(board));
    for (var i = 0; i < vulnerableCells.length; i++)
      newBoard[vulnerableCells[i]] = player;
    return newBoard;
  }

  function listVulnerableCells(board, x, y, player) {
    var vulnerableCells = [];

    if (board[I(x, y)] != EMPTY)
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
          var cell = board[I(nx, ny)];
          if (cell == player && 2 <= i) {
            for (j = 0; j < i; j++)
              vulnerableCells.push(I(x + j * dx, y + j * dy));
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

  function makeScoreBoardWith(weightTable) {
    var wt = weightTable;
    return function (board, player) {
      var opponent = nextPlayer(player);
      return sum($.map(board, function (v,p) {return (v==player) * wt[p];})) -
             sum($.map(board, function (v,p) {return (v==opponent) * wt[p];}));
    };
  }

  var weightTables = {
    simpleCount:
      (function () {
        var t = [];
        for (var x = 0; x < N; x++)
          for (var y = 0; y < N; y++)
            t[I(x, y)] = 1;
        return t;
      })(),
    basic:
      (function () {
        var t = [];
        for (var x = 0; x < N; x++)
          for (var y = 0; y < N; y++)
            t[I(x, y)] =
              (x == 0 || x == N - 1 ? 10 : 1) *
              (y == 0 || y == N - 1 ? 10 : 1);
        return t;
      })(),
    better:
      (function () {
        var t = [];
        for (var x = 0; x < N; x++)
          for (var y = 0; y < N; y++)
            t[I(x, y)] =
              (x == 0 || x == N - 1 ? 10 : 1) *
              (y == 0 || y == N - 1 ? 10 : 1);
        t[I(0, 1)] = t[I(0, N - 2)] = t[I(N - 1, 1)] = t[I(N - 1, N - 2)] =
        t[I(1, 0)] = t[I(N - 2, 0)] = t[I(1, N - 1)] = t[I(N - 2, N - 1)] = 0;
        return t;
      })()
  };

  function makeAI(config) {
    return {
      findTheBestMove: function (gameTree) {
        var ratings = calculateMaxRatings(
          limitGameTreeWithFeasibleDepth(gameTree, config.level),
          gameTree.player,
          Number.MIN_VALUE,
          Number.MAX_VALUE,
          config.scoreBoard
        );
        var maxRating = Math.max.apply(null, ratings);
        return gameTree.moves[ratings.indexOf(maxRating)];
      }
    };
  }

  function limitGameTreeWithFeasibleDepth(gameTree, maxBoards) {
    return limitGameTreeDepth(
      gameTree,
      estimateFeasibleDepth(gameTree, maxBoards)
    );
  }

  function estimateFeasibleDepth(gameTree, maxBoards) {
    var oldApproxBoards = 1;
    var newApproxBoards = 1;
    var depth = 0;
    while (newApproxBoards <= maxBoards && 1 <= gameTree.moves.length) {
      oldApproxBoards = newApproxBoards;
      newApproxBoards *= gameTree.moves.length;
      depth += 1;
      gameTree = force(gameTree.moves[0].gameTreePromise);
    }
    var oldDiff = oldApproxBoards - maxBoards;
    var newDiff = newApproxBoards - maxBoards;
    return Math.abs(newDiff) - Math.abs(oldDiff) <= 0 ? depth : depth - 1;
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
                return limitGameTreeDepth(force(m.gameTreePromise), depth - 1);
              })
            };
          })
    };
  }

  function ratePosition(gameTree, player, scoreBoard) {
    if (1 <= gameTree.moves.length) {
      var choose = gameTree.player == player ? Math.max : Math.min;
      return choose.apply(null, calculateRatings(gameTree, player, scoreBoard));
    } else {
      return scoreBoard(gameTree.board, player);
    }
  }

  function calculateRatings(gameTree, player, scoreBoard) {
    return gameTree.moves.map(function (m) {
      return ratePosition(force(m.gameTreePromise), player, scoreBoard);
    });
  }

  function ratePositionWithAlphaBetaPruning(gameTree, player, lowerLimit, upperLimit, scoreBoard) {
    if (1 <= gameTree.moves.length) {
      var judge =
        gameTree.player == player
        ? Math.max
        : Math.min;
      var rate =
        gameTree.player == player
        ? calculateMaxRatings
        : calculateMinRatings;
      return judge.apply(null, rate(gameTree, player, lowerLimit, upperLimit, scoreBoard));
    } else {
      return scoreBoard(gameTree.board, player);
    }
  }

  function calculateMaxRatings(gameTree, player, lowerLimit, upperLimit, scoreBoard) {
    var ratings = [];
    var newLowerLimit = lowerLimit;
    for (var i = 0; i < gameTree.moves.length; i++) {
      var r = ratePositionWithAlphaBetaPruning(
        force(gameTree.moves[i].gameTreePromise),
        player,
        newLowerLimit,
        upperLimit,
        scoreBoard
      );
      ratings.push(r);
      if (upperLimit <= r)
        break;
      newLowerLimit = Math.max(r, newLowerLimit);
    }
    return ratings;
  }

  function calculateMinRatings(gameTree, player, lowerLimit, upperLimit, scoreBoard) {
    var ratings = [];
    var newUpperLimit = upperLimit;
    for (var i = 0; i < gameTree.moves.length; i++) {
      var r = ratePositionWithAlphaBetaPruning(
        force(gameTree.moves[i].gameTreePromise),
        player,
        upperLimit,
        newUpperLimit,
        scoreBoard
      );
      ratings.push(r);
      if (r <= lowerLimit)
        break;
      newUpperLimit = Math.min(r, newUpperLimit);
    }
    return ratings;
  }




  // API {{{1

  var externalAITable = {};

  var lastAIType;

  othello.registerAI = function (ai) {
    externalAITable[lastAIType] = ai;
  };

  othello.force = force;
  othello.delay = delay;
  othello.EMPTY = EMPTY;
  othello.WHITE = WHITE;
  othello.BLACK = BLACK;
  othello.nextPlayer = nextPlayer;

  function addNewAI() {
    var aiUrl = $('#new-ai-url').val();
    var originalLabel = $('#add-new-ai-button').text();
    if (externalAITable[aiUrl] == null) {
      lastAIType = aiUrl;
      $('#add-new-ai-button').text('Loading...').prop('disabled', true);
      $.getScript(aiUrl, function () {
        $('#black-player-type, #white-player-type').append(
          '<option value="' + aiUrl + '">' + aiUrl + '</option>'
        );
        $('#white-player-type').val(aiUrl).change();
        $('#add-new-ai-button').text(originalLabel).removeProp('disabled');
      });
    } else {
      $('#add-new-ai-button').text('Already loaded').prop('disabled', true);
      setTimeout(
        function () {
          $('#add-new-ai-button').text(originalLabel).removeProp('disabled');
        },
        1000
      );
    }
  }




  // UI {{{1

  function drawGameBoard(board, player, moves) {
    var ss = [];
    var attackable = [];
    moves.forEach(function (m) {
      if (!m.isPassingMove)
        attackable[I(m.x, m.y)] = true;
    });

    ss.push('<table>');
    for (var y = -1; y < N; y++) {
      ss.push('<tr>');
      for (var x = -1; x < N; x++) {
        if (0 <= y && 0 <= x) {
          ss.push('<td class="');
          ss.push('cell');
          ss.push(' ');
          ss.push(attackable[I(x, y)] ? player : board[I(x, y)]);
          ss.push(' ');
          ss.push(attackable[I(x, y)] ? 'attackable' : '');
          ss.push('" id="');
          ss.push('cell_' + x + '_' + y);
          ss.push('">');
          ss.push('<span class="disc"></span>');
          ss.push('</td>');
        } else if (0 <= x && y == -1) {
          ss.push('<th>' + String.fromCharCode('a'.charCodeAt(0)+x) + '</th>');
        } else if (x == -1 && 0 <= y) {
          ss.push('<th>' + (y + 1) + '</th>');
        } else /* if (x == -1 && y == -1) */ {
          ss.push('<th></th>');
        }
      }
      ss.push('</tr>');
    }
    ss.push('</table>');

    $('#game-board').html(ss.join(''));
    $('#current-player-name').text(player);
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
        $('#cell_' + m.x + '_' + m.y)
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
    resetGame();
  }

  var minimumDelayForAI = 500;  // milliseconds
  function chooseMoveByAI(gameTree, ai) {
    $('#message').text('Now thinking...');
    setTimeout(
      function () {
        var start = Date.now();
        var newGameTree = force(ai.findTheBestMove(gameTree).gameTreePromise);
        var end = Date.now();
        var delta = end - start;
        setTimeout(
          function () {
            shiftToNewGameTree(newGameTree);
          },
          Math.max(minimumDelayForAI - delta, 1)
        );
      },
      1
    );
  }

  function showWinner(board) {
    var nt = {};
    nt[BLACK] = 0;
    nt[WHITE] = 0;

    for (var x = 0; x < N; x++)
      for (var y = 0; y < N; y++)
        nt[board[I(x, y)]]++;

    $('#message').text(
      nt[BLACK] == nt[WHITE]
      ? 'The game ends in a draw.'
      : 'The winner is ' + (nt[WHITE] < nt[BLACK] ? BLACK : WHITE) + '.'
    );
  }

  var playerTable = {};

  function makePlayer(playerType, level) {
    if (playerType == 'human') {
      return setUpUIToChooseMove;
    } else {
      var weightTable = weightTables[playerType];
      var ai = weightTable === undefined
        ? externalAITable[playerType]
        : makeAI({level: level, scoreBoard: makeScoreBoardWith(weightTable)});
      return function (gameTree) {
        chooseMoveByAI(gameTree, ai);
      };
    }
  }

  function adjustPlayerUI($type, $level) {
    $type.change(function () {
      var available = $type.val() in weightTables;
      $level
        .toggleClass('disabled', !available)
        .prop('disabled', !available);
    }).change();
  }

  function swapPlayerTypes() {
    var t = $('#black-player-type').val();
    $('#black-player-type').val($('#white-player-type').val()).change();
    $('#white-player-type').val(t).change();

    var l = $('#black-player-level').val();
    $('#black-player-level').val($('#white-player-level').val());
    $('#white-player-level').val(l);
  }

  function shiftToNewGameTree(gameTree) {
    drawGameBoard(gameTree.board, gameTree.player, gameTree.moves);
    resetUI();
    if (gameTree.moves.length == 0) {
      showWinner(gameTree.board);
      setUpUIToReset();
    } else {
      playerTable[gameTree.player](gameTree);
    }
  }

  function resetGame() {
    $('#preference-pane').removeClass('disabled');
    $('#preference-pane :input').removeAttr('disabled');
  }

  function startNewGame() {
    $('#preference-pane').addClass('disabled');
    $('#preference-pane :input').attr('disabled', 'disabled');
    playerTable[BLACK] = makePlayer($('#black-player-type').val(),
                                    parseInt($('#black-player-level').val()));
    playerTable[WHITE] = makePlayer($('#white-player-type').val(),
                                    parseInt($('#white-player-level').val()));
    shiftToNewGameTree(makeGameTree(makeInitialGameBoard(), BLACK, false, 1));
  }




  // Startup {{{1

  $('#start-button').click(function () {startNewGame();});
  $('#add-new-ai-button').click(function () {addNewAI();});
  $('#swap-player-types-button').click(function () {swapPlayerTypes();});
  adjustPlayerUI($('#black-player-type'), $('#black-player-level'));
  adjustPlayerUI($('#white-player-type'), $('#white-player-level'));
  resetGame();
  drawGameBoard(makeInitialGameBoard(), '-', []);
})();
// vim: expandtab softtabstop=2 shiftwidth=2 foldmethod=marker
