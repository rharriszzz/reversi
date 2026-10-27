// Measurement only: static costs, old coaching-as-play overhead, playing
// throughput, and attained completed depth under measured wall-clock budgets.
import { cpus, platform, release } from 'node:os';
import { DEFAULT_WEIGHTS, extractFeatures } from '../src/features.js';
import { EVALUATORS } from '../src/evaluation.js';
import { scoreAllMoves, findBestMove } from '../src/search.js';
import { randomOpening, seededRandom } from '../src/learning.js';
import { boardToRows } from '../src/rules.js';

const median = values => [...values].sort((a,b) => a-b)[Math.floor(values.length/2)];
const positions = [113, 271, 811].flatMap(seed => [8,28,52].map(plies =>
  ({ seed, plies, ...randomOpening(seededRandom(seed), plies) })));
let checksum = 0;
const staticCost = [];
for (const plies of [8,28,52]) {
  const group = positions.filter(position => position.plies === plies);
  const tasks = [['featuresOnly', (b,p) => extractFeatures(b,p).mobility], ...Object.entries(EVALUATORS)]
    .map(([name,evaluator])=>({name,evaluator,samples:[]}));
  // Warm shared extraction/evaluation code before measuring any candidate;
  // rotate timing order between samples to reduce JIT/order/frequency bias.
  for (const {evaluator} of tasks) for (let i=0; i<6000; i++) checksum += evaluator(group[i%3].board, 1);
  for (let sample=0; sample<5; sample++) {
    for (let offset=0; offset<tasks.length; offset++) {
      const task=tasks[(sample+offset)%tasks.length];
      const start = performance.now(), calls = 6000;
      for (let i=0; i<calls; i++) checksum += task.evaluator(group[i%3].board, i%2 ? 1 : -1);
      task.samples.push((performance.now()-start)*1000/calls);
    }
  }
  for (const task of tasks) staticCost.push({ plies,evaluator:task.name,
    microsecondsPerEvaluation:median(task.samples),callsPerSample:6000,samples:5 });
}
const fixedDepth = [], timed = [];
for (const position of positions) {
  scoreAllMoves(position.board,position.player,3);
  for (const depth of [3,4,5]) {
    for (const [name,evaluator] of Object.entries(EVALUATORS)) {
      for (const mode of name === 'baseline' ? ['coach','play'] : ['play']) {
        const samples = Array.from({length:5}, () => {
          const start=performance.now();
          const result = mode === 'coach' ? scoreAllMoves(position.board,position.player,depth)
            : findBestMove(position.board,position.player,depth,DEFAULT_WEIGHTS,{evaluate:evaluator});
          return {...result, externalMs:performance.now()-start};
        });
        const elapsedMs=median(samples.map(s=>s.externalMs)), result=samples[0];
        fixedDepth.push({ seed:position.seed, plies:position.plies, depth, evaluator:name, mode,
          nodes:result.nodes, evaluations:result.evaluations, immediateEvaluations:result.immediateEvaluations??0,
          elapsedMs, nodesPerSecond:result.nodes*1000/elapsedMs,
          searchEvaluationsPerSecond:result.evaluations*1000/elapsedMs });
      }
    }
  }
  for (const [name,evaluator] of Object.entries(EVALUATORS)) for (const timeMs of [5,20,80]) {
    const samples=Array.from({length:3},()=>findBestMove(position.board,position.player,14,DEFAULT_WEIGHTS,
      {evaluate:evaluator,timeMs}));
    timed.push({ seed:position.seed, plies:position.plies, evaluator:name, budgetMs:timeMs,
      completedDepths:samples.map(s=>s.depth), medianElapsedMs:median(samples.map(s=>s.elapsedMs)),
      maxOverrunMs:Math.max(...samples.map(s=>Math.max(0,s.elapsedMs-timeMs))),
      nodes:samples.map(s=>s.nodes), evaluations:samples.map(s=>s.evaluations) });
  }
}
console.log(JSON.stringify({format:'reversi-cost-tradeoff-v1',node:process.version,os:`${platform()} ${release()}`,
  cpu:cpus()[0].model,positions:positions.map(({seed,plies,board,player})=>({seed,plies,player,rows:boardToRows(board)})),
  staticCost,fixedDepth,timed,checksum},null,2));
