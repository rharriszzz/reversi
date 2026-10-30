#!/usr/bin/env node
import {resolve} from 'node:path';
import {NativeEngine} from '../native/client.mjs';
import {build} from '../native/build.mjs';
import {positions} from './positions.mjs';
import {output,measure,atomic,read} from './common.mjs';
const receipt=build({directory:resolve(output,'build-final')}),baseline=read(resolve(output,'baseline/build/build.json'));
await measure('timed-final',async()=>{
 const engines=[new NativeEngine({receipt:baseline}),new NativeEngine({receipt})],timed=[],ipc=[],startup=[];
 try{
  for(const [i,e] of engines.entries()){const start=performance.now();await e.ready();startup.push({i,ms:performance.now()-start});for(let j=0;j<100;j++){const t=performance.now();await e.ready();ipc.push({i,ms:performance.now()-t});}}
  for(let rep=0;rep<3;rep++)for(const model of ['B','P'])for(const timeMs of [80,300])for(const p of positions()){
   const rows={};for(const variant of (rep%2?['uncapped','capped','baseline']:['baseline','capped','uncapped'])){
    const engine=engines[variant==='baseline'?0:1];
    // Reset before every variant so capped and uncapped searches begin with
    // identical TT history. Process startup is outside the timed request.
    engine.cancel();await engine.ready();
    await engine.search(p.board,p.player,{model,depth:3});
    rows[variant]=await engine.search(p.board,p.player,{model,timeMs,...(variant==='uncapped'?{}:{depth:14})});
   }
   timed.push({rep,model,timeMs,position:p.id,occupied:p.occupied,...rows});
  }
  atomic(resolve(output,'timed-final.json'),{receipt,baseline,positions:positions(),timed,ipc,startup});console.log(JSON.stringify({timed:timed.length,variants:3}));
 }finally{engines.forEach(e=>e.close());}
});
