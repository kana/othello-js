(function () {
  var N = 4;

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
  }

  resetGame();
})();
// vim: expandtab softtabstop=2 shiftwidth=2
