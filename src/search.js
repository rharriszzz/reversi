// Negamax with alpha-beta pruning, transposition table and ordered moves.
// The root explicitly scores EVERY legal move with a full search window.
import { counts, coord, legalMoves, play } from './rules.js';
import { evaluateDetailed, DEFAULT_WEIGHTS } from './features.js';
import { evaluateFast } from './fast-features.js';

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
  if (ctx.deadline !== null && ctx.now() >= ctx.deadline) throw TIMEOUT;
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
    ctx.evaluations++;
    // The evaluator may reuse this already generated mobility count. Reference
    // evaluators ignore the optional fourth argument and retain identical math.
    return ctx.evaluate(board, player, ctx.weights, moves.length);
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

function checkDepth(depth) {
  if (!Number.isInteger(depth) || depth < 1 || depth > 14) throw new Error('Depth must be 1..14');
}

function context(weights, evaluator = evaluateFast, now = () => performance.now(), deadline = null) {
  return { nodes: 0, evaluations: 0, horizonHits: 0, table: new Map(), tableLimit: 150000,
    weights, evaluate: evaluator, now, deadline };
}

export function scoreAllMoves(board, player, depth = 3, weights = DEFAULT_WEIGHTS) {
  checkDepth(depth);
  const start = performance.now();
  const ctx = context(weights);
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
    evaluations: ctx.evaluations,
    immediateEvaluations: results.length,
    elapsedMs: Math.round((performance.now() - start) * 10) / 10,
  };
}

const TIMEOUT = Symbol('search deadline');

// Playing needs only the best root value. Carry alpha between candidates;
// other root values may be bounds and are deliberately NOT shown as coaching.
function searchRoot(board, player, depth, ctx, favored) {
  const moves = orderMoves(board, legalMoves(board, player), favored);
  const before = ctx.horizonHits;
  if (!moves.length) return { move: null, score: negamax(board, player, depth, -INF, INF, ctx),
    exact: ctx.horizonHits === before };
  let score = -INF, choice = moves[0];
  for (const move of moves) {
    const value = -negamax(play(board, player, move), -player, depth - 1, -INF, -score, ctx);
    if (value > score) { score = value; choice = move; }
  }
  return { move: choice, notation: coord(choice), score,
    exact: counts(board).empty <= depth || ctx.horizonHits === before };
}

// Optional iterative deepening uses ONLY the last completed iteration. A tiny
// budget may return an explicitly unsearched legal fallback (depth 0, score null).
export function findBestMove(board, player, depth = 3, weights = DEFAULT_WEIGHTS, options = {}) {
  checkDepth(depth);
  if (options.timeMs !== undefined && (!Number.isFinite(options.timeMs) || options.timeMs <= 0)) {
    throw new Error('timeMs must be a positive finite number');
  }
  const now = options.now ?? (() => performance.now()), start = now();
  const timed = options.timeMs !== undefined;
  const ctx = context(weights, options.evaluate ?? evaluateFast, now, timed ? start + options.timeMs : null);
  let result = { move: orderMoves(board, legalMoves(board, player))[0] ?? null,
    score: null, exact: false, depth: 0 };
  let timedOut = false;
  for (let current = timed ? 1 : depth; current <= depth; current++) {
    // TT scores at another horizon are not the same minimax value. Retain only
    // the last root choice for ordering; each iteration gets fresh bounds.
    ctx.table.clear();
    try {
      result = { ...searchRoot(board, player, current, ctx, result.move), depth: current };
    } catch (error) {
      if (error !== TIMEOUT) throw error;
      timedOut = true; break;
    }
    if (!timed || result.exact) break;
  }
  return { ...result, player, nodes: ctx.nodes, evaluations: ctx.evaluations,
    elapsedMs: now() - start, timedOut, budgetMs: options.timeMs ?? null };
}

export function bestMove(board, player, depth = 3, weights = DEFAULT_WEIGHTS, options = {}) {
  const result = findBestMove(board, player, depth, weights, options);
  return result.move === null ? null : result;
}
