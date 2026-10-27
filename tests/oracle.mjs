// Independent 10x10 sentinel-board rules and exhaustive solver. Deliberately
// imports no production rules/search, so shared move-generation bugs are caught.
const steps = [-11, -10, -9, -1, 1, 9, 10, 11];
export function oracleChildren(board, player) {
  const mailbox = Array(100).fill(2);
  for (let i = 0; i < 64; i++) mailbox[11 + (i >> 3) * 10 + (i & 7)] = board[i];
  const result = [];
  for (let move = 0; move < 64; move++) {
    const at = 11 + (move >> 3) * 10 + (move & 7);
    if (mailbox[at] !== 0) continue;
    const flips = [];
    for (const step of steps) {
      let cursor = at + step;
      while (mailbox[cursor] === -player) cursor += step;
      if (mailbox[cursor] !== player) continue;
      for (let pos = at + step; pos !== cursor; pos += step) flips.push(pos);
    }
    if (!flips.length) continue;
    const next = [...mailbox]; next[at] = player;
    for (const flip of flips) next[flip] = player;
    result.push({ move, board: Array.from({ length: 64 }, (_, i) => next[11 + (i >> 3) * 10 + (i & 7)]) });
  }
  return result;
}
export function oracleScore(board, player, depth = Infinity, evaluator = null) {
  const moves = oracleChildren(board, player);
  if (!moves.length) {
    if (oracleChildren(board, -player).length) return -oracleScore(board, -player, depth, evaluator);
    const margin = board.reduce((sum, value) => sum + value * player, 0);
    return margin ? Math.sign(margin) * 10000 + margin : 0;
  }
  if (depth <= 0) return evaluator(board, player);
  return Math.max(...moves.map(child => -oracleScore(child.board, -player, depth - 1, evaluator)));
}
