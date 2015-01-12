var othello = {};

(function () {
  'use strict';

  // Utilities {{{1

  function memoize(f) {
    var memo = {};
    var first = 0;
    var second = 0;
    return function () {
      if (arguments[0] === 'stat')
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

  function random(n) {
    return Math.floor(Math.random() * n);
  }




  // Core logic {{{1

  var m = location.href.match(/\?n=(\d+)$/);
  var N = m === null ? 8 : parseInt(m[1]);

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

    var x2 = N >> 1;
    var y2 = N >> 1;
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
                  makeAttackedBoard(board, x, y, vulnerableCells, player),
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
    return player === BLACK ? WHITE : BLACK;
  }

  function canAttack(vulnerableCells) {
    return vulnerableCells.length;
  }

  function makeAttackedBoard(board, x, y, vulnerableCells, player) {
    var newBoard = board.slice();
    newBoard[I(x, y)] = player;
    for (var i = 0; i < vulnerableCells.length; i++)
      newBoard[vulnerableCells[i]] = player;
    return newBoard;
  }

  function listVulnerableCells(board, x, y, player) {
    var vulnerableCells = [];

    if (board[I(x, y)] !== EMPTY)
      return vulnerableCells;

    var opponent = nextPlayer(player);
    for (var dx = -1; dx <= 1; dx++) {
      for (var dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0)
          continue;
        for (var i = 1; i < N; i++) {
          var nx = x + i * dx;
          var ny = y + i * dy;
          if (nx < 0 || N <= nx || ny < 0 || N <= ny)
            break;
          var cell = board[I(nx, ny)];
          if (cell === player && 2 <= i) {
            for (var j = 1; j < i; j++)
              vulnerableCells.push(I(x + j * dx, y + j * dy));
            break;
          }
          if (cell !== opponent)
            break;
        }
      }
    }

    return vulnerableCells;
  }

  function judge(board) {
    var n = {};
    n[BLACK] = 0;
    n[WHITE] = 0;
    n[EMPTY] = 0;
    for (var i = 0; i < board.length; i++)
      n[board[i]]++;

    if (n[BLACK] > n[WHITE])
      return 1;
    if (n[BLACK] < n[WHITE])
      return -1;
    return 0;
  }




  // AI {{{1

  var aiMakers = {
    mcts: makeMonteCarloTreeSearchBasedAI,
    pmc: makePrimitiveMonteCarloBasedAI
  };

  function makeAI(playerType) {
    if (playerType in externalAITable) {
      return externalAITable[playerType];
    } else {
      var tokens = playerType.split('-');
      var aiType = tokens[0];
      var level = parseInt(tokens[1]);
      var weightTable = weightTables[aiType];
      if (weightTable !== undefined) {
        return makeWeightTableBasedAI({
          level: level,
          scoreBoard: makeScoreBoardWith(weightTable)
        });
      } else {
        return aiMakers[aiType]({
          level: level
        });
      }
    }
  }




  // AI: Weight table based + alpha-beta pruning {{{1

  function makeScoreBoardWith(weightTable) {
    var wt = weightTable;
    return function (board, player) {
      var opponent = nextPlayer(player);
      var ct = {};
      ct[player] = 1;
      ct[opponent] = -1;
      ct[EMPTY] = 0;
      var s = 0;
      for (var i = 0; i < board.length; i++)
        s += ct[board[i]] * wt[i];
      return s;
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
              (x === 0 || x === N - 1 ? 10 : 1) *
              (y === 0 || y === N - 1 ? 10 : 1);
        return t;
      })(),
    better:
      (function () {
        var t = [];
        for (var x = 0; x < N; x++)
          for (var y = 0; y < N; y++)
            t[I(x, y)] =
              (x === 0 || x === N - 1 ? 10 : 1) *
              (y === 0 || y === N - 1 ? 10 : 1);
        t[I(0, 1)] = t[I(0, N - 2)] = t[I(N - 1, 1)] = t[I(N - 1, N - 2)] =
        t[I(1, 0)] = t[I(N - 2, 0)] = t[I(1, N - 1)] = t[I(N - 2, N - 1)] = 0;
        return t;
      })()
  };

  function makeWeightTableBasedAI(config) {
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
        depth === 0
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
      var choose = gameTree.player === player ? Math.max : Math.min;
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
        gameTree.player === player
        ? Math.max
        : Math.min;
      var rate =
        gameTree.player === player
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




  // AI: Monte Carlo Tree Search {{{1

  function makeMonteCarloTreeSearchBasedAI(options) {
    return {
      findTheBestMove: function (gameTree) {
        return tryMonteCarloTreeSearch(gameTree, options.level);
      }
    };
  }

  function tryMonteCarloTreeSearch(rootGameTree, maxTries) {
    var root = new Node(rootGameTree, null, null);

    for (var i = 0; i < maxTries; i++) {
      var node = root;

      while (node.untriedMoves.length === 0 && node.childNodes.length !== 0)
        node = node.selectChild();

      if (node.untriedMoves.length !== 0)
        node = node.expandChild();

      var won = node.simulate(rootGameTree.player);

      node.backpropagate(won);
    }

    var vs = root.childNodes.map(function (n) {return n.visits;});
    return root.childNodes[vs.indexOf(Math.max.apply(null, vs))].move;
  }

  function Node(gameTree, parentNode, move) {
    this.gameTree = gameTree;
    this.parentNode = parentNode;
    this.move = move;
    this.childNodes = [];
    this.wins = 0;
    this.visits = 0;
    this.untriedMoves = gameTree.moves.slice();
  }

  Node.prototype.selectChild = function () {
    var totalVisits = this.visits;
    var values = this.childNodes.map(function (n) {
      return n.wins / n.visits +
             Math.sqrt(2 * Math.log(totalVisits) / n.visits);
    });
    return this.childNodes[values.indexOf(Math.max.apply(null, values))];
  };

  Node.prototype.expandChild = function () {
    var i = random(this.untriedMoves.length);
    var move = this.untriedMoves.splice(i, 1)[0];
    var child = new Node(force(move.gameTreePromise), this, move);
    this.childNodes.push(child);
    return child;
  };

  Node.prototype.simulate = function (player) {
    var gameTree = this.gameTree;
    while (gameTree.moves.length !== 0) {
      var i = random(gameTree.moves.length);
      gameTree = force(gameTree.moves[i].gameTreePromise);
    }
    return judge(gameTree.board) * (player === BLACK ? 1 : -1);
  };

  Node.prototype.backpropagate = function (result) {
    for (var node = this; node !== null; node = node.parentNode)
      node.update(result);
  };

  Node.prototype.update = function (won) {
    this.wins += won;
    this.visits += 1;
  };

  Node.prototype.visualize = function (indent) {
    indent = indent || 0;
    var ss = [];
    ss.push('\n');
    for (var i = 0; i < indent; i++)
      ss.push('| ');
    ss.push('W='); ss.push(this.wins);
    ss.push('/');
    ss.push('V='); ss.push(this.visits);
    ss.push('/');
    ss.push('U='); ss.push(this.untriedMoves.length);
    for (var i = 0; i < this.childNodes.length; i++)
      ss.push(this.childNodes[i].visualize(indent + 1));
    return ss.join('');
  };




  // AI: Primitive Monte Carlo {{{1

  function makePrimitiveMonteCarloBasedAI(options) {
    return {
      findTheBestMove: function (gameTree) {
        return tryPrimitiveMonteCarloSimulation(gameTree, options.level);
      }
    };
  }

  function tryPrimitiveMonteCarloSimulation(rootGameTree, maxTries) {
    var scores = rootGameTree.moves.map(function (m) {
      var s = 0;
      for (var i = 0; i < maxTries; i++)
        s += simulateRandomGame(m, rootGameTree.player);
      return s;
    });
    var maxScore = Math.max.apply(null, scores);
    return rootGameTree.moves[scores.indexOf(maxScore)];
  }

  function simulateRandomGame(move, player) {
    var gt = othello.force(move.gameTreePromise);
    while (gt.moves.length !== 0)
      gt = othello.force(gt.moves[random(gt.moves.length)].gameTreePromise);
    return judge(gt.board) * (player === BLACK ? 1 : -1);
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
    if (externalAITable[aiUrl] === undefined) {
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
        } else if (0 <= x && y === -1) {
          ss.push('<th>' + String.fromCharCode('a'.charCodeAt(0)+x) + '</th>');
        } else if (x === -1 && 0 <= y) {
          ss.push('<th>' + (y + 1) + '</th>');
        } else /* if (x === -1 && y === -1) */ {
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
    if ($('#repeat-games:checked').length)
      startNewGame();
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
    var r = judge(board);
    $('#message').text(
      r === 0
      ? 'The game ends in a draw.'
      : 'The winner is ' + (r === 1 ? BLACK : WHITE) + '.'
    );
  }

  var playerTable = {};

  function makePlayer(playerType) {
    if (playerType === 'human') {
      return setUpUIToChooseMove;
    } else {
      var ai = makeAI(playerType);
      return function (gameTree) {
        chooseMoveByAI(gameTree, ai);
      };
    }
  }

  function blackPlayerType() {
    return $('#black-player-type').val();
  }

  function whitePlayerType() {
    return $('#white-player-type').val();
  }

  function swapPlayerTypes() {
    var t = $('#black-player-type').val();
    $('#black-player-type').val($('#white-player-type').val()).change();
    $('#white-player-type').val(t).change();
  }

  function shiftToNewGameTree(gameTree) {
    drawGameBoard(gameTree.board, gameTree.player, gameTree.moves);
    resetUI();
    if (gameTree.moves.length === 0) {
      showWinner(gameTree.board);
      recordStat(gameTree.board);
      if ($('#repeat-games:checked').length)
        showStat();
      setUpUIToReset();
    } else {
      playerTable[gameTree.player](gameTree);
    }
  }

  var stats = {};

  function recordStat(board) {
    var s = stats[[blackPlayerType(), whitePlayerType()]] || {b: 0, w: 0, d: 0};
    var r = judge(board);
    if (r === 1)
      s.b++;
    if (r === 0)
      s.d++;
    if (r === -1)
      s.w++;
    stats[[blackPlayerType(), whitePlayerType()]] = s;
  }

  function showStat() {
    var s = stats[[blackPlayerType(), whitePlayerType()]];
    $('#stats').text('Black: ' + s.b + ', White: ' + s.w + ', Draw: ' + s.d);
  }

  function resetGame() {
    $('#preference-pane :input:not(#repeat-games)')
      .removeClass('disabled')
      .removeAttr('disabled');
  }

  function startNewGame() {
    $('#preference-pane :input:not(#repeat-games)')
      .addClass('disabled')
      .attr('disabled', 'disabled');
    playerTable[BLACK] = makePlayer(blackPlayerType());
    playerTable[WHITE] = makePlayer(whitePlayerType());
    shiftToNewGameTree(makeGameTree(makeInitialGameBoard(), BLACK, false, 1));
  }




  // Startup {{{1

  $('#start-button').click(function () {startNewGame();});
  $('#add-new-ai-button').click(function () {addNewAI();});
  $('#swap-player-types-button').click(function () {swapPlayerTypes();});
  resetGame();
  drawGameBoard(makeInitialGameBoard(), '-', []);
})();
// vim: expandtab softtabstop=2 shiftwidth=2 foldmethod=marker
