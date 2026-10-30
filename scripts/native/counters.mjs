#!/usr/bin/env node
// Optional macOS hardware-counter probe, never required to build or play.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { NativeEngine } from './client.mjs';
import { engineeringPositions } from './positions.mjs';
import { measure,output,atomic } from './measure.mjs';
await measure('hardware-counters',async()=>{
 const engine=new NativeEngine();try {
  await engine.ready();const trace=resolve(output,'cpu-counters.trace');let log='';
  const child=spawn('xcrun',['xctrace','record','--template','CPU Counters','--attach',String(engine.child.pid),'--time-limit','8s','--no-prompt','--output',trace],{stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
  const recording=new Promise(resolve=>{child.on('error',e=>resolve({error:String(e)}));child.on('exit',(code,signal)=>resolve({code,signal}));});
  const watchdog=setTimeout(()=>child.kill('SIGTERM'),25000);let done=false;recording.then(()=>done=true);
  const p=engineeringPositions()[7],start=performance.now();let nodes=0,searches=0;
  while(!done&&performance.now()-start<26000){const r=await engine.search(p.board,p.player,{model:'P',depth:10,timeMs:1000});nodes+=r.nodes;searches++;}
  const status=await recording;clearTimeout(watchdog);
  atomic(resolve(output,'hardware-counters.json'),{status,log,trace,nodes,searches,wallMs:performance.now()-start});console.log(JSON.stringify({status,log}));
 }finally{engine.close();}
});
