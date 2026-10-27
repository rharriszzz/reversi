// Transparent evolutionary self-play. Candidate weights must beat the current
// model in matched openings, playing BOTH colors, before being accepted.
// A tiny tournament is not proof of improvement on unseen positions.
import { BLACK, WHITE, initialBoard, legalMoves, play, nextPlayer, winner, counts } from './rules.js';
import { cloneWeights, DEFAULT_WEIGHTS, FEATURE_NAMES, validWeights } from './features.js';
import { bestMove } from './search.js';

export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function proposeWeights(current, rng = Math.random) {
  const copy = cloneWeights(current);
  const phases = ['opening', 'middle', 'endgame'];
  const keys = Object.keys(FEATURE_NAMES);
  for (let k = 0; k < 3; k++) {
    const phase = phases[Math.floor(rng() * phases.length)];
    const feature = keys[Math.floor(rng() * keys.length)];
    const old = copy[phase][feature];
    const delta = (rng() * 2 - 1) * (5 + Math.abs(old) * 0.25);
    copy[phase][feature] = Math.max(-250, Math.min(250, Math.round((old + delta) * 10) / 10));
  }
  return copy;
}

export function randomOpening(rng, plies = 6) {
  let board = initialBoard(), player = BLACK;
  for (let ply = 0; ply < plies; ply++) {
    const choices = legalMoves(board, player);
    if (!choices.length) {
      player = -player;
      if (!legalMoves(board, player).length) break;
      continue;
    }
    board = play(board, player, choices[Math.floor(rng() * choices.length)]);
    player = nextPlayer(board, player);
    if (player === null) break;
  }
  return { board, player };
}

export function playModelMatch(opening, blackWeights, whiteWeights, depth = 2) {
  let board = Int8Array.from(opening.board);
  let player = opening.player;
  let ply = 0;
  while (player !== null && ply++ < 66) {
    const legal = legalMoves(board, player);
    if (!legal.length) {
      player = legalMoves(board, -player).length ? -player : null;
      continue;
    }
    const model = player === BLACK ? blackWeights : whiteWeights;
    const choice = bestMove(board, player, depth, model);
    if (!choice) throw new Error('Engine found no move where a legal move exists');
    board = play(board, player, choice.move);
    player = nextPlayer(board, player);
  }
  if (player !== null) throw new Error('Safety limit reached in self-play');
  return { result: winner(board), counts: counts(board) };
}

export function runGeneration(current = DEFAULT_WEIGHTS, options = {}) {
  if (!validWeights(current)) throw new Error('Invalid model weights');
  const seed = options.seed ?? 20261026;
  const depth = options.depth ?? 2;
  const openingPairs = options.openingPairs ?? 4;
  if (!Number.isInteger(openingPairs) || openingPairs < 1 || openingPairs > 16) throw new Error('Bad opening-pair count');
  if (!Number.isInteger(depth) || depth < 1 || depth > 5) throw new Error('Bad training depth');
  const rng = seededRandom(seed);
  const candidate = proposeWeights(current, rng);
  let wins = 0, draws = 0, losses = 0;
  const games = [];
  for (let p = 0; p < openingPairs; p++) {
    const opening = options.openings ? options.openings[p] : randomOpening(rng, 6);
    if (!opening?.board || ![BLACK, WHITE].includes(opening.player)) throw new Error('Invalid training opening');
    for (const candidateColor of [BLACK, WHITE]) {
      const match = playModelMatch(opening,
        candidateColor === BLACK ? candidate : current,
        candidateColor === WHITE ? candidate : current, depth);
      const outcome = match.result * candidateColor;
      if (outcome > 0) wins++;
      else if (outcome < 0) losses++;
      else draws++;
      games.push({ opening: p + 1, candidate: candidateColor === BLACK ? 'black' : 'white', outcome: outcome > 0 ? 'win' : outcome < 0 ? 'loss' : 'draw', counts: match.counts });
    }
  }
  // Require more than a bare majority in a very small noisy tournament.
  const points = wins + draws * 0.5;
  const total = games.length;
  const accepted = points / total >= 0.625;
  return { accepted, candidate, weights: accepted ? candidate : cloneWeights(current), wins, draws, losses, points, total, games, seed, depth };
}
