import { legalMoves, flipsFor, play, nextPlayer, winner, counts } from '../src/rules.js';
import { DEFAULT_WEIGHTS } from '../src/features.js';
import { findBestMove } from '../src/search.js';
import { seededRandom } from '../src/learning.js';

export function pairedSummary(points) {
  const mean = points.reduce((sum, value) => sum + value, 0) / points.length;
  const radius = Math.sqrt(Math.log(40) / (2 * points.length));
  return { openingPairs: points.length, games: 2 * points.length, scoreRate: mean,
    interval95: [Math.max(0, mean - radius), Math.min(1, mean + radius)],
    uncertainty: 'Exploratory conservative Hoeffding interval on opening-pair mean points', pairPoints: points };
}

export function playExperimentGame(opening, black, white, budget, seed = 1) {
  let board = Int8Array.from(opening.board), player = opening.player;
  const rng = seededRandom(seed), stats = { black: [], white: [] };
  for (let placements = 0; player !== null && placements < 64; placements++) {
    const moves = legalMoves(board, player);
    if (!moves.length) { player = legalMoves(board, -player).length ? -player : null; continue; }
    const engine = player === 1 ? black : white;
    let move;
    if (engine.reference === 'random') move = moves[Math.floor(rng() * moves.length)];
    else if (engine.reference === 'greedy') move = [...moves].sort((a,b) =>
      flipsFor(board, player, b).length - flipsFor(board, player, a).length || a-b)[0];
    else {
      const result = findBestMove(board, player, budget.depth ?? 14, engine.weights ?? DEFAULT_WEIGHTS,
        { evaluate: engine.evaluate, timeMs: budget.timeMs });
      move = result.move;
      stats[player === 1 ? 'black' : 'white'].push({ depth: result.depth, nodes: result.nodes,
        evaluations: result.evaluations, elapsedMs: result.elapsedMs, budgetMs: result.budgetMs });
    }
    if (!moves.includes(move)) throw new Error('Illegal experimental move');
    board = play(board, player, move); player = nextPlayer(board, player);
  }
  if (player !== null) throw new Error('Experimental game did not finish');
  return { winner: winner(board), counts: counts(board), stats };
}

export function pairedMatch(candidate, baseline, openings, budget, seed = 1) {
  const games = [], pairPoints = [];
  let wins = 0, draws = 0, losses = 0;
  for (const [index, opening] of openings.entries()) {
    let points = 0;
    for (const color of index % 2 ? [-1, 1] : [1, -1]) {
      const match = playExperimentGame(opening, color === 1 ? candidate : baseline,
        color === -1 ? candidate : baseline, budget, seed + index);
      const result = match.winner * color;
      if (result > 0) wins++; else if (result < 0) losses++; else draws++;
      points += result > 0 ? 1 : result < 0 ? 0 : 0.5;
      games.push({ opening: index, candidateColor: color, outcome: result, ...match });
    }
    pairPoints.push(points/2);
  }
  return { candidate: candidate.name, opponent: baseline.name, budget, wins, draws, losses,
    ...pairedSummary(pairPoints), games };
}
