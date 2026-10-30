#!/usr/bin/env node
import { resolve } from 'node:path';
import { NativeEngine,boardArgs } from './client.mjs';
import { build } from './build.mjs';
import { engineeringPositions } from './positions.mjs';
import { measure,output,atomic,read } from './measure.mjs';
import assert from 'node:assert/strict';
const current=build(),initial={...read(resolve(output,'checkpoints/initial/build.json')),executable:resolve(output,'checkpoints/initial/reversi-native')};
await measure('optimization-comparison',async()=>{
 const engines=[new NativeEngine({receipt:initial}),new NativeEngine({receipt:current})],rows=[];
 try {
  await engines[0].ready();await engines[1].ready();
  for(let repetition=0;repetition<7;repetition++)for(const model of ['B','P'])for(const p of engineeringPositions()) {
   const depth=p.occupied<28?8:p.occupied<52?7:Math.min(9,64-p.occupied),results=[];
   for(const index of (repetition%2?[1,0]:[0,1])) {
    const search=await engines[index].search(p.board,p.player,{model,depth});
    const evaluation=await engines[index].request(`evalbench ${boardArgs(p.board,p.player,model)} 20000`);
    results[index]={search,evaluation};
   }
   assert.ok(Math.abs(results[0].search.score-results[1].search.score)<1e-10);assert.equal(results[0].search.nodes,results[1].search.nodes);
   rows.push({model,position:p.id,occupied:p.occupied,depth,repetition,initial:results[0],optimized:results[1]});
  }
  atomic(resolve(output,'optimization-comparison.json'),{initial,current,rows});console.log('Saved matched native optimization comparisons');
 }finally{engines.forEach(e=>e.close());}
});
