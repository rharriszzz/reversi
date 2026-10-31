// Repeat complete roots after the profile-driven gate; preserve initial builds.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {build} from '../native/build.mjs';
import {NativeEngine} from '../native/client.mjs';
const out=resolve('.local-research/mac-modernization-20261030'),initial=JSON.parse(readFileSync(resolve(out,'experiments.json')));
const receipts={baseline:initial.receipts.baseline,initial:initial.receipts.last2,final:build()},engines=Object.fromEntries(Object.entries(receipts).map(([k,receipt])=>[k,new NativeEngine({receipt})])),rows=[];
const depth=p=>p.exactRoot?64-p.occupied:p.occupied<28?8:p.occupied<52?7:Math.max(1,Math.min(10,64-p.occupied));
try {
 for(const e of Object.values(engines))await e.ready();
 for(const model of ['B','P'])for(const p of initial.positions)for(const e of Object.values(engines))await e.search(p.board,p.player,{model,depth:depth(p),hints:false});
 for(let rep=0;rep<9;rep++) {
  let order=Object.keys(engines);order=order.slice(rep%3).concat(order.slice(0,rep%3));if(rep%2)order.reverse();
  for(const model of rep%2?['P','B']:['B','P'])for(const p of initial.positions) {
   const results={};for(const tag of order)results[tag]=await engines[tag].search(p.board,p.player,{model,depth:depth(p),hints:false});
   assert.equal(results.final.score,results.baseline.score);assert.equal(results.initial.score,results.baseline.score);assert.equal(results.final.nodes,results.initial.nodes);
   rows.push({rep,model,position:p.id,depth:depth(p),order,results});
  }
 }
 const median=a=>a.sort((a,b)=>a-b)[a.length>>1],summary=[];
 for(const scope of ['all','exact','legacy36'])for(const model of ['B','P'])for(const tag of Object.keys(engines)) {
  const selected=new Set(initial.positions.filter(p=>scope==='all'||(scope==='exact'?p.exactRoot:!p.exactRoot)).map(p=>p.id));
  const batches=Array.from({length:9},(_,rep)=>rows.filter(r=>r.rep===rep&&r.model===model&&selected.has(r.position)).reduce((a,r)=>a+r.results[tag].elapsedMs,0));
  summary.push({scope,model,tag,medianMs:median([...batches]),batches});
 }
 writeFileSync(resolve(out,'repeated-experiments.json'),JSON.stringify({receipts,positions:initial.positions,rows,summary})+'\n');console.log(JSON.stringify(summary));
}finally{Object.values(engines).forEach(e=>e.close());}
