// Called only after complete outcome-blind replay/hash audit.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {sha} from '../native/build.mjs';
import {pairSummary} from '../frozen-player/statistics.mjs';
import {bootstrap,mean,quantile} from '../p-confirmation/statistics.mjs';
const out='.local-research/mac-modernization-20261030',read=f=>JSON.parse(readFileSync(`${out}/${f}`));
const audit=read('backend-audit.json'),registration=read('backend-registration.json');assert.equal(audit.passed,true);
assert.equal(audit.sealedSha256,sha(readFileSync(`${out}/backend-games.sealed.jsonl`)));
const games=readFileSync(`${out}/backend-games.sealed.jsonl`,'utf8').trim().split('\n').map(JSON.parse);assert.equal(games.length,256);
const conditions=[],telemetry=[],families=[];
for(const budgetMs of [80,300]) {
 const selected=games.filter(g=>g.budgetMs===budgetMs).map(g=>{const margin=g.rawBlackMargin*g.nativeColor;return {...g,margin,points:margin>0?1:margin<0?0:.5};});assert.equal(selected.length,128);
 const pairs=Array.from({length:64},(_,family)=>{const xs=selected.filter(g=>g.family===family);assert.deepEqual(xs.map(g=>g.nativeColor).sort(),[-1,1]);return {family,budgetMs,score:mean(xs.map(g=>g.points)),margin:mean(xs.map(g=>g.margin))};});families.push(...pairs);
 conditions.push({budgetMs,games:128,families:64,wins:selected.filter(g=>g.points===1).length,draws:selected.filter(g=>g.points===.5).length,losses:selected.filter(g=>g.points===0).length,...pairSummary(pairs.map(p=>p.score)),bootstrap:bootstrap(pairs,['score','margin'],{reps:registration.bootstrapReplicates,seed:registration.bootstrapSeed+budgetMs}),wallSeconds:selected.reduce((a,g)=>a+g.wallSeconds,0)});
 for(const backend of ['native','wasm']) {
  const rs=selected.flatMap(g=>g.steps.filter(s=>s.backend===backend)),sum=k=>rs.reduce((a,r)=>a+(r[k]??0),0);
  telemetry.push({budgetMs,backend,moves:rs.length,meanDepth:mean(rs.map(r=>r.depth)),medianDepth:quantile(rs.map(r=>r.depth),.5),maxDepth:Math.max(...rs.map(r=>r.depth)),nodes:sum('nodes'),evaluations:sum('evaluations'),coreMs:sum('elapsedMs'),nativeCpuMs:backend==='native'?sum('cpuMs'):null,outerWallMs:sum('outerWallMs'),millionNodesPerSecond:sum('nodes')/sum('elapsedMs')/1000,meanNodes:sum('nodes')/rs.length,meanCoreMs:sum('elapsedMs')/rs.length,meanOuterMs:sum('outerWallMs')/rs.length,exact:rs.filter(r=>r.exact).length,above14:rs.filter(r=>r.depth>14).length,fallbacks:rs.filter(r=>r.depth===0).length,interrupted:rs.filter(r=>r.timedOut).length,maxCoreOverrunMs:Math.max(...rs.map(r=>r.elapsedMs-budgetMs)),maxOuterOverrunMs:Math.max(...rs.map(r=>r.outerWallMs-budgetMs)),overrun1:rs.filter(r=>r.elapsedMs-budgetMs>1).length,overrun5:rs.filter(r=>r.elapsedMs-budgetMs>5).length,...Object.fromEntries(['ttProbes','ttHits','ttBoundHits','ttCollisions','ttReplacements','ttCutoffs','ttStores','ttRejectedStores','cutoffs','firstMoveCutoffs'].map(k=>[k,sum(k)]))});
 }
}
const result={passed:true,conditions,telemetry,families,statisticalUnit:'64 paired opening families at each budget, shared across budgets; no moves treated as independent samples',interpretation:'Engineering comparison of P execution backends. Timed scheduling and this opening sample limit general strength conclusions. No evaluator promotion.'};
writeFileSync(`${out}/backend-analysis.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.conditions));
