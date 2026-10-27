// All costly searches/training run outside the browser UI thread.
import { scoreAllMoves, bestMove } from './search.js';
import { runGeneration } from './learning.js';
import { reviewGame } from './review.js';

self.onmessage = (event) => {
  const { type, id, board, player, depth, weights, options, history, human } = event.data;
  try {
    if (type === 'analyze') {
      const analysis = scoreAllMoves(Int8Array.from(board), player, depth, weights);
      self.postMessage({ type: 'analyzed', id, analysis });
    } else if (type === 'play') {
      self.postMessage({ type: 'played', id, choice: bestMove(Int8Array.from(board), player, depth, weights) });
    } else if (type === 'review') {
      self.postMessage({ type: 'reviewed', id, rows: reviewGame(history, depth, weights, human) });
    } else if (type === 'train') {
      const outcome = runGeneration(weights, options);
      self.postMessage({ type: 'trained', id, outcome });
    } else {
      throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({ type: 'error', id, message: String(error?.stack ?? error) });
  }
};
