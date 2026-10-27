// The SAME seven features, normalization, phase boundaries and summation order
// as features.js. Keep that original implementation as the readable reference.
import { DIRECTIONS } from './rules.js';
import { DEFAULT_WEIGHTS, FEATURE_NAMES } from './features.js';

const KEYS = Object.keys(FEATURE_NAMES);
const CORNERS = [[0,9,1,8], [7,14,6,15], [56,49,48,57], [63,54,55,62]];
const RAYS = Array.from({ length: 64 }, (_, square) => DIRECTIONS.map(([dr, dc]) => {
  const ray = [];
  for (let r=(square>>3)+dr, c=(square&7)+dc; r>=0 && r<8 && c>=0 && c<8; r+=dr, c+=dc) ray.push(r*8+c);
  return ray;
}).filter(ray => ray.length));
const normalized = (a,b,offset=0) => (a-b)/(a+b+offset || 1);

export function countLegalMovesFast(board, player) {
  let count = 0;
  for (let square=0; square<64; square++) {
    if (board[square]) continue;
    for (const ray of RAYS[square]) {
      if (board[ray[0]] !== -player) continue;
      let index = 1;
      while (index<ray.length && board[ray[index]] === -player) index++;
      if (index<ray.length && board[ray[index]] === player) { count++; break; }
    }
  }
  return count;
}

// Research option: allocate only the returned list, never temporary flip lines.
// Original legalMoves/flipsFor remain the rule oracle and production default.
export function legalMovesFast(board, player) {
  const moves = [];
  for (let square = 0; square < 64; square++) {
    if (board[square]) continue;
    for (const ray of RAYS[square]) {
      if (board[ray[0]] !== -player) continue;
      let index = 1;
      while (index < ray.length && board[ray[index]] === -player) index++;
      if (index < ray.length && board[ray[index]] === player) { moves.push(square); break; }
    }
  }
  return moves;
}

function scan(board, player, knownOwnMoves) {
  const other = -player;
  let ownDiscs=0, otherDiscs=0, ownFrontier=0, otherFrontier=0;
  let ownPotential=0, otherPotential=0, ownMoves=knownOwnMoves ?? 0, otherMoves=0;
  for (let square=0; square<64; square++) {
    const owner = board[square];
    if (owner) {
      if (owner === player) ownDiscs++; else otherDiscs++;
      for (const ray of RAYS[square]) if (board[ray[0]] === 0) {
        if (owner === player) ownFrontier++; else otherFrontier++;
        break;
      }
    } else {
      let ownNeighbor=false, otherNeighbor=false, ownLegal=false, otherLegal=false;
      for (const ray of RAYS[square]) {
        const first = board[ray[0]];
        if (!first) continue;
        if (first === player) ownNeighbor=true; else otherNeighbor=true;
        // Adjacent own discs may bracket an opponent move; adjacent opponent
        // discs may bracket ours. Skip only mobility already known, not the
        // neighbor information needed for potential mobility above.
        if (first === player ? otherLegal : ownLegal || knownOwnMoves !== undefined) continue;
        let index=1;
        while (index<ray.length && board[ray[index]] === first) index++;
        if (index<ray.length && board[ray[index]] === -first) {
          if (first === player) otherLegal=true; else ownLegal=true;
        }
      }
      if (otherNeighbor) ownPotential++;
      if (ownNeighbor) otherPotential++;
      if (ownLegal) ownMoves++;
      if (otherLegal) otherMoves++;
    }
  }
  let ownCorners=0, otherCorners=0, ownX=0, otherX=0, ownC=0, otherC=0;
  for (const [corner,x,c1,c2] of CORNERS) {
    if (board[corner] === player) ownCorners++;
    if (board[corner] === other) otherCorners++;
    if (!board[corner]) {
      if (board[x] === player) ownX++;
      if (board[x] === other) otherX++;
      if (board[c1] === player) ownC++;
      if (board[c2] === player) ownC++;
      if (board[c1] === other) otherC++;
      if (board[c2] === other) otherC++;
    }
  }
  return { occupied:ownDiscs+otherDiscs, features:{
    mobility:normalized(ownMoves,otherMoves,2), potential:normalized(ownPotential,otherPotential,2),
    corners:(ownCorners-otherCorners)/4, xSquares:(otherX-ownX)/4,
    cSquares:(otherC-ownC)/8, frontier:normalized(otherFrontier,ownFrontier,2),
    discs:normalized(ownDiscs,otherDiscs),
  }};
}

export function extractFeaturesFast(board, player, knownOwnMoves) {
  return scan(board,player,knownOwnMoves).features;
}

export function evaluateFast(board, player, weights=DEFAULT_WEIGHTS, knownOwnMoves) {
  const {features,occupied} = scan(board,player,knownOwnMoves);
  const phase = occupied<28 ? 'opening' : occupied<52 ? 'middle' : 'endgame';
  let score=0;
  for (const key of KEYS) score += weights[phase][key]*features[key];
  return score;
}
