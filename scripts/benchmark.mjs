import { scoreAllMoves } from '../src/search.js';
import { randomOpening, seededRandom } from '../src/learning.js';

const positions = [0, 20, 40].map(plies => ({ plies, ...randomOpening(seededRandom(123), plies) }));
for (const position of positions) scoreAllMoves(position.board, position.player, 3);
for (const position of positions) for (const depth of [3, 4, 5]) {
  const samples = Array.from({ length: 5 }, () => scoreAllMoves(position.board, position.player, depth));
  console.log(JSON.stringify({ openingSeed: 123, plies: position.plies, depth,
    nodes: samples[0].nodes, medianMs: samples.map(a => a.elapsedMs).sort((a, b) => a - b)[2] }));
}
