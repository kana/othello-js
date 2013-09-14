othello.registerAI({
  findTheBestMove: function (gameTree) {
    return gameTree.moves[Math.floor(Math.random() * gameTree.moves.length)];
  }
});
// vim: expandtab softtabstop=2 shiftwidth=2 foldmethod=marker
