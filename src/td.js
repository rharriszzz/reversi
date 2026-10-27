// Experimental linear TD(0), kept separate from the game's default model.
// Fixed baseline play supplies trajectories. One transition moves the current
// state's BLACK value toward the next state's value; terminal targets use
// 100 * actual disc margin / 64, not the engine's win/loss search sentinel.
import { BLACK, legalMoves, play, nextPlayer, counts } from './rules.js';
import { cloneWeights, evaluate, extractFeatures, phaseOf, validWeights } from './features.js';
import { bestMove } from './search.js';

export function trainLinearTD(initial, openings, { depth = 1, rate = 0.03, epochs = 1 } = {}) {
  if (!validWeights(initial) || !openings.length || !Number.isFinite(rate) || rate <= 0 || rate > 1
      || !Number.isInteger(depth) || depth < 1 || depth > 5
      || !Number.isInteger(epochs) || epochs < 1 || epochs > 10) throw new Error('Invalid TD configuration');
  const weights = cloneWeights(initial);
  let transitions = 0;
  for (let epoch = 0; epoch < epochs; epoch++) for (const opening of openings) {
    let board = Int8Array.from(opening.board), player = opening.player;
    while (player !== null) {
      if (!legalMoves(board, player).length) { player = legalMoves(board, -player).length ? -player : null; continue; }
      const move = bestMove(board, player, depth, initial).move;
      const child = play(board, player, move), next = nextPlayer(child, player);
      const total = counts(child);
      const target = next === null ? 100 * (total.black - total.white) / 64 : evaluate(child, BLACK, weights);
      const error = target - evaluate(board, BLACK, weights);
      const features = extractFeatures(board, BLACK), phase = phaseOf(board);
      const norm = Math.max(1, Object.values(features).reduce((sum, value) => sum + value * value, 0));
      for (const key of Object.keys(features)) {
        weights[phase][key] = Math.max(-250, Math.min(250, weights[phase][key] + rate * error * features[key] / norm));
      }
      transitions++; board = child; player = next;
    }
  }
  return { format: 'reversi-linear-td-v1', weights, transitions, depth, rate, epochs,
    target: 'black disc margin / 64 * 100', policy: 'fixed initial weights' };
}
