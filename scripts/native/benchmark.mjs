#!/usr/bin/env node
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { NativeEngine, boardArgs } from './client.mjs';
import { build } from './build.mjs';
import { engineeringPositions } from './positions.mjs';
import { findBestMove } from '../../src/search.js';
import { frozenModels } from '../frozen-player/models.mjs';
import { compile } from '../next-residual/model.mjs';
import { measure,output,atomic } from './measure.mjs';
const tag=process.argv[2]??'final',receipt=build(),models=frozenModels(),positions=engineeringPositions();
await measure(`benchmark-${tag}`,async()=>{
 const engine=new NativeEngine({receipt});try {
 const startup=performance.now();const hello=await engine.ready(),startupMs=performance.now()-startup;
 const rows=[],ipc=[];
 for(let i=0;i<50;i++) {const t=performance.now();await engine.ready();ipc.push(performance.now()-t);}
 for(const model of ['B','P']) {
  const evaluator=compile(models[model]).evaluate;
  // Warm V8 and native paths on the exact disclosed work, outside trials.
  for(const p of positions) {for(let k=0;k<400;k++)evaluator(p.board,p.player);findBestMove(p.board,p.player,3,undefined,{evaluate:evaluator});await engine.search(p.board,p.player,{model,depth:3});}
  for(let repetition=0;repetition<5;repetition++)for(const [index,p] of positions.entries()) {
   const depth=p.occupied<28?6:p.occupied<52?5:Math.min(8,64-p.occupied),n=20000;
   let checksum=0;const cpu=process.cpuUsage(),t=performance.now();for(let k=0;k<n;k++)checksum+=evaluator(p.board,p.player);
   const staticJs={elapsedMs:performance.now()-t,cpu:process.cpuUsage(cpu),evaluations:n,checksum};
   const staticNative=await engine.request(`evalbench ${boardArgs(p.board,p.player,model)} ${n}`);
   const js=()=>findBestMove(p.board,p.player,depth,undefined,{evaluate:evaluator});
   let javascript,native;const start=performance.now(),cpuStart=process.cpuUsage();
   if(repetition%2===0){javascript=js();javascript.cpu=process.cpuUsage(cpuStart);native=await engine.search(p.board,p.player,{model,depth});}
   else{native=await engine.search(p.board,p.player,{model,depth});const c=process.cpuUsage();javascript=js();javascript.cpu=process.cpuUsage(c);}
   assert.ok(Math.abs(javascript.score-native.score)<1e-9);assert.ok(Math.abs(staticJs.checksum-staticNative.checksum)<1e-5);
   rows.push({model,repetition,position:p.id,occupied:p.occupied,depth,staticJs,staticNative,javascript,native,totalTrialMs:performance.now()-start});
  }
 }
 const timed=[];
 for(let repetition=0;repetition<5;repetition++)for(const model of ['B','P'])for(const timeMs of [80,300])for(const p of positions.filter((_,i)=>[0,2,4,6,8,10,12,14,16].includes(i))) {
  const evaluator=compile(models[model]).evaluate;let javascript,native;
  if(repetition%2){native=await engine.search(p.board,p.player,{model,timeMs});javascript=findBestMove(p.board,p.player,14,undefined,{evaluate:evaluator,timeMs});}
  else{javascript=findBestMove(p.board,p.player,14,undefined,{evaluate:evaluator,timeMs});native=await engine.search(p.board,p.player,{model,timeMs});}
  timed.push({model,timeMs,repetition,position:p.id,occupied:p.occupied,javascript,native});
 }
 atomic(resolve(output,`benchmark-${tag}.json`),{version:1,receipt,node:process.version,positions,hello,startupMs,ipc,rows,timed});
 console.log(JSON.stringify({stage:`benchmark-${tag}`,fixed:rows.length,timed:timed.length,startupMs}));
 }finally{engine.close();}
});
