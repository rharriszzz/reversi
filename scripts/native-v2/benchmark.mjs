#!/usr/bin/env node
// Matched complete searches; baseline binary is preserved before source edits.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {build} from '../native/build.mjs';
import {NativeEngine,boardArgs} from '../native/client.mjs';
import {positions as engineeringPositions} from './positions.mjs';
import {measure,output,atomic,read} from './common.mjs';
const tag=process.argv[2]??'final',receipt=build({directory:resolve(output,`build-${tag}`)});
const baseline=read(resolve(output,'baseline/build/build.json'));
await measure(`benchmark-${tag}`,async()=>{
 const engines=[new NativeEngine({receipt:baseline}),new NativeEngine({receipt})],rows=[];
 try {
  for(const e of engines)await e.ready();
  for(let rep=0;rep<7;rep++)for(const model of ['B','P'])for(const p of engineeringPositions()){
   const depth=p.occupied<28?8:p.occupied<52?7:Math.min(10,64-p.occupied),results=[];
   for(const i of (rep%2?[1,0]:[0,1])){
    // Hints off makes complete tree size independent of earlier requests.
    const search=await engines[i].search(p.board,p.player,{model,depth,hints:false});
    const evaluation=await engines[i].request(`evalbench ${boardArgs(p.board,p.player,model)} 200000`);
    results[i]={search,evaluation};
   }
   assert.equal(results[0].search.score,results[1].search.score);
   assert.equal(results[0].search.nodes,results[1].search.nodes);
   assert.equal(results[0].search.evaluations,results[1].search.evaluations);
   rows.push({rep,model,position:p.id,occupied:p.occupied,depth,baseline:results[0],current:results[1]});
  }
  atomic(resolve(output,`benchmark-${tag}.json`),{baseline,current:receipt,positions:engineeringPositions(),rows});
  for(const model of ['B','P']){
   const pairs=Array.from({length:7},(_,rep)=>{const xs=rows.filter(r=>r.rep===rep&&r.model===model),sum=(side,k)=>xs.reduce((n,r)=>n+r[side].search[k],0);return {baselineMs:sum('baseline','elapsedMs'),currentMs:sum('current','elapsedMs'),nodes:sum('current','nodes')};});
   console.log(JSON.stringify({tag,model,pairs}));
  }
 }finally{engines.forEach(e=>e.close());}
});
