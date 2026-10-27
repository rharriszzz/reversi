// Development -> selection -> frozen holdouts. Write raw JSON outside Git.
import { readFileSync, writeFileSync } from 'node:fs';
import { evaluate } from '../src/features.js';
import { evaluateFast, countLegalMovesFast } from '../src/fast-features.js';
import { makeFastStableEvaluator } from '../src/evaluation.js';
import { legalMoves, play, boardToRows, isTerminal } from '../src/rules.js';
import { randomOpening, seededRandom } from '../src/learning.js';
import { findBestMove, scoreAllMoves, terminalScore } from '../src/search.js';
import { oracleChildren, oracleScore } from '../tests/oracle.mjs';
import { openingSet, canonicalOpening } from './evaluate.mjs';
import { pairedMatch, pairedSummary } from './experiment-lib.mjs';
import { PROTOCOL } from './evaluator-protocol.mjs';

const phaseNames={8:'opening',28:'middle',54:'late'};
function unseenPositions(seed, plies, count, used) {
  const rng=seededRandom(seed), result=[];
  while(result.length<count) {
    const positionSeed=Math.floor(rng()*0x7fffffff);
    const position=randomOpening(seededRandom(positionSeed),plies);
    if(position.player===null || (plies===54 && position.board.filter(v=>v===0).length!==6)) continue;
    const key=canonicalOpening(position);
    if(used.has(key)) continue;
    used.add(key); result.push({...position,seed:positionSeed,phase:phaseNames[plies],key});
  }
  return result;
}

function datasets() {
  const used=new Set();
  // Exclude all previously disclosed 8-placement tournament openings, even
  // though the newly reserved seeds differ. Exclude symmetry-equivalent boards.
  openingSet(20261026,8,used); openingSet(734917,8,used);
  openingSet(14659013,16,used); openingSet(14659117,16,used);
  openingSet(14659991,32,used); openingSet(14661007,6,used);
  const previousRng=seededRandom(14664007);
  for(let count=0;count<32;) {
    const p=randomOpening(seededRandom(Math.floor(previousRng()*0x7fffffff)),54);
    if(p.player===null || p.board.filter(v=>v===0).length!==6) continue;
    const key=canonicalOpening(p); if(used.has(key)) continue;
    used.add(key); count++;
  }
  for(const seed of [730000,730003]) used.add(canonicalOpening(randomOpening(seededRandom(seed),54)));
  const development=unseenPositions(PROTOCOL.developmentSeed,54,PROTOCOL.developmentPositions,used);
  const selection=openingSet(PROTOCOL.selectionSeed,PROTOCOL.selectionPairs,used);
  const quality=[...unseenPositions(PROTOCOL.qualitySeed,8,12,used),
    ...unseenPositions(PROTOCOL.qualitySeed+1,28,12,used),
    ...unseenPositions(PROTOCOL.qualitySeed+2,54,64,used)];
  const games=openingSet(PROTOCOL.gamesSeed,PROTOCOL.finalPairs,used);
  return {development,selection,quality,games};
}

const margin=score=>score>9000?score-10000:score< -9000?score+10000:score;
function exactRows(position) {
  return oracleChildren([...position.board],position.player).map(child=>
    ({move:child.move,score:-oracleScore(child.board,-position.player)}));
}
function ranks(values) {
  return values.map(value=>1+values.filter(v=>v>value).length+(values.filter(v=>v===value).length-1)/2);
}
function correlation(a,b) {
  const x=ranks(a), y=ranks(b), mean=(x.length+1)/2;
  let cov=0,xx=0,yy=0;
  for(let i=0;i<x.length;i++) {const dx=x[i]-mean,dy=y[i]-mean;cov+=dx*dy;xx+=dx*dx;yy+=dy*dy;}
  return xx && yy ? cov/Math.sqrt(xx*yy) : null;
}
function summarizeQuality(rows) {
  const result=[];
  for(const phase of ['opening','middle','late']) for(const depth of [1,3]) for(const name of ['A','B','C']) {
    const group=rows.filter(r=>r.phase===phase).map(r=>r.choices.find(c=>c.name===name&&c.depth===depth));
    const correlations=group.map(r=>r.spearman).filter(r=>r!==null);
    result.push({phase,name,depth,positions:group.length,optimal:group.filter(r=>r.regret===0).length,
      meanRegret:group.reduce((s,r)=>s+r.regret,0)/group.length,
      meanSpearman:correlations.length?correlations.reduce((s,r)=>s+r,0)/correlations.length:null,
      regretUnits:phase==='late'?'exact final discs':'depth-5 baseline heuristic estimate points'});
  }
  return result;
}
const engines=weight=>({A:{name:'A',evaluate},B:{name:'B',evaluate:evaluateFast},
  C:{name:'C',evaluate:makeFastStableEvaluator(weight)}});
