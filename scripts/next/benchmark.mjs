#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from './pool.mjs';
import { read, atomic, seedFor } from '../research/io.mjs';
import { pack, createModel } from '../strong/model.mjs';
import { Progress } from '../strong/telemetry.mjs';
const output=resolve(process.argv[2]??'.local-research/next-integrated');mkdirSync(output,{recursive:true});
const resources=read('.local-research/next-resource-check/preflight.json');
if(resources.blockers.length||Date.now()-Date.parse(resources.at)>600000)throw new Error('fresh successful resource preflight required');
const sustained=process.argv.includes('--sustained'),taskCount=sustained?64:16;
const progress=new Progress(output),results=[],start=performance.now();
let pool;
try {
 pool=new Pool(1,output,progress);
 const data=await pool.run('benchmark-data',{type:'generate',n:64,index:0,split:'benchmark',depth:2,seeds:Array.from({length:64},(_,i)=>seedFor(2026102822,'benchmark',i)),models:[]});
 const paths=[`${output}/data.json`];atomic(paths[0],{games:data.games});
 const refs=await pool.run('benchmark-labels',{type:'label',paths,limit:16,exactLimit:16,depth:5,empties:8,exactMs:2000,models:[]});
 const labels=[`${output}/labels.json`];atomic(labels[0],{labels:refs.labels});
 const model=`${output}/initial-long.json`;atomic(model,pack(createModel('long','rank')));await pool.close();
 // Hold the useful work fixed; independent seeds and fit tasks are identical
 // across counts. Each task model starts from the SAME initial checkpoint.
 const counts=[1,2,4,6,8].filter(n=>n*.40+1.5<resources.limitingAvailableGiB&&n<resources.logicalCpus);
 for(const workers of counts)for(let repeat=0;repeat<3;repeat++)for(const type of (process.argv.includes('--labels-only')?['label']:process.argv.includes('--fits-only')?['fit']:['generate','label','fit'])) {
  progress.set({stage:'scaling',substage:type,task:`${workers} workers repetition ${repeat+1}/3`,total:taskCount,completed:0});
  pool=new Pool(workers,output,progress);let peakRss=process.memoryUsage().rss;
  const monitor=setInterval(()=>{peakRss=Math.max(peakRss,process.memoryUsage().rss);},25);
  const cpu=process.cpuUsage(),t=performance.now();
  const jobs=Array.from({length:taskCount},(_,i)=>({id:`w${workers}-r${repeat}-${type}-${i}`,job:type==='generate'?{type,n:sustained?8:4,index:i*(sustained?8:4),split:'scaling',depth:sustained?3:2,seeds:Array.from({length:sustained?8:4},(_,k)=>seedFor(2026102823,'scaling',i*(sustained?8:4)+k)),models:[]}:type==='label'?{type,paths,partition:{part:i,parts:taskCount},limit:sustained?4:2,exactLimit:2,depth:sustained?6:5,empties:8,exactMs:2000,models:[]}:{type,model,paths,development:paths,labels,epochs:sustained?12:4,seed:1234+i}}));
  const outcomes=await pool.batch(jobs),c=process.cpuUsage(cpu),wallMs=performance.now()-t;clearInterval(monitor);peakRss=Math.max(peakRss,process.memoryUsage().rss);
  const units=type==='generate'?outcomes.reduce((n,r)=>n+r.games.length,0):type==='label'?outcomes.reduce((n,r)=>n+r.labels.length,0):outcomes.reduce((n,r)=>n+r.examples*r.curve.length,0);
  results.push({workers,repeat,type,wallMs,cpuMs:(c.user+c.system)/1000,peakRssMiB:peakRss/2**20,units,unitsPerHour:units*3600000/wallMs,profile:outcomes.map(r=>r.profile)});
  atomic(`${output}/results.json`,{resources,results,elapsedMs:performance.now()-start});await pool.close();
 }
}finally{await pool?.close();progress.close();}
console.log(`Integrated scaling complete ${(performance.now()-start)/1000}s`);
