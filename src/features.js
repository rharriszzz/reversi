// Fully explicit, inspectable positional evaluator. Every feature is from the
// point of view of `player`: positive is advantageous for that player.
import { counts, legalMoves, DIRECTIONS } from './rules.js';

export const FEATURE_NAMES = {
  mobility: 'Legal-move mobility',
  potential: 'Potential mobility',
  corners: 'Occupied corners',
  xSquares: 'X-square exposure',
  cSquares: 'C-square exposure',
  frontier: 'Frontier discs',
  discs: 'Disc advantage',
};

// These are intentionally simple initial weights, NOT learned/optimal values.
export const DEFAULT_WEIGHTS = Object.freeze({
  opening: Object.freeze({ mobility: 55, potential: 12, corners: 115, xSquares: 90, cSquares: 35, frontier: 20, discs: -20 }),
  middle:  Object.freeze({ mobility: 45, potential: 8,  corners: 120, xSquares: 80, cSquares: 30, frontier: 12, discs: -8 }),
  endgame: Object.freeze({ mobility: 12, potential: 0, corners: 120, xSquares: 65, cSquares: 15, frontier: 0, discs: 75 }),
});

const CORNER_NEIGHBORS = [
  { corner: 0, x: 9, c: [1, 8] },
  { corner: 7, x: 14, c: [6, 15] },
  { corner: 56, x: 49, c: [48, 57] },
  { corner: 63, x: 54, c: [55, 62] },
];

export function cloneWeights(weights = DEFAULT_WEIGHTS) {
  return Object.fromEntries(['opening', 'middle', 'endgame'].map(phase => [phase, { ...weights[phase] }]));
}

export function validWeights(w) {
  return !!w && ['opening', 'middle', 'endgame'].every(phase =>
    w[phase] && Object.keys(FEATURE_NAMES).every(k =>
      typeof w[phase][k] === 'number' && Number.isFinite(w[phase][k]) && Math.abs(w[phase][k]) <= 1000));
}

export function phaseOf(board) {
  const occupied = 64 - counts(board).empty;
  return occupied < 28 ? 'opening' : occupied < 52 ? 'middle' : 'endgame';
}

const normalized = (a, b, offset = 0) => (a - b) / (a + b + offset || 1);

// Board geometry never changes. Precompute it once, avoiding 64 temporary
// adjacency arrays and repeated coordinate arithmetic at every search leaf.
const NEIGHBORS = Array.from({ length: 64 }, (_, i) => DIRECTIONS.flatMap(([dr, dc]) => {
  const r = (i >> 3) + dr, c = (i & 7) + dc;
  return r >= 0 && r < 8 && c >= 0 && c < 8 ? [r * 8 + c] : [];
}));

export function extractFeatures(board, player) {
  const other = -player;
  const ownMoves = legalMoves(board, player).length;
  const otherMoves = legalMoves(board, other).length;
  let ownCorners = 0, otherCorners = 0;
  let ownX = 0, otherX = 0, ownC = 0, otherC = 0;
  for (const { corner, x, c } of CORNER_NEIGHBORS) {
    if (board[corner] === player) ownCorners++;
    if (board[corner] === other) otherCorners++;
    if (board[corner] === 0) {
      if (board[x] === player) ownX++;
      if (board[x] === other) otherX++;
      for (const square of c) {
        if (board[square] === player) ownC++;
        if (board[square] === other) otherC++;
      }
    }
  }
  let ownFrontier = 0, otherFrontier = 0, ownPotential = 0, otherPotential = 0;
  let ownDiscs = 0, otherDiscs = 0;
  for (let i = 0; i < 64; i++) {
    let emptyNeighbor = false, ownNeighbor = false, otherNeighbor = false;
    for (const neighbor of NEIGHBORS[i]) {
      const value = board[neighbor];
      if (value === 0) emptyNeighbor = true;
      else if (value === player) ownNeighbor = true;
      else if (value === other) otherNeighbor = true;
    }
    if (board[i] === player) {
      ownDiscs++;
      if (emptyNeighbor) ownFrontier++;
    } else if (board[i] === other) {
      otherDiscs++;
      if (emptyNeighbor) otherFrontier++;
    } else {
      // Empty squares next to *opponent* discs are potential moves for us.
      if (otherNeighbor) ownPotential++;
      if (ownNeighbor) otherPotential++;
    }
  }
  return {
    mobility: normalized(ownMoves, otherMoves, 2),
    potential: normalized(ownPotential, otherPotential, 2),
    corners: (ownCorners - otherCorners) / 4,
    xSquares: (otherX - ownX) / 4,
    cSquares: (otherC - ownC) / 8,
    frontier: normalized(otherFrontier, ownFrontier, 2),
    discs: normalized(ownDiscs, otherDiscs),
  };
}

export function evaluateDetailed(board, player, weights = DEFAULT_WEIGHTS) {
  const phase = phaseOf(board);
  const features = extractFeatures(board, player);
  const contributions = {};
  let score = 0;
  for (const k of Object.keys(FEATURE_NAMES)) {
    contributions[k] = weights[phase][k] * features[k];
    score += contributions[k];
  }
  return { score, features, contributions, phase };
}

export function evaluate(board, player, weights = DEFAULT_WEIGHTS) {
  return evaluateDetailed(board, player, weights).score;
}
