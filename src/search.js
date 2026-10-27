// Negamax with alpha-beta pruning, transposition table and ordered moves.
// The root explicitly scores EVERY legal move with a full search window.
import { counts, coord, legalMoves, play } from './rules.js';
import { evaluate, evaluateDetailed, DEFAULT_WEIGHTS } from './features.js';

const INF = 1e9;
const CORNERS = new Set([0, 7, 56, 63]);
const X_DANGER = new Map([[9, 0], [14, 7], [49, 56], [54, 63]]);
const C_DANGER = new Map([[1, 0], [8, 0], [6, 7], [15, 7], [48, 56], [57, 56], [55, 63], [62, 63]]);

function heuristicMovePriority(board, move) {
  if (CORNERS.has(move)) return 1000;
  let priority = 0;
  if (X_DANGER.has(move) && board[X_DANGER.get(move)] === 0) priority -= 150;
  if (C_DANGER.has(move) && board[C_DANGER.get(move)] === 0) priority -= 45;
  const r = Math.floor(move / 8), c = move % 8;
  if (r === 0 || r === 7 || c === 0 || c === 7) priority += 35;
  return priority;
}

export function orderMoves(board, moves, favored = null) {
  return [...moves].sort((a, b) =>
    (b === favored ? 2000 : heuristicMovePriority(board, b)) -
    (a === favored ? 2000 : heuristicMovePriority(board, a)) || a - b);
}

export function terminalScore(board, player) {
  const { black, white } = counts(board);
  const margin = (black - white) * player;
  return margin === 0 ? 0 : Math.sign(margin) * 10000 + margin;
}

function positionKey(board, player) {
  return String(player) + ':' + board.join('');
}

function negamax(board, player, depth, alpha, beta, ctx) {
  ctx.nodes++;
  const key = positionKey(board, player);
  const oldAlpha = alpha, oldBeta = beta;
  const horizonBefore = ctx.horizonHits;
  const stored = ctx.table.get(key);
  if (stored && stored.depth >= depth) {
    if (!stored.solved) ctx.horizonHits++;
    if (stored.flag === 'exact') return stored.score;
    if (stored.flag === 'lower') alpha = Math.max(alpha, stored.score);
    if (stored.flag === 'upper') beta = Math.min(beta, stored.score);
    if (alpha >= beta) return stored.score;
  }

  const moves = legalMoves(board, player);
  if (moves.length === 0) {
    const opponentMoves = legalMoves(board, -player);
    if (!opponentMoves.length) return terminalScore(board, player);
    // Passes do not consume one ply of move depth.
    return -negamax(board, -player, depth, -beta, -alpha, ctx);
  }
  if (depth <= 0) {
    ctx.horizonHits++;
    return evaluate(board, player, ctx.weights);
  }

  let best = -INF, bestMove = null;
  for (const move of orderMoves(board, moves, stored?.bestMove)) {
    const child = play(board, player, move);
    const value = -negamax(child, -player, depth - 1, -beta, -alpha, ctx);
    if (value > best) {
      best = value;
      bestMove = move;
    }
    alpha = Math.max(alpha, best);
    if (alpha >= beta) break;
  }
  let flag = 'exact';
  if (best <= oldAlpha) flag = 'upper';
  else if (best >= oldBeta) flag = 'lower';
  if (ctx.table.size < ctx.tableLimit) ctx.table.set(key, {
    depth, score: best, flag, bestMove, solved: ctx.horizonHits === horizonBefore,
  });
  return best;
}

function principalVariation(board, player, remaining, ctx) {
  const continuation = [];
  let current = board, toMove = player;
  while (true) {
    const moves = legalMoves(current, toMove);
    if (!moves.length) {
      if (!legalMoves(current, -toMove).length) break;
      continuation.push('pass');
      toMove = -toMove;
      continue;
    }
    if (remaining <= 0) break;
    // A TT move from a cutoff is only a bound. Verify every continuation move
    // against a full-window value at the SAME remaining depth.
    const value = negamax(current, toMove, remaining, -INF, INF, ctx);
    const favored = ctx.table.get(positionKey(current, toMove))?.bestMove;
    const choice = orderMoves(current, moves, favored).find(move =>
      -negamax(play(current, toMove, move), -toMove, remaining - 1, -INF, INF, ctx) === value);
    if (choice === undefined) throw new Error('Could not verify search continuation');
    continuation.push(coord(choice));
    current = play(current, toMove, choice);
    toMove = -toMove;
    remaining--;
  }
  return continuation;
}

export function scoreAllMoves(board, player, depth = 3, weights = DEFAULT_WEIGHTS) {
  if (!Number.isInteger(depth) || depth < 1 || depth > 14) throw new Error('Depth must be 1..14');
  const start = performance.now();
  const ctx = { nodes: 0, horizonHits: 0, table: new Map(), tableLimit: 150000, weights };
  const moves = orderMoves(board, legalMoves(board, player));
  const results = [];
  for (const move of moves) {
    const child = play(board, player, move);
    const horizonBefore = ctx.horizonHits;
    const score = -negamax(child, -player, depth - 1, -INF, INF, ctx);
    const exact = counts(board).empty <= depth || ctx.horizonHits === horizonBefore;
    // Static features after playing are explanatory evidence, NOT the search score.
    const immediate = evaluateDetailed(child, player, weights);
    results.push({
      move, notation: coord(move), score, exact,
      immediate,
      pv: [coord(move), ...principalVariation(child, -player, depth - 1, ctx)],
    });
  }
  results.sort((a, b) => b.score - a.score || a.move - b.move);
  return {
    depth,
    exact: results.length ? results.every(row => row.exact)
      : !legalMoves(board, -player).length || counts(board).empty <= depth,
    player,
    results,
    nodes: ctx.nodes,
    elapsedMs: Math.round((performance.now() - start) * 10) / 10,
  };
}

export function bestMove(board, player, depth = 3, weights = DEFAULT_WEIGHTS) {
  return scoreAllMoves(board, player, depth, weights).results[0] ?? null;
}
