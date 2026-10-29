#!/usr/bin/env node
// Cost-only prototype: synthetic pattern tables have no learned quality claim.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { read, atomic } from '../research/io.mjs';
import { hash } from './protocol.mjs';
import { evaluateFast, fillFeaturesFast } from '../../src/fast-features.js';
import { DEFAULT_WEIGHTS } from '../../src/features.js';
import { legalMoves } from '../../src/rules.js';
import { findBestMove } from '../../src/search.js';
import { specification, geometry, compile, unpack } from '../strong/model.mjs';
import { MAPS } from '../research/core.mjs';
const [directory,output]=process.argv.slice(2),run=resolve(directory);
const reservation=read(`${run}/reservations.json`),states=reservation.roles.training.slice(0,16);
const spec=specification('long',3);spec.templates=spec.templates.filter(t=>['corner6','edge8'].includes(t.name));
const records=geometry(spec),features=['mobility','potential','corners','xSquares','cSquares','frontier','discs'];
function prototype(mode) {
  const scratch=new Float64Array(7),tables=spec.templates.map(t=>new Float32Array(t.size*3));
  if(mode==='nonzero')for(const [j,t] of spec.templates.entries())for(let p=0;p<3;p++)for(let code=0;code<(t.size-1)/2;code++) {
    const v=((code%17)-8)*.1*(p+1)/8;tables[j][p*t.size+code]=v;tables[j][p*t.size+t.size-1-code]=-v;
  }
  const gs=mode==='fused'?[]:records.map((g,i)=>({...g,table:tables[Math.floor(i/8)]}));
  return (board,player,_weights,knownMoves)=>{
    const occupied=fillFeaturesFast(board,player,scratch,knownMoves),phase=occupied<28?0:occupied<52?1:2;
    const weights=DEFAULT_WEIGHTS[['opening','middle','endgame'][phase]];let score=0,pattern=0;
    for(let j=0;j<7;j++)score+=weights[features[j]]*scratch[j];
    for(const g of gs){let code=0,power=1;for(const q of g.squares){code+=(board[q]+1)*power;power*=3;}pattern+=g.table[phase*g.size+code];}
    return score+player*pattern;
  };
}
const evaluators={B:evaluateFast,fusedB:prototype('fused'),compactZero:prototype('zero'),compactSynthetic:prototype('nonzero'),
  historicalLong:compile(unpack(read('.local-research/next-frozen-screen-20261028/long-rank-p4.json'))).evaluate};
for(const state of states) {
  for(const known of [undefined,legalMoves(state.board,state.player).length])
    assert.equal(evaluators.compactZero(state.board,state.player,undefined,known),evaluateFast(state.board,state.player,undefined,known));
  const value=evaluators.compactSynthetic(state.board,state.player);
  assert.ok(Math.abs(value+evaluators.compactSynthetic(state.board,-state.player))<1e-10);
  for(const map of MAPS)assert.ok(Math.abs(value-evaluators.compactSynthetic(map.map(i=>state.board[i]),state.player))<1e-10);
}
const report={kind:'cost-only-compact-residual-prototype-v1',at:new Date().toISOString(),runIdentity:reservation.runIdentity,
  sourceIds:states.map(s=>s.id),templates:spec.templates.map(t=>({name:t.name,squares:t.squares,size:t.size})),
  tableBytes:spec.templates.reduce((n,t)=>n+t.size*3*4,0),instances:records.length,
  caution:'Synthetic weights and old training roots: timing/identity checks only, no training, new assessment, or playing-strength evidence.',static:[],search:[]};
