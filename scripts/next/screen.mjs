#!/usr/bin/env node
// A bounded DEVELOPMENT screen. No model updates and no strength promotion.
import { existsSync, mkdirSync, copyFileSync, readFileSync, openSync, closeSync, unlinkSync, writeFileSync, fsyncSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hostname } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Pool } from './pool.mjs';
import { Progress, Profiler } from '../strong/telemetry.mjs';
import { historicalKeys, reserve } from '../strong/run.mjs';
import { canonical } from '../research/core.mjs';
import { read, atomic, sourceDigest, instrumentIO } from '../research/io.mjs';
import { interval } from '../strong/report.mjs';
import { play } from '../../src/rules.js';
const args=Object.fromEntries(process.argv.slice(2).map((v,i,a)=>v.startsWith('--')?[v.slice(2),a[i+1]?.startsWith('--')?true:a[i+1]??true]:null).filter(Boolean));
const output=resolve(args.output??'.local-research/next-screen'),repository=resolve(args.repository??'.'),previous=resolve(args.previous??`${repository}/.local-research/strong-six-hour-20261027`),smoke=!!args.smoke;
const sourceRoot=resolve(fileURLToPath(new URL('../..',import.meta.url)));
if([repository,sourceRoot].some(root=>output===root||['src','scripts','tests','.git'].some(d=>output.startsWith(`${root}/${d}`))))throw new Error('Output must be outside source directories');
mkdirSync(output,{recursive:true});
const preflight=smoke?{blockers:[],at:new Date().toISOString()}:read(args.preflight??`${repository}/.local-research/next-resource-check/preflight.json`);
if(!smoke&&(preflight.blockers.length||Date.now()-Date.parse(preflight.at)>600000))throw new Error('Fresh successful preflight required');
const lock=`${output}/screen.lock`;
const boot=()=>{try{return readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim();}catch{return null;}};
const identity=pid=>{try{return readFileSync(`/proc/${pid}/stat`,'utf8').split(') ')[1].split(' ')[19];}catch{return null;}};
if(existsSync(lock)){
 const raw=read(lock),saved=typeof raw==='number'?{pid:raw}:raw;let live=!!saved.host&&saved.host!==hostname();
 if(!live&&(!saved.boot||saved.boot===boot()))try{process.kill(saved.pid,0);live=!saved.identity||!identity(saved.pid)||saved.identity===identity(saved.pid);}catch(e){if(e.code!=='ESRCH')live=true;}
 if(live)throw new Error(`Live screen ${saved.pid}`);unlinkSync(lock);
}
const fd=openSync(lock,'wx');try{writeFileSync(fd,JSON.stringify({pid:process.pid,host:hostname(),boot:boot(),identity:identity(process.pid)}));fsyncSync(fd);}finally{closeSync(fd);}
const profile=new Profiler();instrumentIO(profile);const progress=new Progress(output),start=performance.now();let pool,timer;
const digest=sourceDigest(sourceRoot);
let s;
try {
 if(existsSync(`${output}/manifest.json`)){s=read(`${output}/manifest.json`);if(s.source!==digest)throw new Error('Frozen source mismatch');if(s.status==='complete'){console.log('already complete');process.exitCode=0;} }
 else {
  const old=read(`${previous}/manifest.json`),ids=['long-margin-p4','long-rank-p4'];
  const models=ids.map(id=>{const path=`${output}/${id}.json`;copyFileSync(old.best[id].path,path);return {id,path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex'),original:old.best[id]};});
  s={version:'frozen-long-screen-v1',source:digest,seed:2026102819,status:'running',elapsedMs:0,models,trainingCalibrationPaths:(old.data?.train??[]).slice(0,8),conditions:ids.flatMap(id=>[{timeMs:80},{timeMs:300},{depth:4}].map(budget=>({id:`${id}-${budget.timeMs??'d4'}`,model:id,budget,target:smoke?1:budget.depth?8:32,pairs:[],attempts:0,rejected:0}))),capMs:smoke?120000:2700000,protocol:'Development only. Fixed targets, 45-minute active cap; incomplete rows descriptive. Paired colors, serial games. Exclude complete previous run trajectories and all disclosed historical keys. No retraining. No outcome-based sample adaptation.',at:new Date().toISOString()};
  atomic(`${output}/manifest.json`,s);
 }
 s.pid=process.pid;s.config={budgetMs:s.capMs};
 for(const m of s.models)if(createHash('sha256').update(readFileSync(m.path)).digest('hex')!==m.sha256)throw new Error('Frozen model mismatch');
 const base=s.elapsedMs??0,elapsed=()=>base+performance.now()-start;
 const save=()=>{s.elapsedMs=elapsed();s.checkpoint=new Date().toISOString();s.updated=s.checkpoint;s.profile=profile.snapshot();atomic(`${output}/manifest.json`,s);progress.update({positions:s.positions??0,completed:s.conditions.reduce((n,c)=>n+c.pairs.length,0),total:s.conditions.reduce((n,c)=>n+c.target,0),checkpoint:s.checkpoint});};
 timer=setInterval(save,45000);
 if(s.status==='complete') {clearInterval(timer);progress.close();instrumentIO(null);profile.close();unlinkSync(lock);process.exit(0);}
 save();
 const exclusionPath=`${output}/exclusions.json`;
 progress.set({stage:'initialize',substage:'exclusions',task:'load previous trajectories and labels',note:'reading historical positions; no new training data expected'});
 let used;
 if(existsSync(exclusionPath))used=new Set(read(exclusionPath).keys);
 else{const h=historicalKeys(repository,smoke?[]:[previous,`${repository}/.local-research/six-hour-20261027`]);used=h.keys;s.exclusionAudit=h.audit;atomic(exclusionPath,{keys:[...used]});}
 if(!s.openings){s.openings=reserve(s.seed,'next-development',smoke?32:2048,used);save();}
 for(const opening of s.openings)used.add(opening.key);
 // New diagnostics are all development, with distinct roots from game screen.
 pool=new Pool(1,output,progress);pool.trackTasks=false;progress.update({stage:'development-quality'});
 if(!s.quality){
  const r=await pool.run('fresh-development-games',{type:'generate',split:'next-development',n:smoke?4:64,index:0,depth:1,seeds:Array.from({length:smoke?4:64},(_,i)=>s.seed+100000+i),models:s.models.map(m=>read(m.path))});
  const gameKeys=g=>[...g.states,...g.roots].map(st=>st.key).concat([canonical(g.terminal,1),canonical(g.terminal,-1)]);
  const games=r.games.filter(g=>!gameKeys(g).some(key=>used.has(key)));
  const paths=[`${output}/development.json`];atomic(paths[0],{games});s.positions=games.reduce((n,g)=>n+g.states.length,0);
  const refs=await pool.run('fresh-development-labels',{type:'label',paths,limit:smoke?2:48,exactLimit:smoke?2:64,depth:smoke?3:5,empties:8,exactMs:2000,models:s.models.map(m=>m.path)});
  const labels=[`${output}/labels.json`];atomic(labels[0],{labels:refs.labels});
  for(const g of games)for(const key of gameKeys(g))used.add(key);
  for(const ref of refs.labels){used.add(canonical(ref.board,ref.player));for(const row of ref.rows)used.add(canonical(play(ref.board,ref.player,row.move),-ref.player));}
  atomic(`${output}/development-keys.json`,{keys:games.flatMap(gameKeys).concat(refs.labels.flatMap(ref=>[canonical(ref.board,ref.player),...ref.rows.map(row=>canonical(play(ref.board,ref.player,row.move),-ref.player))]))});
  s.quality=await pool.run('fresh-quality-assessment',{type:'assess',paths,labels,models:['B',...s.models.map(m=>m.path)],calibrationPaths:s.trainingCalibrationPaths??[],deep:true,calls:smoke?300:30000});s.quality.games=games.length;s.quality.labels=refs.labels.length;s.quality.skipped=refs.skipped;save();
 }else for(const key of read(`${output}/development-keys.json`).keys)used.add(key);
 progress.update({stage:'development-games'});
 let stop=false;
 for(let round=0;round<Math.max(...s.conditions.map(c=>c.target));round++) {
  // Alternate candidate/control order across rounds; all searches are serial.
  const conditions=round%2?[...s.conditions].reverse():s.conditions;
  for(const c of conditions){if(c.pairs.length>round||round>=c.target)continue;
   while(c.pairs.length<=round){
    const remaining=s.capMs-elapsed(),estimated=c.budget.timeMs?c.budget.timeMs*140:3000;
    if(remaining<estimated+30000){stop=true;break;}
    const opening=s.openings[c.attempts];if(!opening)throw new Error('opening backup exhaustion');
    const id=`pair-${c.id}-${c.attempts}`,model=s.models.find(m=>m.id===c.model);
    const result=await pool.run(id,{type:'pair',candidate:model.path,opponent:'B',opening,index:round,budget:smoke&&c.budget.timeMs?{timeMs:2}:c.budget},{timeoutMs:Math.min(remaining-10000,120000),progressFields:{eta:c.pairMs?.length?`${((c.target-c.pairs.length)*Math.min(...c.pairMs)/60000).toFixed(1)}..${((c.target-c.pairs.length)*Math.max(...c.pairMs)*1.35/60000).toFixed(1)} min for this condition; empirical range +35%`:'unknown (no completed pair at this condition)',overallEta:`cap remaining ${(remaining/60000).toFixed(1)} min; completion uncertain`}});
    c.attempts++;if(result.games.some(g=>g.keys.some(key=>used.has(key)))){c.rejected++;save();continue;}
    c.pairs.push(`${output}/tasks/${id}.json`);c.pairMs??=[];c.pairMs.push(read(`${output}/tasks/${id}.json`).wallMs);save();
    const costs=c.pairMs,lo=Math.min(...costs),hi=Math.max(...costs),left=c.target-c.pairs.length;
    progress.update({eta:`${(left*lo/60000).toFixed(1)}..${(left*hi*1.35/60000).toFixed(1)} min for condition; empirical range +35%`,overallEta:`cap remaining ${((s.capMs-elapsed())/60000).toFixed(1)} min; completion uncertain`});break;
   }if(stop)break;
  }if(stop)break;
 }
 s.summary=s.conditions.map(c=>{const pairs=c.pairs.map(p=>read(p).result),moves=side=>pairs.flatMap(p=>p.games.flatMap(g=>g.stats[side==='candidate'?(g.candidateColor===1?'black':'white'):(g.candidateColor===1?'white':'black')]));
 const stats=rows=>{const hist={};for(const r of rows)hist[r.depth]=(hist[r.depth]??0)+1;const sorted=rows.map(r=>r.depth).sort((a,b)=>a-b),wallMs=rows.reduce((n,r)=>n+r.wallMs,0),nodes=rows.reduce((n,r)=>n+r.nodes,0),evaluations=rows.reduce((n,r)=>n+r.evaluations,0);return {moves:rows.length,depthHistogram:hist,medianDepth:sorted[Math.floor(sorted.length/2)],nodes,evaluations,wallMs,nodesPerSecond:nodes*1000/wallMs,evaluationsPerSecond:evaluations*1000/wallMs,maxOverrunMs:Math.max(0,...rows.map(r=>r.overrunMs)),fallbacks:rows.filter(r=>r.fallback).length};};
 const outcomes=pairs.flatMap(p=>p.games.map(g=>g.outcome));return {...c,summary:interval(pairs.map(p=>p.point),{comparisons:4}),wins:outcomes.filter(v=>v>0).length,draws:outcomes.filter(v=>v===0).length,losses:outcomes.filter(v=>v<0).length,candidate:stats(moves('candidate')),baseline:stats(moves('baseline'))};});
 s.status=s.conditions.every(c=>c.pairs.length===c.target)?'complete':'capped';save();atomic(`${output}/results.json`,s);
 console.log(`Development screen ${s.status}; ${(s.elapsedMs/60000).toFixed(1)} minutes; B retained.`);
}finally{clearInterval(timer);await pool?.close();progress.close();profile.close();instrumentIO(null);if(existsSync(lock))unlinkSync(lock);}
