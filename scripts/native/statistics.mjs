import assert from 'node:assert/strict';
import { pairSummary } from '../frozen-player/statistics.mjs';
import { bootstrap,moments,quantile,mean } from '../p-confirmation/statistics.mjs';
import { PROTOCOL } from './protocol.mjs';
export function telemetry(games) {
 const rows=games.flatMap(g=>g.moves.filter(m=>m.move!==null).map(m=>({...m,timeMs:g.timeMs,phase:m.occupied<28?'opening':m.occupied<52?'middle':'endgame'}))),result=[];
 for(const timeMs of [80,300])for(const backend of ['native','javascript'])for(const phase of ['all','opening','middle','endgame']) {
  const xs=rows.filter(r=>r.timeMs===timeMs&&r.backend===backend&&(phase==='all'||r.phase===phase));if(!xs.length)continue;
  const sum=k=>xs.reduce((n,x)=>n+(x[k]??0),0),times=xs.map(x=>x.measuredMs),nodes=sum('nodes'),evaluations=sum('evaluations'),wallMs=sum('elapsedMs'),interfaceMs=sum('measuredMs');
  result.push({timeMs,backend,phase,moves:xs.length,meanDepth:mean(xs.map(x=>x.depth)),medianDepth:quantile(xs.map(x=>x.depth),.5),depthHistogram:Object.fromEntries([...new Set(xs.map(x=>x.depth))].sort((a,b)=>a-b).map(d=>[d,xs.filter(x=>x.depth===d).length])),nodes,evaluations,nodesPerSecond:nodes*1000/wallMs,endToEndNodesPerSecond:nodes*1000/interfaceMs,evaluationsPerNode:evaluations/nodes,meanNodes:nodes/xs.length,meanEvaluations:evaluations/xs.length,meanElapsedMs:wallMs/xs.length,meanMoveMs:mean(times),medianMoveMs:quantile(times,.5),maxOverrunMs:Math.max(...xs.map(x=>x.overrunMs)),overrun1:xs.filter(x=>x.overrunMs>1).length,overrun5:xs.filter(x=>x.overrunMs>5).length,fallbacks:xs.filter(x=>x.depth===0).length,interrupted:xs.filter(x=>x.timedOut).length,ttProbes:sum('ttProbes'),ttHits:sum('ttHits'),ttBoundHits:sum('ttBoundHits'),ttCutoffs:sum('ttCutoffs'),cutoffs:sum('cutoffs')});
 }
 return result;
}
export function analyze(games) {
 assert.equal(games.length,PROTOCOL.games,'Complete fixed schedule required');const pairs=[],conditions={};
 for(const timeMs of [80,300]) {
  const xs=games.filter(g=>g.timeMs===timeMs),count=timeMs===80?256:128;assert.equal(xs.length,count*2);
  for(let family=0;family<count;family++) {const gs=xs.filter(g=>g.family===family);assert.equal(gs.length,2);assert.deepEqual(gs.map(g=>g.nativeColor).sort(),[-1,1]);pairs.push({family,timeMs,score:mean(gs.map(g=>g.points)),margin:mean(gs.map(g=>g.margin))});}
  const rows=pairs.filter(p=>p.timeMs===timeMs),summary=pairSummary(rows.map(p=>p.score));
  conditions[timeMs]={...summary,bootstrap:bootstrap(rows,['score','margin'],{reps:PROTOCOL.statistics.bootstrapReps,seed:PROTOCOL.statistics.seed+timeMs}),wins:xs.filter(g=>g.outcome>0).length,draws:xs.filter(g=>g.outcome===0).length,losses:xs.filter(g=>g.outcome<0).length,meanMargin:mean(xs.map(g=>g.margin)),bonferroniP:summary.approximateOneSidedP===null?null:Math.min(1,2*summary.approximateOneSidedP)};
 }
 const matched=pairs.filter(p=>p.timeMs===300).map(p=>{const short=pairs.find(x=>x.family===p.family&&x.timeMs===80);return {family:p.family,short:short.score,long:p.score,difference:p.score-short.score};});
 return {conditions,pairs,matched:{...moments(matched.map(r=>r.difference)),bootstrap:bootstrap(matched,['short','long','difference'],{reps:PROTOCOL.statistics.bootstrapReps,seed:PROTOCOL.statistics.seed})},telemetry:telemetry(games)};
}
