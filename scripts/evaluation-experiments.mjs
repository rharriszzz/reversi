// Separate deterministic depth/learning experiments from wall-clock tournaments.
// Freeze constants/seeds here before inspecting holdouts. Outputs stay outside Git.
import { DEFAULT_WEIGHTS } from '../src/features.js';
import { EVALUATORS } from '../src/evaluation.js';
import { seededRandom, proposeWeights, randomOpening } from '../src/learning.js';
import { trainLinearTD } from '../src/td.js';
import { findBestMove } from '../src/search.js';
import { canonicalOpening, openingSet } from './evaluate.mjs';
import { pairedMatch } from './experiment-lib.mjs';
import { oracleChildren, oracleScore } from '../tests/oracle.mjs';
import { boardToRows } from '../src/rules.js';

const mode = process.argv[2] ?? 'fixed';
const pairs = Number(process.argv[3] ?? (mode === 'timed' ? 6 : 32));
if (!['fixed','timed','learning','solved'].includes(mode) || !Number.isInteger(pairs) || pairs<2 || pairs>64) {
  throw new Error('Usage: node scripts/evaluation-experiments.mjs fixed|timed|learning|solved [pairs/positions 2..64]');
}
const seeds = { training:14659013, development:14659117, holdout:14659991, timedHoldout:14661007,
  solvedHoldout:14664007, mutation:[546031,546037,546041] };
const used = new Set();
// Exclude the previous milestone's disclosed pilot positions as well.
openingSet(20261026,8,used); openingSet(734917,8,used);
const training=openingSet(seeds.training,16,used), development=openingSet(seeds.development,16,used);
const holdout=openingSet(seeds.holdout,pairs,used);
const engines=Object.fromEntries(Object.entries(EVALUATORS).map(([name,evaluate])=>[name,{name,evaluate}]));
const start=performance.now();
const report={format:'reversi-positional-experiment-v1',mode,seeds,pairs,search:'fast alpha-beta v1',
  candidateParameters:{stableEdges:{weight:60,normalizer:24},smooth:{occupiedAnchors:[4,40,64]}},
  protocol:'Each comparison is exploratory. Do not select on disclosed holdouts. Paired colors; opening-pair uncertainty; no model installed.'};

if(mode==='fixed') {
  report.openings=holdout.map(canonicalOpening);
  report.results=[];
  for(const name of ['stableEdges','smooth']) {
    report.results.push(pairedMatch(engines[name],engines.baseline,holdout,{depth:3}));
  }
  for(const reference of ['random','greedy']) {
    report.results.push(pairedMatch(engines.baseline,{name:reference,reference},holdout,{depth:3},9173));
  }
} else if(mode==='timed') {
  const timedHoldout=openingSet(seeds.timedHoldout,pairs,used);
  report.openings=timedHoldout.map(canonicalOpening); report.results=[];
  // Run serially: simultaneous matches contaminate equal elapsed budgets.
  // Alternate candidate/color order between pairs; the machine must be idle.
  for(const timeMs of [5,20,80]) for(const name of ['stableEdges','smooth']) {
    report.results.push(pairedMatch(engines[name],engines.baseline,timedHoldout,{timeMs}));
  }
} else if(mode==='learning') {
  report.training=training.map(canonicalOpening); report.development=development.map(canonicalOpening);
  const candidates=[];
  for(const seed of seeds.mutation) candidates.push({name:`mutation-${seed}`,weights:proposeWeights(DEFAULT_WEIGHTS,seededRandom(seed))});
  for(const rate of [0.01,0.03,0.1]) {
    const model=trainLinearTD(DEFAULT_WEIGHTS,training,{depth:1,rate,epochs:2});
    candidates.push({name:`td-${rate}`,weights:model.weights,metadata:model});
  }
  report.developmentResults=candidates.map(candidate=>({name:candidate.name,
    result:pairedMatch(candidate,engines.baseline,development,{depth:2})}));
  const selected=report.developmentResults.reduce((best,item)=>item.result.scoreRate>best.result.scoreRate?item:best);
  const frozen=candidates.find(candidate=>candidate.name===selected.name);
  report.selected={...frozen,format:'reversi-selected-linear-weights-v1'};
  // Only the preselected candidate sees this fresh holdout.
  report.openings=holdout.map(canonicalOpening);
  report.results=[pairedMatch(frozen,engines.baseline,holdout,{depth:3})];
} else {
  const rng=seededRandom(seeds.solvedHoldout), positions=[];
  const margin=value=>value>9000?value-10000:value< -9000?value+10000:value;
  while(positions.length<pairs) {
    const seed=Math.floor(rng()*0x7fffffff), opening=randomOpening(seededRandom(seed),54);
    if(opening.player===null || opening.board.filter(v=>v===0).length!==6) continue;
    const key=canonicalOpening(opening); if(used.has(key)) continue; used.add(key);
    const exact=oracleChildren([...opening.board],opening.player).map(child=>({move:child.move,
      score:-oracleScore(child.board,-opening.player)}));
    const best=Math.max(...exact.map(row=>row.score));
    const choices=[];
    for(const depth of [1,3]) for(const [name,evaluate] of Object.entries(EVALUATORS)) {
      const result=findBestMove(opening.board,opening.player,depth,DEFAULT_WEIGHTS,{evaluate});
      const actual=exact.find(row=>row.move===result.move).score;
      choices.push({evaluator:name,depth,move:result.move,optimal:actual===best,
        discRegret:margin(best)-margin(actual),bestOutcome:Math.sign(best),chosenOutcome:Math.sign(actual)});
    }
    positions.push({seed,player:opening.player,rows:boardToRows(opening.board),exact,choices});
  }
  report.positions=positions;
  report.summary=[];
  for(const depth of [1,3]) for(const name of Object.keys(EVALUATORS)) {
    const rows=positions.map(p=>p.choices.find(row=>row.evaluator===name&&row.depth===depth));
    report.summary.push({evaluator:name,depth,positions:rows.length,optimal:rows.filter(r=>r.optimal).length,
      meanDiscRegret:rows.reduce((sum,r)=>sum+r.discRegret,0)/rows.length,
      lostAvailableWin:rows.filter(r=>r.bestOutcome>0&&r.chosenOutcome<0).length});
  }
}
report.elapsedMs=performance.now()-start;
console.log(JSON.stringify(report,null,2));
