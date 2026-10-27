// Reversi rules, independent of the interface, evaluator and search.
export const BLACK = 1;
export const WHITE = -1;
export const EMPTY = 0;
export const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],            [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

export function initialBoard() {
  const board = new Int8Array(64);
  board[3 * 8 + 3] = WHITE; // d4
  board[3 * 8 + 4] = BLACK; // e4
  board[4 * 8 + 3] = BLACK; // d5
  board[4 * 8 + 4] = WHITE; // e5
  return board;
}

export function coord(index) {
  if (!Number.isInteger(index) || index < 0 || index >= 64) return '--';
  return String.fromCharCode(65 + index % 8) + (1 + Math.floor(index / 8));
}

export function parseCoord(s) {
  if (typeof s !== 'string' || !/^[a-h][1-8]$/i.test(s)) return -1;
  return (Number(s[1]) - 1) * 8 + s.toUpperCase().charCodeAt(0) - 65;
}

export function flipsFor(board, player, move) {
  if (move < 0 || move >= 64 || !Number.isInteger(move) || board[move] !== EMPTY) return [];
  const row = Math.floor(move / 8);
  const col = move % 8;
  const result = [];
  for (const [dr, dc] of DIRECTIONS) {
    let r = row + dr, c = col + dc;
    const line = [];
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === -player) {
      line.push(r * 8 + c);
      r += dr;
      c += dc;
    }
    if (line.length && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === player) {
      result.push(...line);
    }
  }
  return result;
}

export function legalMoves(board, player) {
  const moves = [];
  for (let i = 0; i < 64; i++) {
    if (board[i] === EMPTY && flipsFor(board, player, i).length) moves.push(i);
  }
  return moves;
}

export function play(board, player, move) {
  const flips = flipsFor(board, player, move);
  if (!flips.length) throw new Error(`Illegal move ${coord(move)} for ${player}`);
  const result = Int8Array.from(board);
  result[move] = player;
  for (const i of flips) result[i] = player;
  return result;
}

export function counts(board) {
  let black = 0, white = 0;
  for (const v of board) {
    if (v === BLACK) black++;
    else if (v === WHITE) white++;
  }
  return { black, white, empty: 64 - black - white };
}

export function winner(board) {
  const { black, white } = counts(board);
  return Math.sign(black - white);
}

// A player without a legal move passes, unless neither side can move.
export function nextPlayer(board, justMoved) {
  if (legalMoves(board, -justMoved).length) return -justMoved;
  if (legalMoves(board, justMoved).length) return justMoved;
  return null; // game finished
}

export function isTerminal(board) {
  return !legalMoves(board, BLACK).length && !legalMoves(board, WHITE).length;
}

export function boardFromRows(rows) {
  if (rows.length !== 8 || rows.some(r => r.length !== 8)) throw new Error('Expected eight eight-character rows');
  const b = new Int8Array(64);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const char = rows[r][c].toUpperCase();
    if (!'.BW'.includes(char)) throw new Error(`Invalid board character: ${rows[r][c]}`);
    b[r * 8 + c] = char === 'B' ? BLACK : char === 'W' ? WHITE : EMPTY;
  }
  return b;
}

export function boardToRows(board) {
  const rows = [];
  for (let r = 0; r < 8; r++) {
    rows.push(Array.from(board.slice(8 * r, 8 * r + 8), p => p === BLACK ? 'B' : p === WHITE ? 'W' : '.').join(''));
  }
  return rows;
}
