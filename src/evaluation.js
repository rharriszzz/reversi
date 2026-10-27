// Experimental positional evaluators. Original features/weights and browser
// defaults remain in features.js; no extra feature is required by saved models.
import { counts } from './rules.js';
import { DEFAULT_WEIGHTS, FEATURE_NAMES, extractFeatures, evaluate } from './features.js';
import { evaluateFast } from './fast-features.js';

const KEYS = Object.keys(FEATURE_NAMES);
const EDGES = [[0, 1], [0, 8], [7, -1], [7, 8], [56, 1], [56, -8], [63, -1], [63, -8]];
const CORNERS = new Set([0, 7, 56, 63]);

// Conservative subset of stable discs: same-colored uninterrupted edge runs
// from occupied corners. Exclude corners (already scored) and deduplicate runs.
export function anchoredEdgeDiscs(board) {
  const stable = new Set();
  for (const [corner, step] of EDGES) {
    const owner = board[corner];
    if (!owner) continue;
    for (let distance = 1; distance < 8; distance++) {
      const square = corner + step * distance;
      if (board[square] !== owner) break;
      if (!CORNERS.has(square)) stable.add(square);
    }
  }
  return [...stable];
}

export function stableEdgeFeature(board, player) {
  return anchoredEdgeDiscs(board).reduce((sum, square) => sum + board[square] * player, 0) / 24;
}

// Linear interpolation through the unchanged opening/middle/endgame weight
// vectors at 4/40/64 occupied squares. No tuned or learned constants.
export function smoothWeights(occupied, weights = DEFAULT_WEIGHTS) {
  const first = occupied <= 40 ? 'opening' : 'middle';
  const second = occupied <= 40 ? 'middle' : 'endgame';
  const fraction = Math.max(0, Math.min(1, occupied <= 40 ? (occupied - 4) / 36 : (occupied - 40) / 24));
  return Object.fromEntries(KEYS.map(key => [key, weights[first][key] * (1 - fraction) + weights[second][key] * fraction]));
}

export function makeEvaluator({ stableEdgeWeight = 0, smooth = false } = {}) {
  if (!Number.isFinite(stableEdgeWeight) || Math.abs(stableEdgeWeight) > 250) throw new Error('Bad stable edge weight');
  return (board, player, weights = DEFAULT_WEIGHTS) => {
    let score;
    if (smooth) {
      const features = extractFeatures(board, player);
      const blended = smoothWeights(64 - counts(board).empty, weights);
      score = KEYS.reduce((sum, key) => sum + features[key] * blended[key], 0);
    } else score = evaluate(board, player, weights);
    return stableEdgeWeight ? score + stableEdgeWeight * stableEdgeFeature(board, player) : score;
  };
}

// Knowledge experiment on the SAME fast implementation as strategy B, so the
// C-vs-B comparison isolates stable-edge knowledge and its incremental cost.
export function makeFastStableEvaluator(weight) {
  if (!Number.isFinite(weight) || weight<0 || weight>250) throw new Error('Bad stable edge weight');
  return (board,player,weights=DEFAULT_WEIGHTS,knownOwnMoves) =>
    evaluateFast(board,player,weights,knownOwnMoves) + weight*stableEdgeFeature(board,player);
}

export const EVALUATORS = Object.freeze({
  baseline: evaluate,
  stableEdges: makeEvaluator({ stableEdgeWeight: 60 }),
  smooth: makeEvaluator({ smooth: true }),
});
