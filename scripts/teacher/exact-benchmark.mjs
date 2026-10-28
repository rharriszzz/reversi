#!/usr/bin/env node
// Bounded engineering benchmark, never a teacher-qualification launcher.
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Worker} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {ExactSolver,solveBoth} from './exact.mjs';
import {solveReference} from './reference-exact.mjs';
import {trajectory} from './validate.mjs';
import {loadHistorical,boardKeys} from './qualification-data.mjs';
import {identity,alternatives,sha} from './edax.mjs';
import {Progress,Profiler} from '../strong/telemetry.mjs';
import {read,atomic,seedFor,sourceDigest} from '../research/io.mjs';
import {hash,receipt,writerLock,quantile,mean} from './qualification-core.mjs';
import {canonical} from '../research/core.mjs';
import {oracleChildren} from '../../tests/oracle.mjs';
const bare=r=>r.rows.map(({move,value})=>[move,value||0]);
export function runCase(state,kind,options={}){
 const start=performance.now(),cpu=process.cpuUsage(),before=process.memoryUsage(),deadline=start+10000;
 let result,error;
 try{
  if(kind==='original'){
   const traces=[];const solve=awarded=>{const t=performance.now(),c=process.cpuUsage(),trace={cutoffs:0,alternatives:[]};const value=solveReference(state.board,state.player,awarded,deadline,{trace});const u=process.cpuUsage(c);traces.push({awarded,wallMs:performance.now()-t,cpuMs:(u.user+u.system)/1000,...trace});return value;};
   const awarded=solve(true),raw=solve(false);if(performance.now()>=deadline)throw Error('Original combined cap');result={awarded,raw,traces};
  }else result=solveBoth(state.board,state.player,{...options,deadline});
 }catch(e){error={message:e.message,stats:e.stats};}
 const c=process.cpuUsage(cpu),memory=process.memoryUsage();return {kind,options,state,result,error,wallMs:performance.now()-start,cpuMs:(c.user+c.system)/1000,memoryBefore:before,memoryAfter:memory,heapDelta:memory.heapUsed-before.heapUsed,resource:process.resourceUsage(),accounting:'isolated process CPU and process-lifetime maximum RSS; not allocation totals'};
}
export async function main(){
 const output=resolve(process.argv[2]??'.local-research/exact-benchmark'),repository=resolve('.');mkdirSync(output,{recursive:true});
 if(existsSync(`${output}/results.json`)&&read(`${output}/results.json`).status==='complete'){console.log('Engineering benchmark already complete; use read-only publication to inspect it.');return;}
 const protocol={version:1,namespace:'exact-engineering-20261028',freshPerEmpty:12,empties:[8,10,12],caseCapMs:10000,capMs:900000,reportReserveMs:180000,workers:1,tableBits:18,ablationRoots:6,repetitions:3,order:'alternate original/optimized by case index; isolated processes; frozen before timing; no outcome selection'};
 const pin=identity(`${repository}/.local-research/teacher/edax/bin/lEdax-x86-64-v3`,`${repository}/.local-research/teacher/edax/bin/data/eval.dat`),source=sourceDigest(repository),runIdentity=hash({protocol,pin,source});
 if(existsSync(`${output}/protocol.json`)&&read(`${output}/protocol.json`).runIdentity!==runIdentity)throw Error('Benchmark source/protocol mismatch');atomic(`${output}/protocol.json`,{protocol,pin,source,runIdentity});
 const unlock=writerLock(`${output}/writer.lock`),progress=new Progress(output),profiler=new Profiler(),start=performance.now();const priorElapsed=existsSync(`${output}/budget.json`)?read(`${output}/budget.json`).elapsedMs+(existsSync(`${output}/tasks/inputs.json`)?30000:600000):0;let lastResources=0;const results=[];
 atomic(`${output}/budget.json`,{elapsedMs:priorElapsed});
 const check=()=>{if(priorElapsed+performance.now()-start>protocol.capMs-protocol.reportReserveMs)throw Error('Engineering cap; reporting reserve');};
 function resources(){if(lastResources&&performance.now()-lastResources<60000)return;const p=spawnSync('python3',['scripts/teacher/qualification-launch.py','--output',output,'--resources-only'],{encoding:'utf8',timeout:35000});if(p.status!==0)throw Error(p.stderr);const r=JSON.parse(p.stdout);if(r.blockers.length)throw Error(r.blockers.join('; '));if(r.limitingAvailableGiB<2.1)throw Error('Engineering single-worker headroom');lastResources=performance.now();}
 async function durable(name,input,fn){return receipt(`${output}/tasks/${name}.json`,input,runIdentity,async()=>{check();const value=await fn();atomic(`${output}/budget.json`,{elapsedMs:priorElapsed+performance.now()-start});return value;});}
 function isolated(state,kind,options={},operation=''){
  check();resources();progress.update({task:`${state.id} ${kind}`,note:`one bounded worker process; ${operation} options=${JSON.stringify(options)}; combined conventions, ten-second cap`});progress.emit('query-start');
  const script=fileURLToPath(new URL('./exact-benchmark-worker.mjs',import.meta.url));const p=spawnSync(process.execPath,[script],{input:JSON.stringify({state,kind,options}),encoding:'utf8',timeout:12000,maxBuffer:8e6});
  if(p.status!==0)throw Error(`Benchmark worker failure: ${p.error?.message??p.stderr}`);return JSON.parse(p.stdout);
 }
 try{
  resources();progress.set({stage:'admission',substage:'engineering-only',task:'exclude all prior trajectories and untouched qualification reservations'});
  const inputs=await durable('inputs',{protocol},async()=>{
   const historical=loadHistorical(repository),used=historical.keys,seeds=historical.seeds;const states=[];let attempts=0;
   for(const empty of protocol.empties)for(let k=0;k<protocol.freshPerEmpty;){check();if(attempts>=20000)throw Error('Engineering admission exhausted');const seed=seedFor(protocol.namespace,`empty-${empty}`,attempts++);if(seeds.has(seed))continue;seeds.add(seed);const all=trajectory(seed),state=all.find(s=>s.board.filter(x=>!x).length===empty);if(!state||oracleChildren(state.board,state.player).length<2)continue;
    const history=all.filter(s=>s.board.filter(Boolean).length>=12),keys=history.flatMap(s=>boardKeys(s));if(keys.some(k=>used.has(k))||boardKeys(state,true).some(k=>used.has(k)))continue;
    const s={...state,id:`fresh-${empty}-${k}`,seed,empty};states.push(s);atomic(`${output}/trajectories/${s.id}.json`,{state:s,history});for(const key of keys)used.add(key);for(const key of boardKeys(state,true))used.add(key);k++;
    if(attempts>20000)throw Error('Engineering admission exhausted');
   }
   const old=read(`${repository}/.local-research/teacher-qualification-v2-20261028/tasks/reservation.json`).result.roles['exact-cost'];
   return {states:[...states,...old.map(s=>({...s,id:`disclosed-${s.id}`,empty:64-s.occupied}))],attempts,exclusions:historical.audit,lockedAssessment:old.length===8?'not searched':'invalid'};
  });
  atomic(`${output}/inputs.json`,inputs);progress.set({stage:'matched-benchmark',substage:'single-worker',task:'original/optimized and exact Edax cross-check',total:inputs.states.length});
  for(let i=0;i<inputs.states.length;i++){
   check();const s=inputs.states[i],trials={};
   for(const kind of i%2?['optimized','original']:['original','optimized'])trials[kind]=await durable(`${s.id}-${kind}`,{s,kind,tableBits:18},()=>isolated(s,kind));
   const teacher=await durable(`${s.id}-edax`,{s,pin},()=>alternatives(pin,s,s.empty,{measureNative:true,timeoutMs:30000,transcript:`${output}/raw/${s.id}.json`}));
   const optimized=trials.optimized.result;if(!optimized)throw Error(`Optimized failed: ${s.id}`);
   if(JSON.stringify(bare(optimized.awarded))!==JSON.stringify(bare(teacher)))throw Error(`Edax mismatch ${s.id}`);
   if(trials.original.result)for(const kind of ['raw','awarded'])if(JSON.stringify(bare(trials.original.result[kind]))!==JSON.stringify(bare(optimized[kind])))throw Error(`Original mismatch ${s.id}/${kind}`);
   results.push({id:s.id,empty:s.empty,seed:s.seed,trials,edax:teacher});
   atomic(`${output}/progress.json`,{completed:i+1,total:inputs.states.length,lastDurable:s.id,elapsedMs:priorElapsed+performance.now()-start});progress.update({completed:i+1,positions:i+1,checkpoint:new Date().toISOString(),eta:`conservative remaining original search bound ${(inputs.states.length-i-1)*10/60} minutes plus overhead`});progress.emit('case-complete');
  }
  // Ablations and repetitions use the first fixed two fresh roots per empty
  // count, plus the disclosed difficult root. No fastest-case selection.
  const chosen=[8,10,12].flatMap(e=>inputs.states.filter(s=>s.id.startsWith('fresh-')&&s.empty===e).slice(0,2));chosen.push(inputs.states.find(s=>s.id==='disclosed-exact-cost-5'));
  const ablations=[];let ablationCompleted=0;progress.set({stage:'ablation',substage:'fixed-roots',task:'ordering and transpositions',total:chosen.length*4,completed:0,positions:0});
  for(const s of chosen){for(const options of [{useTT:false,ordering:false},{useTT:false,ordering:true},{useTT:true,ordering:false},{useTT:true,ordering:true}]){
   check();const r=await durable(`${s.id}-ablation-${hash(options).slice(0,8)}`,{s,options},()=>isolated(s,'optimized',options));
   const expected=results.find(x=>x.id===s.id).trials.optimized.result;
   if(r.result)for(const k of ['raw','awarded'])if(JSON.stringify(bare(r.result[k]))!==JSON.stringify(bare(expected[k])))throw Error('Ablation mismatch');ablations.push(r);progress.update({completed:++ablationCompleted,positions:ablationCompleted});
  }}
  const repeats=[];progress.set({stage:'repeat',substage:'fixed-roots',task:'three isolated process repetitions',total:chosen.length*protocol.repetitions,completed:0,positions:0});for(let rep=0;rep<protocol.repetitions;rep++)for(const s of chosen){check();repeats.push(await durable(`${s.id}-repeat-${rep}`,{s,rep},()=>isolated(s,'optimized',{},`repeat ${rep+1}/${protocol.repetitions}`)));progress.update({completed:repeats.length,positions:repeats.length});}
  atomic(`${output}/results.json`,{status:'complete',protocol,pin,source,runIdentity,inputs,results,ablations,repeats,elapsedMs:priorElapsed+performance.now()-start,profile:profiler.snapshot()});
  console.log(JSON.stringify({status:'complete',roots:results.length,elapsedMs:priorElapsed+performance.now()-start}));
 }catch(e){atomic(`${output}/error.json`,{error:e.stack,completed:results.length,elapsedMs:priorElapsed+performance.now()-start});throw e;}
 finally{progress.close();profiler.close();unlock();}
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1;});
