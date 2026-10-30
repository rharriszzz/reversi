#!/usr/bin/env node
import { resolve } from 'node:path';
import { mkdirSync,copyFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { NativeEngine } from './client.mjs';
import { build } from './build.mjs';
import { engineeringPositions } from './positions.mjs';
import { measure,output,atomic } from './measure.mjs';
const tag=process.argv[2]??'final',instrument=process.argv.includes('--instrument');
const receipt=build({directory:resolve(output,`profile-${tag}-${instrument?'instrument':'sample'}`),profile:true,instrument});
await measure(`profile-${tag}-${instrument?'instrument':'sample'}`,async()=>{
 const rows=[];
 for(const [phase,index,depth] of [['opening',2,8],['middle',7,7],['endgame',13,10]]) {
  const engine=new NativeEngine({receipt}),p=engineeringPositions()[index];
  try {
   await engine.ready();await engine.search(p.board,p.player,{model:'P',depth:3});
   const file=resolve(output,`profile-${tag}-${phase}.txt`);
   let sampled=Promise.resolve(null);
   if(!instrument&&process.platform==='darwin')sampled=new Promise(ok=>{const child=spawn('/usr/bin/sample',[String(engine.child.pid),'8','1','-file',file],{stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',b=>error+=b);child.on('error',e=>ok({error:String(e)}));child.on('exit',code=>ok({code,error}));});
   const start=performance.now();let searches=0,nodes=0,evaluations=0,cpuMs=0,searchMs=0,ttProbes=0,ttHits=0,cutoffs=0;
   while(performance.now()-start<10000) {const r=await engine.search(p.board,p.player,{model:'P',depth,timeMs:1000});searches++;nodes+=r.nodes;evaluations+=r.evaluations;cpuMs+=r.cpuMs;searchMs+=r.elapsedMs;ttProbes+=r.ttProbes;ttHits+=r.ttHits;cutoffs+=r.cutoffs;}
   const counters=await engine.request('profile'),sampling=await sampled;
   rows.push({phase,position:p,depth,searches,nodes,evaluations,cpuMs,searchMs,wallMs:performance.now()-start,ttProbes,ttHits,cutoffs,counters,sampling});
   atomic(resolve(output,`profile-${tag}-${instrument?'instrument':'sample'}.json`),{receipt,instrument,parts:['legal','flips','features (exclusive of mobility)','patterns','TT','ordering'],rows});
   console.log(JSON.stringify({phase,instrument,searches,nodes}));
  }finally{engine.close();}
 }
});
