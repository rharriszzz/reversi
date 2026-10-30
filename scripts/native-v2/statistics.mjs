import assert from 'node:assert/strict';
import {pairSummary} from '../frozen-player/statistics.mjs';
import {bootstrap,moments,mean,quantile} from '../p-confirmation/statistics.mjs';
import {studentTail} from '../native/statistics.mjs';
import {PROTOCOL} from './protocol.mjs';
export function analyze(games){
 assert.equal(games.length,2048);const pairs=[],conditions={};
 for(const timeMs of [80,300]){
  const gs=games.filter(g=>g.timeMs===timeMs),families=[...new Set(gs.map(g=>g.family))].sort((a,b)=>a-b);assert.equal(families.length,timeMs===80?768:256);
  for(const family of families){const xs=gs.filter(g=>g.family===family);assert.equal(xs.length,2);assert.deepEqual(xs.map(g=>g.color).sort(),[-1,1]);pairs.push({family,timeMs,score:mean(xs.map(g=>g.points)),margin:mean(xs.map(g=>g.margin))});}
  const rows=pairs.filter(p=>p.timeMs===timeMs),summary=pairSummary(rows.map(r=>r.score)),p=summary.standardError?studentTail((summary.mean-.5)/summary.standardError,rows.length-1):null;
  conditions[timeMs]={...summary,variance:summary.sd**2,effect:summary.mean-.5,approximateOneSidedP:p,bonferroniP:p===null?null:Math.min(1,2*p),pValueMethod:'positive Student survival quadrature',
   margin:moments(rows.map(r=>r.margin)),wins:gs.filter(g=>g.outcome>0).length,draws:gs.filter(g=>g.outcome===0).length,losses:gs.filter(g=>g.outcome<0).length,
   bootstrap:bootstrap(rows,['score','margin'],{reps:10000,seed:PROTOCOL.bootstrapSeed+timeMs}),
   bootstrapSensitivity:[1,2].map(k=>bootstrap(rows,['score'],{reps:10000,seed:PROTOCOL.bootstrapSeed+timeMs+k}))};
 }
 const matched=pairs.filter(p=>p.timeMs===300).map(p=>{const short=pairs.find(s=>s.timeMs===80&&s.family===p.family);return {family:p.family,short:short.score,long:p.score,difference:p.score-short.score};});
 const difference={...moments(matched.map(r=>r.difference)),bootstrap:bootstrap(matched,['short','long','difference'],{reps:10000,seed:PROTOCOL.bootstrapSeed}),rows:matched};
 const conventional=[80,300].every(b=>conditions[b].approximateOneSided975Lower>.5),bounded=[80,300].every(b=>conditions[b].conservativeOneSided975Lower>.5);
 return {conditions,pairs,difference,conventional,bounded,primary:80,durability:300,alphaEach:.025,familywiseAlpha:.05};
}
export function telemetry(games){const result=[];
 for(const timeMs of [80,300])for(const model of ['B','P'])for(const phase of ['all','opening','middle','endgame']){
  const rows=games.filter(g=>g.timeMs===timeMs).flatMap(g=>g.moves.filter(m=>m.move!==null&&m.model===model&&(phase==='all'||phase===(m.occupied<28?'opening':m.occupied<52?'middle':'endgame'))));
  const sum=k=>rows.reduce((s,r)=>s+(r[k]??0),0),meanOf=k=>mean(rows.map(r=>r[k]));
  const nodes=sum('nodes'),ms=sum('elapsedMs'),measured=sum('measuredMs');
  result.push({timeMs,model,phase,moves:rows.length,nodes,evaluations:sum('evaluations'),searchMs:ms,cpuMs:sum('cpuMs'),measuredMs:measured,nodesPerSecond:nodes*1000/ms,evaluationsPerSecond:sum('evaluations')*1000/ms,
   meanDepth:meanOf('depth'),medianDepth:quantile(rows.map(r=>r.depth),.5),depthHistogram:Object.fromEntries([...new Set(rows.map(r=>r.depth))].sort((a,b)=>a-b).map(d=>[d,rows.filter(r=>r.depth===d).length])),
   meanMoveMs:measured/rows.length,medianMoveMs:quantile(rows.map(r=>r.measuredMs),.5),maxOverrunMs:Math.max(...rows.map(r=>r.overrunMs)),overrun1:rows.filter(r=>r.overrunMs>1).length,overrun5:rows.filter(r=>r.overrunMs>5).length,
   exact:rows.filter(r=>r.exact).length,above14:rows.filter(r=>r.depth>14).length,interrupted:rows.filter(r=>r.timedOut).length,fallbacks:rows.filter(r=>r.depth===0).length,
   ...Object.fromEntries(['ttProbes','ttHits','ttBoundHits','ttCutoffs','ttCollisions','ttReplacements','ttStores','ttRejectedStores','cutoffs','firstMoveCutoffs'].map(k=>[k,sum(k)]))});
 }
 return result;
}
