import test from 'node:test';
import assert from 'node:assert/strict';
import { BLACK, WHITE, initialBoard, legalMoves, coord, parseCoord, play, counts, boardFromRows, nextPlayer, isTerminal } from '../src/rules.js';

test('opening legal moves and coordinate round trips', () => {
  const board = initialBoard();
  assert.deepEqual(legalMoves(board, BLACK).map(coord), ['D3', 'C4', 'F5', 'E6']);
  assert.deepEqual(legalMoves(board, WHITE).map(coord), ['E3', 'F4', 'C5', 'D6']);
  for (let i = 0; i < 64; i++) assert.equal(parseCoord(coord(i)), i);
});

test('move flips pieces without mutating board; illegal move rejected', () => {
  const b = initialBoard();
  const after = play(b, BLACK, parseCoord('D3'));
  assert.deepEqual(counts(after), { black: 4, white: 1, empty: 59 });
  assert.deepEqual(counts(b), { black: 2, white: 2, empty: 60 });
  assert.throws(() => play(b, BLACK, parseCoord('A1')));
});

test('passing keeps turn with player who has legal moves', () => {
  // B can play a1 to flip b1, whereas W has no legal move.
  const board = boardFromRows([
    '.WBBBBBB',
    'BBBBBBBB',
    'BBBBBBBB',
    'BBBBBBBB',
    'BBBBBBBB',
    'BBBBBBBB',
    'BBBBBBBB',
    'BBBBBBBB',
  ]);
  assert.equal(legalMoves(board, WHITE).length, 0);
  assert.deepEqual(legalMoves(board, BLACK).map(coord), ['A1']);
  assert.equal(nextPlayer(board, WHITE), BLACK);
  assert.equal(isTerminal(play(board, BLACK, parseCoord('A1'))), true);
});

test('no legal moves for either player terminates even with empty squares', () => {
  const b = boardFromRows(['BBBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBB.']);
  assert.equal(isTerminal(b), true);
  assert.equal(nextPlayer(b, BLACK), null);
});

test('opening perft reference counts through five plies', () => {
  function perft(board, player, depth) {
    if (depth === 0) return 1;
    const moves = legalMoves(board, player);
    if (!moves.length) return legalMoves(board, -player).length ? perft(board, -player, depth) : 1;
    return moves.reduce((sum, move) => sum + perft(play(board, player, move), -player, depth - 1), 0);
  }
  const expected = [1, 4, 12, 56, 244, 1396];
  for (let depth = 0; depth < expected.length; depth++) {
    assert.equal(perft(initialBoard(), BLACK, depth), expected[depth], `depth ${depth}`);
  }
});
