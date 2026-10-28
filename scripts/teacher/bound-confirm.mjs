#!/usr/bin/env node
// Final fixed-horizon candidate: complete predetermined engineering comparison.
import {mkdirSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {identity,alternatives,sha} from './edax.mjs';
import {read,atomic,sourceDigest} from '../research/io.mjs';
import {hash,receipt,writerLock} from './qualification-core.mjs';
import {solveBoth} from './exact.mjs';
import {replay} from './qualification.mjs';
import {QualificationProgress} from './qualification-progress.mjs';
const root=fileURLToPath(new URL('../..',import.meta.url)),bare=r=>r.rows.map(({move,value})=>({move,value}));
export async function main(){
 const [benchmark,buildFile,destination,repository,reuseDirectory]=process.argv.slice(2),output=resolve(destination),meta=read(buildFile),evalFile=`${repository}/.local-research/teacher/edax/bin/data/eval.dat`,pin=identity(meta.binary,evalFile,{buildFile}),original=identity(`${repository}/.local-research/teacher/edax/bin/lEdax-x86-64-v3`,evalFile);
 mkdirSync(output,{recursive:true});if(existsSync(`${output}/results.json`)){console.log('Final engineering complete; no repeat');return;}
 const before=read(`${benchmark}/results.json`);if(before.status!=='complete')throw Error('Incomplete development input');const protocol={capMs:540000,queryCapMs:20000,fresh:64,exact:16,disclosed:154,repetitions:5,referenceSha256:sha(`${benchmark}/results.json`),source:sourceDigest(root),pin,original};const runIdentity=hash(protocol);atomic(`${output}/protocol.json`,{protocol,runIdentity});
 const reusable=reuseDirectory?read(`${reuseDirectory}/protocol.json`):null,reused={};if(reusable&&(hash(reusable.protocol.pin)!==hash(pin)||sourceDigest(`${reuseDirectory}/source`)!==reusable.protocol.source))throw Error('Engineering receipt reuse teacher/source mismatch');
 const unlock=writerLock(`${output}/writer.lock`),progress=new QualificationProgress(output),start=performance.now(),records={fresh:[],exact:[],regression:[],failure:[],horizonChecks:[]};let nativeCpu=0,maxRss=0;
 async function oracle(s,d,expected){
  return receipt(`${output}/tasks/${s.id}-horizon-d${d}.json`,{s,d,oracleSourceSha256:sha(`${root}/scripts/teacher/bound-horizon-oracle.c`)},runIdentity,async()=>{
   const binary=`${repository}/.local-research/edax-bound-20261028/horizon-oracle`,text=s.board.map(x=>x===1?'X':x===-1?'O':'-').join(''),t=performance.now();
   const r=spawnSync(binary,[evalFile,text,s.player===1?'X':'O',String(d)],{encoding:'utf8',timeout:25000});if(r.status!==0)throw Error(`Independent horizon oracle incomplete ${s.id} D${d}: ${r.stderr}`);const result=JSON.parse(r.stdout);
   if(hash(result.rows)!==hash(bare(expected)))throw Error(`Independent horizon disagreement ${s.id} D${d}`);
   return {state:s,depth:d,result,wallMs:performance.now()-t,sourceSha256:sha(`${root}/scripts/teacher/bound-horizon-oracle.c`),binarySha256:sha(binary)};
  });
 }
 async function label(s,d,variant='fixed',suffix=''){
  if(performance.now()-start>protocol.capMs)throw Error('Confirmation cap');return receipt(`${output}/tasks/${s.id}-d${d}-${variant}${suffix}.json`,{s,d,variant,suffix},runIdentity,async()=>{const name=`${s.id}-d${d}-${variant}${suffix}.json`,previous=reuseDirectory?`${reuseDirectory}/tasks/${name}`:null;if(previous&&existsSync(previous)){const old=read(previous);if(old.inputHash!==hash({input:old.input,runIdentity:reusable.runIdentity})||hash(old.input)!==hash({s,d,variant,suffix}))throw Error('Reused receipt input mismatch');reused[name]={path:resolve(previous),sha256:sha(previous),source:reusable.protocol.source,runIdentity:reusable.runIdentity};return old.result;}
   const path=`${output}/raw/${name}`,t=performance.now();progress.update({task:`${s.id} ${variant} D${d}`});let r;
   try{r=await alternatives(variant==='fixed'?pin:original,s,d,{measureNative:true,timeoutMs:protocol.queryCapMs,transcript:path});replay(s,r);}catch(e){if(!existsSync(path))throw e;const raw=read(path);if(raw.code!==0||raw.expired)throw e;r={rejected:true,error:e.message,native:raw.native,wallMs:performance.now()-t};}
   nativeCpu+=(r.native?.userSeconds??0)+(r.native?.systemSeconds??0);maxRss=Math.max(maxRss,r.native?.maxRssBytes??0);progress.update({durations:`last=${((performance.now()-t)/1000).toFixed(3)}s`,nativeCpuSeconds:nativeCpu,nativeMaxRssMiB:maxRss/2**20,checkpoint:new Date().toISOString()});return r;
  });
 }
 try{
  progress.set({stage:'fixed-development',task:'all roots; alternating original/fixed matched queries',total:64});
  for(const [i,row] of before.fresh.entries()){const s=row.state,labels={};for(const d of [10,12]){const pair={};for(const v of i%2?['fixed','original']:['original','fixed'])pair[v]=await label(s,d,v);if(pair.fixed.rejected||pair.original.rejected)throw Error(`Fresh query unresolved ${s.id} D${d}`);pair.changed=hash(bare(pair.fixed))!==hash(bare(pair.original));if(pair.changed)records.horizonChecks.push(await oracle(s,d,pair.fixed));labels[d]=pair;}records.fresh.push({state:s,labels});progress.update({completed:i+1});if((i+1)%8===0)progress.emit('fixed-batch');}
  progress.set({stage:'fixed-exact',task:'every independently solved alternative',total:16});
  for(const [i,row] of before.exact.entries()){const s=row.state,labels={};for(const d of [6,8,64-s.occupied]){labels[d]=await label(s,d);if(labels[d].rejected)throw Error('Rejected exact-development query');}if(hash(bare(labels[64-s.occupied]))!==hash(bare(row.independent.awarded)))throw Error('Independent exact mismatch');if(i<4)records.horizonChecks.push(await oracle(s,64-s.occupied,labels[64-s.occupied]));records.exact.push({state:s,independent:row.independent,labels});progress.update({completed:i+1});}
  progress.set({stage:'fixed-disclosed-regression',task:'all 154 completed V3 roots, both depths',total:154});
  for(const [i,row] of before.regression.entries()){const s=row.state,labels={};for(const d of [10,12]){const r=await label(s,d);if(r.rejected)throw Error(`Disclosed query unresolved ${s.id} D${d}`);r.changed=hash(bare(r))!==hash(row.labels[d].before);if(r.changed)records.horizonChecks.push(await oracle(s,d,r));labels[d]=r;}records.regression.push({state:s,labels});progress.update({completed:i+1});if((i+1)%16===0)progress.emit('fixed-regression-batch');}
  progress.set({stage:'failure-cost',task:'five original/fixed pairs; disclosed root only',total:5});const s={...read(`${root}/tests/fixtures/edax-bound.json`),id:'failure'};
  for(let i=0;i<5;i++){const pair={};for(const v of i%2?['fixed','original']:['original','fixed'])pair[v]=await label(s,12,v,`-${i}`);if(!pair.original.rejected||pair.fixed.rejected)throw Error('Disclosed failure disposition changed');records.failure.push(pair);progress.update({completed:i+1});}
  atomic(`${output}/results.json`,{status:'complete',passed:true,protocol,runIdentity,records,reused,allMatched:records.fresh.every(x=>Object.values(x.labels).every(p=>!p.changed))&&records.regression.every(x=>Object.values(x.labels).every(r=>!r.changed)),allValidated:true,elapsedMs:performance.now()-start,nativeCpuSeconds:nativeCpu,maxRssBytes:maxRss});
 }finally{progress.close();unlock();}
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1;});