const serialized=positions=>positions.map(p=>({...p,board:undefined,rows:boardToRows(p.board)}));

const mode=process.argv[2], selectionFile=process.argv[3], output=process.argv[4];
const data=datasets();
const start=performance.now();
let report={protocol:PROTOCOL,mode};

if(mode==='select') {
  const exact=data.development.map(p=>({position:p,rows:exactRows(p)}));
  const grid=PROTOCOL.stableWeights.map(weight=>{
    const evaluator=makeFastStableEvaluator(weight);
    const regrets=exact.map(({position,rows})=>{
      const choice=findBestMove(position.board,position.player,1,undefined,{evaluate:evaluator});
      return margin(Math.max(...rows.map(r=>r.score)))-margin(rows.find(r=>r.move===choice.move).score);
    });
    return {weight,meanDiscRegret:regrets.reduce((a,b)=>a+b,0)/regrets.length};
  }).sort((a,b)=>a.meanDiscRegret-b.meanDiscRegret||a.weight-b.weight);
  const shortlist=grid.slice(0,2).map(row=>({weight:row.weight,
    games:pairedMatch(engines(row.weight).C,engines(row.weight).B,data.selection,{depth:3})}));
  shortlist.sort((a,b)=>b.games.scoreRate-a.games.scoreRate||a.weight-b.weight);
  report={...report,grid,shortlist,selectedWeight:shortlist[0].weight,
    development:serialized(data.development),selectionKeys:data.selection.map(canonicalOpening),
    reservedFinalQualityKeys:data.quality.map(p=>p.key),reservedFinalGameKeys:data.games.map(canonicalOpening)};
} else if(['quality','cost','fixed','timed'].includes(mode)) {
  const selection=JSON.parse(readFileSync(selectionFile));
  if(JSON.stringify(selection.protocol)!==JSON.stringify(PROTOCOL)) throw new Error('Protocol mismatch');
  const models=engines(selection.selectedWeight);
  report.selectedWeight=selection.selectedWeight;
  if(mode==='quality') {
    const rows=[];
    for(const position of data.quality) {
      const reference=position.phase==='late'?exactRows(position):scoreAllMoves(position.board,position.player,5).results;
      const best=Math.max(...reference.map(r=>r.score)), choices=[];
      for(const depth of [1,3]) for(const [name,engine] of Object.entries(models)) {
        const predicted=reference.map(({move})=>{
          const child=play(position.board,position.player,move);
          if(depth===1) return isTerminal(child)?terminalScore(child,position.player):engine.evaluate(child,position.player);
          return -findBestMove(child,-position.player,depth-1,undefined,{evaluate:engine.evaluate}).score;
        });
        // Use the playing path's actual tie rule to measure selection regret.
        const choice=findBestMove(position.board,position.player,depth,undefined,{evaluate:engine.evaluate});
        const actual=reference.find(r=>r.move===choice.move).score;
        choices.push({name,depth,move:choice.move,regret:position.phase==='late'?margin(best)-margin(actual):best-actual,
          spearman:correlation(predicted,reference.map(r=>r.score)),predicted});
      }
      rows.push({...position,reference,choices});
    }
    report={...report,positions:serialized(rows),summary:summarizeQuality(rows)};
  } else if(mode==='fixed') {
    report.results=[pairedMatch(models.C,models.B,data.games,{depth:3})];
  } else if(mode==='cost') {
    const positions=[8,28,52].flatMap(plies=>[0,1,2,3].map(offset=>
      ({plies,...randomOpening(seededRandom(PROTOCOL.costSeed+offset),plies)})));
    const costs=[],search=[]; let checksum=0;
    for(const plies of [8,28,52]) {
      const group=positions.filter(p=>p.plies===plies);
      const tasks=Object.entries(models).map(([name,e])=>({name,fn:(p)=>e.evaluate(p.board,p.player),samples:[]}));
      tasks.push({name:'mobility-original',fn:p=>legalMoves(p.board,p.player).length,samples:[]},
        {name:'mobility-fast',fn:p=>countLegalMovesFast(p.board,p.player),samples:[]},
        {name:'B-reuse',fn:p=>evaluateFast(p.board,p.player,undefined,p.ownMoves),samples:[]});
      group.forEach(p=>{p.ownMoves=legalMoves(p.board,p.player).length;});
      for(const t of tasks) for(let i=0;i<8000;i++) checksum+=t.fn(group[i%4]);
      for(let sample=0;sample<7;sample++) for(let offset=0;offset<tasks.length;offset++) {
        const t=tasks[(sample+offset)%tasks.length], t0=performance.now();
        for(let i=0;i<8000;i++) checksum+=t.fn(group[i%4]);
        t.samples.push((performance.now()-t0)*1000/8000);
      }
      for(const t of tasks) costs.push({plies,name:t.name,microseconds:t.samples.sort((a,b)=>a-b)[3],samples:t.samples});
    }
    for(const p of positions) for(const depth of [4,5]) for(const [name,engine] of Object.entries(models)) {
      const samples=Array.from({length:5},()=>findBestMove(p.board,p.player,depth,undefined,{evaluate:engine.evaluate}));
      const times=samples.map(s=>s.elapsedMs).sort((a,b)=>a-b);
      search.push({plies:p.plies,rows:boardToRows(p.board),depth,name,nodes:samples[0].nodes,
        evaluations:samples[0].evaluations,elapsedMs:times[2],score:samples[0].score,move:samples[0].move});
    }
    report={...report,costs,search,checksum};
  } else {
    // Interleave one complete opening pair from each comparison and budget.
    // Stop BEFORE starting a new pair after the global cap; checkpoint every pair.
    const jobs=PROTOCOL.timedBudgetsMs.flatMap(timeMs=>[['B','A'],['C','B'],['C','A']].map(([c,b])=>
      ({candidate:c,opponent:b,timeMs,pairPoints:[],games:[]})));
    const deadline=start+PROTOCOL.timedTotalSeconds*1000;
    outer:for(let pair=0;pair<PROTOCOL.finalPairs;pair++) {
      for(let offset=0;offset<jobs.length;offset++) {
        if(performance.now()>=deadline) break outer;
        const job=jobs[(offset+pair)%jobs.length];
        const match=pairedMatch(models[job.candidate],models[job.opponent],[data.games[pair]],{timeMs:job.timeMs},pair,pair);
        job.pairPoints.push(match.pairPoints[0]);
        job.games.push(...match.games.map(game=>({...game,opening:pair})));
        if(output) writeFileSync(output,JSON.stringify({...report,elapsedMs:performance.now()-start,jobs,complete:false}));
      }
    }
    report={...report,openingKeys:data.games.map(canonicalOpening),jobs:jobs.map(j=>({...j,
      ...pairedSummary(j.pairPoints),gameCount:j.games.length,games:j.games,complete:j.pairPoints.length===PROTOCOL.finalPairs})),
      complete:jobs.every(j=>j.pairPoints.length===PROTOCOL.finalPairs)};
  }
} else throw new Error('Usage: node scripts/compare-evaluators.mjs select|quality|cost|fixed|timed selection.json [output.json]');
report.elapsedMs=performance.now()-start;
if(output) writeFileSync(output,JSON.stringify(report)); else console.log(JSON.stringify(report));
