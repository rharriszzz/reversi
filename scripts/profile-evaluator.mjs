// Sampling workload for A or B, kept separate from timed tournaments.
import { evaluate } from '../src/features.js';
import { evaluateFast } from '../src/fast-features.js';
import { findBestMove } from '../src/search.js';
import { randomOpening, seededRandom } from '../src/learning.js';
import { PROTOCOL } from './evaluator-protocol.mjs';

const evaluator=process.argv[2]==='A'?evaluate:evaluateFast;
const positions=[8,28,52].flatMap(plies=>[0,1,2,3].map(offset=>randomOpening(seededRandom(PROTOCOL.costSeed+offset),plies)));
let nodes=0,evaluations=0;
for(let round=0;round<10;round++) for(const p of positions) {
  const result=findBestMove(p.board,p.player,5,undefined,{evaluate:evaluator});
  nodes+=result.nodes; evaluations+=result.evaluations;
}
console.log(JSON.stringify({evaluator:process.argv[2],nodes,evaluations}));
