#!/usr/bin/env node
// Development-only, fixed-target adapter engineering. Never opens V4 assessment.
import {existsSync,mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {identity,alternatives} from './edax.mjs';
import {preflight} from './bound-preflight.mjs';
import {reserveData} from './qualification-data.mjs';
import {PROTOCOL,hash,receipt,writerLock} from './qualification-core.mjs';
import {sourceDigest,atomic,read} from '../research/io.mjs';
import {solveBoth} from './exact.mjs';
import {replay} from './qualification.mjs';
import {QualificationProgress} from './qualification-progress.mjs';
const root=fileURLToPath(new URL('../..',import.meta.url)),bare=r=>r.rows.map(({move,value})=>({move,value}));
export async function main(){
 const [destination,repositoryArg,buildArg]=process.argv.slice(2),repository=resolve(repositoryArg??root),output=resolve(destination),buildFile=resolve(buildArg),build=read(buildFile),evalFile=`${repository}/.local-research/teacher/edax/bin/data/eval.dat`;
 mkdirSync(output,{recursive:true});if(existsSync(`${output}/results.json`)){const old=read(`${output}/results.json`);if(old.status==='complete'){console.log('Engineering already finished; no queries repeated');return;}if(!old.error?.includes('Interrupted;'))throw Error('Stopped engineering query failure is not resumable');}
 const original=identity(`${repository}/.local-research/teacher/edax/bin/lEdax-x86-64-v3`,evalFile),repaired=identity(build.binary,evalFile,{buildFile}),source=sourceDigest(root),protocol={...PROTOCOL,namespace:'bound-engineering-20261028',costPerPhase:16,assessmentPerPhase:0,exactCostPerEmpty:8,exactAssessmentPerEmpty:0,capMs:900000,queryCapMs:20000,roles:'64 development roots plus 16 independently solved development endings; all 154 completed V3 roots at D10/D12 as disclosed regression',success:'all exact alternatives agree; no fresh unresolved results; compare all previously accepted values and report every change'};
 const runIdentity=hash({source,original,repaired,protocol}),prior=existsSync(`${output}/manifest.json`)?read(`${output}/manifest.json`):null;if(prior&&prior.runIdentity!==runIdentity)throw Error('Engineering source/build mismatch');
 const unlock=writerLock(`${output}/writer.lock`),progress=new QualificationProgress(output),start=performance.now(),base=prior?.elapsedMs??0,state={status:'running',source,original,repaired,protocol,runIdentity,elapsedMs:base,completed:prior?.completed??0};let nativeCpu=0,maxRss=0,lastResource=0;
 const checkpoint=()=>{state.elapsedMs=base+performance.now()-start;atomic(`${output}/manifest.json`,state);progress.update({checkpoint:new Date().toISOString(),nativeCpuSeconds:nativeCpu,nativeMaxRssMiB:maxRss/2**20});};
 const check=()=>{if(base+performance.now()-start>protocol.capMs-60000)throw Error('Engineering cap protects reporting minute');};
 function resources(){if(lastResource&&performance.now()-lastResource<60000)return;const p=spawnSync('python3',[`${root}/scripts/teacher/qualification-launch.py`,'--output',output,'--resources-only'],{encoding:'utf8',timeout:35000});if(p.status)throw Error(p.stderr);const r=JSON.parse(p.stdout);if(r.blockers.length||r.limitingAvailableGiB<2.1)throw Error('Interrupted; engineering resource reserve');lastResource=performance.now();progress.update({hostCpu:`${(100*Math.max(r.cpuBusy??0,(r.windows?.cpuPercent??0)/100)).toFixed(1)}%`});}
 const task=(name,input,fn)=>receipt(`${output}/tasks/${name}.json`,input,runIdentity,async()=>{check();const value=await fn();state.completed++;checkpoint();return value;});
 async function label(s,depth,variant){
  return task(`${s.id}-d${depth}-${variant}`,{s,depth,variant},async()=>{resources();check();progress.update({task:`${s.id} ${variant} D${depth}`});const path=`${output}/raw/${s.id}-d${depth}-${variant}.json`,t=performance.now();let r;
   try{r=await alternatives(variant==='original'?original:repaired,s,depth,{measureNative:true,timeoutMs:protocol.queryCapMs,transcript:path});replay(s,r);}catch(e){if(!existsSync(path))throw e;const raw=read(path);if(raw.code!==0||raw.expired)throw e;r={rejected:true,error:e.message,wallMs:performance.now()-t,native:raw.native};}
   nativeCpu+=(r.native?.userSeconds??0)+(r.native?.systemSeconds??0);maxRss=Math.max(maxRss,r.native?.maxRssBytes??0);progress.update({durations:`last=${((performance.now()-t)/1000).toFixed(3)}s`});return r;
  });
 }
 try{
  resources();progress.set({stage:'admission',task:'reserve all fresh development roots before native labels',total:80});
  const reservation=await task('reservation',{protocol},()=>reserveData(repository,output,check,(attempt,n)=>{progress.update({completed:n,task:`development admission attempt ${attempt}`});checkpoint();},{protocol}));global.gc?.();
  progress.set({stage:'independent-preflight',task:'35 independent fixtures, extrema, passes, transformations'});state.preflight=await task('preflight',{repaired},()=>preflight(repaired,`${output}/preflight`));
  progress.set({stage:'fresh-development',task:'original/repaired matched D10/D12',total:64});const fresh=[];
  for(const [i,s] of reservation.roles.cost.entries()){const labels={};for(const depth of [10,12])for(const variant of i%2?['repaired','original']:['original','repaired'])(labels[depth]??={})[variant]=await label(s,depth,variant);fresh.push({state:s,labels});progress.update({completed:i+1});if((i+1)%8===0)progress.emit('development-batch');}
  progress.set({stage:'independent-exact',task:'raw and awarded, D6/D8/exact, every alternative',total:16});const exact=[];
  for(const [i,s] of reservation.roles['exact-cost'].entries()){const independent=await task(`${s.id}-independent`,{s,capMs:10000},()=>solveBoth(s.board,s.player,{capMs:10000})),labels={};for(const d of [6,8,64-s.occupied])labels[d]=await label(s,d,'repaired');const full=labels[64-s.occupied];if(full.rejected||hash(bare(full))!==hash(bare(independent.awarded)))throw Error('Fresh exact mismatch');exact.push({state:s,independent,labels});progress.update({completed:i+1});}
  progress.set({stage:'disclosed-regression',task:'all completed V3 roots, D10/D12',total:154});const old=read(`${repository}/.local-research/teacher-qualification-v3-20261028-qualified/tasks/reservation.json`).result.roles.assessment.slice(0,154),regression=[];
  for(const [i,s0] of old.entries()){const s={...s0,id:`v3-${s0.id}`},labels={};for(const d of [10,12]){const r=await label(s,d,'repaired'),before=read(`${repository}/.local-research/teacher-qualification-v3-20261028-qualified/tasks/${s0.id}-d${d}.json`).result;if(r.rejected)throw Error('Repaired disclosed regression rejected');labels[d]={result:r,changed:hash(bare(before))!==hash(bare(r)),before:bare(before)};}regression.push({state:s,labels});progress.update({completed:i+1});if((i+1)%16===0)progress.emit('regression-batch');}
  state.status='complete';state.fresh=fresh;state.exact=exact;state.regression=regression;
 }catch(e){state.status='stopped';state.error=e.stack;throw e;}
 finally{checkpoint();atomic(`${output}/results.json`,state);progress.emit('engineering-finished',{status:state.status});progress.close();unlock();}
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1;});