const start=performance.now();let checksum=0;
for(let rep=0;rep<5;rep++)for(const known of [false,true])for(const name of Object.keys(evaluators).sort((a,b)=>((Object.keys(evaluators).indexOf(a)+rep)%5)-((Object.keys(evaluators).indexOf(b)+rep)%5))) {
  const moves=states.map(s=>legalMoves(s.board,s.player).length),evaluate=evaluators[name];
  for(let i=0;i<1000;i++){const k=i%16,s=states[k];checksum+=evaluate(s.board,s.player,undefined,known?moves[k]:undefined);}
  const begin=performance.now(),iterations=20000;
  for(let i=0;i<iterations;i++){const k=i%16,s=states[k];checksum+=evaluate(s.board,s.player,undefined,known?moves[k]:undefined);}
  report.static.push({name,knownMoves:known,repetition:rep,usPerEvaluation:(performance.now()-begin)*1000/iterations});
}
for(let rep=0;rep<3;rep++) {
  const reference=new Map();
  for(const name of Object.keys(evaluators)) {
    let nodes=0,evaluations=0;const begin=performance.now();
    for(const state of states){const result=findBestMove(state.board,state.player,6,undefined,{evaluate:evaluators[name]});
      if(name==='B')reference.set(state.id,result);
      if(['fusedB','compactZero'].includes(name))for(const key of ['move','score','nodes','evaluations'])assert.equal(result[key],reference.get(state.id)[key]);
      nodes+=result.nodes;evaluations+=result.evaluations;
    }
    const ms=performance.now()-begin;report.search.push({name,repetition:rep,depth:6,positions:states.length,wallMs:ms,nodes,evaluations,nodesPerSecond:nodes/ms*1000,evaluationsPerSecond:evaluations/ms*1000});
  }
}
// Prospective full-screen envelope from historical COSTS, not assessment scores.
const telemetry=new Map(readFileSync(`${run}/tasks-telemetry.jsonl`,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).map(r=>[r.id,r.wallMs]));
const cells=new Map(),cell=r=>`${r.phase}/${r.policy}/${r.depth}`;
for(const source of [...reservation.roles.training,...reservation.roles.development]) {
  const c=cells.get(cell(source))??{generation:0,frontier:0,labels:0,rootLabels:0,root4:0,root6:0};cells.set(cell(source),c);
  const f=read(`${run}/frontiers/${source.id}.json`).result;
  c.generation=Math.max(c.generation,read(`${run}/trajectories/${source.id}.json`).wallMs);c.frontier=Math.max(c.frontier,f.wallMs);
  c.labels=Math.max(c.labels,f.parents.reduce((n,_,i)=>n+[10,12].reduce((s,d)=>s+telemetry.get(`label-${source.id}-p${i}-d${d}`),0),0));
}
for(const id of reservation.transferIds) {
  const source=reservation.roles.assessment.find(r=>r.id===id),c=cells.get(cell(source));
  c.rootLabels=Math.max(c.rootLabels,...[0].map(()=>[10,12].reduce((n,d)=>n+telemetry.get(`transfer-${id}-d${d}`),0)));
  for(const d of [4,6])for(const which of ['B','candidate'])c[`root${d}`]=Math.max(c[`root${d}`],telemetry.get(`search-${id}-${d}-${which}`));
}
const pilot=read(`${run}/pilot-results.json`),attempts=read(`${run}/reservation-progress.json`).attempt;
const rejection=attempts/Object.values(reservation.roles).reduce((n,rows)=>n+rows.length,0),sum=key=>[...cells.values()].reduce((n,c)=>n+c[key],0);
const pair80=Math.max(...pilot.gameCosts.filter(r=>r.timeMs===80).map(r=>r.wallMs)),pair300=Math.max(...pilot.gameCosts.filter(r=>r.timeMs===300).map(r=>r.wallMs));
const budgetPair80=Math.max(pair80,104*80),budgetPair300=Math.max(pair300,104*300);
const stages={generation:6*sum('generation')*rejection+32*Math.max(...[...cells].filter(([key])=>key.startsWith('0/')).map(([,c])=>c.generation))*rejection,
  collectors:6*sum('frontier')*3,frontierLabels:6*sum('labels')*2,
  rootLabels:4*sum('rootLabels'),rootSearches:4*(sum('root4')+sum('root6'))*3*2,
  games:32*(2*budgetPair80+budgetPair300),encodingFitting:600000,engineering:180000,statisticsAudit:180000};
const parallel=['generation','collectors','frontierLabels','rootLabels','rootSearches'];
report.forecast={sources:96,transferRoots:64,openingPairs:32,conditions:['L-B/80','L-B/300','P-L/80'],
  cellMaxima:Object.fromEntries(cells),admissionAttemptFactor:rejection,pair80MaxMs:pair80,pair300MaxMs:pair300,
  budgetPair80Ms:budgetPair80,budgetPair300Ms:budgetPair300,stages,
  method:'Per-cell maxima from completed training/development task costs, old root TASK TIMINGS only; B plus twice-B collector allowance for L; twice observed root-search cost for all three evaluators; union parents twice original label work. Games use max(pilot pair cost, 104 remaining placements times per-move budget). 35% allowance plus separate 15-minute reporting reserve.',
  caveat:'A prospective engineering envelope, not a guaranteed upper bound: new encoding/fitting caps and changed search trees must be measured before locked assessment.',conditional:[]};
for(const workers of [1,2]) {
  const speedup=Math.min(workers,...Object.values(pilot.scaling).map(r=>r.safeSpeedup));
  const rawMs=Object.entries(stages).reduce((n,[key,ms])=>n+ms/(parallel.includes(key)?speedup:1),0);
  report.forecast.conditional.push({actualPool:workers,speedup,rawMs,totalMs:rawMs*1.35+900000});
}
report.wallMs=performance.now()-start;report.checksumValue=checksum;report.verified={zeroStatic:true,zeroSearchScoresMovesNodes:true,colorAntisymmetry:true,D4:true};
report.checksum=hash(report);atomic(resolve(output),report);console.log(JSON.stringify({seconds:report.wallMs/1000,tableBytes:report.tableBytes,verified:report.verified}));
