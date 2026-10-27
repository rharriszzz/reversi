import { scoreAllMoves } from './search.js';

// Review every recorded decision at one stated depth and one fixed model.
export function reviewGame(history, depth, weights, human) {
  return history.flatMap((frame, index) => {
    if (frame.player !== human) return [];
    const analysis = scoreAllMoves(Int8Array.from(frame.board), frame.player, depth, weights);
    const chosen = analysis.results.find(row => row.move === frame.move);
    const best = analysis.results[0];
    return [{ index, played: chosen.notation, best: best.notation,
      score: chosen.score, bestScore: best.score, loss: best.score - chosen.score,
      exact: analysis.exact, pv: best.pv, depth }];
  }).sort((a, b) => b.loss - a.loss || a.index - b.index);
}
