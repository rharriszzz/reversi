#!/usr/bin/env node
// V2 learning campaign. The coordinator owns time, decisions and durable work.
import { shortlist, budgetPlan } from './selection.mjs';
import { Progress, Profiler, compactEpoch, historyChunk } from './telemetry.mjs';
import { createHash } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { existsSync, mkdirSync, openSync, writeFileSync, fsyncSync, closeSync, unlinkSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { hostname, availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { atomic, read, sourceDigest, seedFor, instrumentIO } from '../research/io.mjs';
import { canonical } from '../research/core.mjs';
import { randomOpening, seededRandom } from '../../src/learning.js';
import { play, legalMoves as legalMovesForHistory } from '../../src/rules.js';
import { createModel, pack } from './model.mjs';
import { report } from './report.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export const VERSION='strong-evaluator-v3';
class Stop extends Error {}
const boot=()=>{try{return readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim();}catch{return null;}};
const identity=pid=>{try{return readFileSync(`/proc/${pid}/stat`,'utf8').split(') ')[1].split(' ')[19];}catch{return null;}};
export function historicalKeys(repository=root,previous=[]) {
  const keys=new Set();
  const visit=value=>{
    if(typeof value==='string'&&/^[012]{64}$/.test(value)) keys.add(value);
    else if(typeof value==='string'&&/^-?1:[01,\-]+$/.test(value)) {
      const [side,cells]=value.split(':'),board=cells.split(',').map(Number);
      if(board.length===64&&board.every(v=>[-1,0,1].includes(v))) keys.add(canonical(board,Number(side)));
    }
    else if(Array.isArray(value)) {
      if(value.length===8&&value.every(v=>typeof v==='string'&&/^[.BW]{8}$/.test(v))) visit(value.join('').split('').map(v=>v==='B'?1:v==='W'?-1:0));
      else if(value.length===64&&value.every(v=>v===0||v===1||v===-1)) {keys.add(canonical(value,1));keys.add(canonical(value,-1));}else for(const v of value) visit(v);
    }
    else if(value&&typeof value==='object') for(const v of Object.values(value)) visit(v);
  };
  for(const name of ['local-research-20261027.json','local-research-smoke.json','evaluator-comparison.json','strong-evaluator-pilot.json','strong-evaluator-20261028.json','next-evaluator-20261028.json','teacher-depth-qualification-20261028.json']) {
    const path=`${repository}/docs/data/${name}`;if(existsSync(path)) visit(read(path));
  }
  const fixture=`${repository}/tests/fixtures/positional.json`;if(existsSync(fixture)) visit(read(fixture));
  // The previous complete local trajectories improve exclusions beyond what
  // was published. Missing local files are recorded, never silently invented.
  let trajectories=0,missing=0;
  for(const dir of previous) {
    const manifest=`${resolve(dir)}/manifest.json`;if(!existsSync(manifest)) {missing++;continue;}
    const s=read(manifest);visit(s.usedKeys??[]);visit(s.openings??[]);
    const qualification=`${resolve(dir)}/tasks/reservation.json`;
    if(existsSync(qualification)){const receipt=read(qualification),roles=receipt.result?.roles??{};visit(roles);for(const roots of Object.values(roles))for(const root of roots){const path=`${resolve(dir)}/trajectories/${root.id}.json`;if(!existsSync(path)){missing++;continue;}visit(read(path));trajectories++;for(const move of legalMovesForHistory(root.board,root.player))visit([...play(root.board,root.player,move)]);}}
    if(existsSync(`${resolve(dir)}/development-keys.json`))visit(read(`${resolve(dir)}/development-keys.json`));
    for(const c of s.conditions??[])for(const p of c.pairs??[])if(existsSync(p))visit(read(p).result);
    if(existsSync(`${resolve(dir)}/historical-keys.json`)) visit(read(`${resolve(dir)}/historical-keys.json`).keys);
    for(const paths of Object.values(s.data??{})) for(const p of paths) if(existsSync(p)) {
      const shard=read(p);visit(shard);trajectories+=(shard.games??[]).length;
    } else missing++;
    for(const paths of Object.values(s.labels??{})) for(const p of paths) if(existsSync(p)) {
      const shard=read(p);visit(shard);
      for(const ref of shard.labels??[]) for(const row of ref.rows??[]) {
        const child=play(ref.board,ref.player,row.move);keys.add(canonical(child,1));keys.add(canonical(child,-1));
      }
    }
    for(const c of s.conditions??[]) for(const receipt of c.tasks??[]) {
      const p=s.tasks?.[receipt]?.path??receipt;if(typeof p!=='string'||!existsSync(p)) continue;
      const pair=read(p);visit(pair);
      if(pair.opening) for(const game of pair.games??[]) {
        let b=pair.opening.board;
        for(const step of game.moves??game.trajectory??[]) {
          if(step.move!==null) b=play(b,step.player,step.move);
          if(b.filter(Boolean).length>=20) {keys.add(canonical(b,1));keys.add(canonical(b,-1));}
        }
      }
    }
  }
  return {keys,audit:{historicalKeys:keys.size,localTrajectories:trajectories,missingLocalInputs:missing}};
}
export function reserve(seed,name,n,used) {
  const result=[],rng=seededRandom(seedFor(seed,name));
  for(let attempt=0;result.length<n&&attempt<n*1000;attempt++) {
    const p=randomOpening(rng,8);if(!p.player) continue;const key=canonical(p.board,p.player);
    if(used.has(key)) continue;used.add(key);result.push({board:[...p.board],player:p.player,key});
  }
  if(result.length!==n) throw new Error('Cannot reserve independent openings');return result;
}
export async function main(argv=process.argv.slice(2)) {
  const cli={};for(let i=0;i<argv.length;i++) {
    if(['--resume','--smoke','--pilot','--long-pattern'].includes(argv[i])) cli[argv[i].slice(2)]=true;
    else if(argv[i]==='--exclude-run') {if(!argv[i+1]||argv[i+1].startsWith('--')) throw new Error('Missing exclusion run');(cli.excludeRuns??=[]).push(resolve(argv[++i]));}
    else if(['--output','--hours','--seconds','--workers','--worker-cap','--seed','--repository','--continue-from'].includes(argv[i])) {if(!argv[i+1]||argv[i+1].startsWith('--')) throw new Error('Missing argument');cli[argv[i].slice(2)]=argv[++i];}
    else throw new Error(`Unknown argument ${argv[i]}`);
  }
  for(const k of ['hours','seconds','workers','seed']) if(cli[k]!==undefined&&(!Number.isFinite(Number(cli[k]))||Number(cli[k])<=0)) throw new Error(`Invalid ${k}`);
  if(cli.hours&&cli.seconds) throw new Error('Choose hours or seconds');
  if(cli.workers&&!Number.isInteger(Number(cli.workers))) throw new Error('Workers must be integral');
  const output=resolve(cli.output??'.local-research/strong-six-hour'),repository=resolve(cli.repository??root),statePath=`${output}/manifest.json`,lockPath=`${output}/run.lock`;
  if(output===root||['src','scripts','tests','.git'].some(d=>output.startsWith(`${root}/${d}`))) throw new Error('Output must be outside source directories');
  mkdirSync(output,{recursive:true});
  if(existsSync(lockPath)) {
    const lock=read(lockPath);let live=lock.host!==hostname();
    if(lock.host===hostname()&&(!lock.boot||lock.boot===boot())) {
      try {process.kill(lock.pid,0);live=!lock.identity||!identity(lock.pid)||lock.identity===identity(lock.pid);}catch(e){if(e.code!=='ESRCH') live=true;}
    }
    if(live) throw new Error(`Live research writer ${lock.pid}; refusing duplicate run`);
    unlinkSync(lockPath);
  }
  const fd=openSync(lockPath,'wx');try {writeFileSync(fd,JSON.stringify({pid:process.pid,host:hostname(),boot:boot(),identity:identity(process.pid)}));fsyncSync(fd);}finally{closeSync(fd);}
  let s,baseElapsed=0,baseCpu=0,started=performance.now(),stopping=false,timer,activeCategory=null,categoryLastWall=0,categoryLastCpu=0,workerLimit=1;
  const cpuStart=process.cpuUsage(),slots=[],profiler=new Profiler(),progress=new Progress(output);instrumentIO(profiler);
  const cpu=()=>{const c=process.cpuUsage(cpuStart);return baseCpu+(c.user+c.system)/1000;};
  const elapsed=()=>baseElapsed+performance.now()-started;
  const save=()=>{
    s.elapsedMs=elapsed();s.cpuMs=cpu();
    if(activeCategory) {
      s.allocation[activeCategory]??={wallMs:0,cpuMs:0};
      s.allocation[activeCategory].wallMs+=s.elapsedMs-categoryLastWall;s.allocation[activeCategory].cpuMs+=s.cpuMs-categoryLastCpu;
      categoryLastWall=s.elapsedMs;categoryLastCpu=s.cpuMs;
    }
    s.updated=new Date().toISOString();s.profile=profiler.snapshot();profiler.measure('manifest.atomic',()=>atomic(statePath,s));progress.update({stage:s.stage,positions:s.counts.positions,completed:s.workProgress?.completed??Object.keys(s.tasks).length,total:s.workProgress?.total,checkpoint:s.updated});
  };
  const refresh=()=>{progress.set({stage:s.stage,substage:'checkpoint',task:'stage checkpoint',note:'',epoch:'-',eta:'unknown until next operation',overallEta:s.budgetPlan?`planned end before ${(s.config.budgetMs-s.budgetPlan.safetyMs)/60000} active minutes; hard cap ${s.config.budgetMs/60000} min`:'unknown (pilot incomplete)'});save();profiler.measure('report.generate',()=>report(s,output));progress.emit('checkpoint');};
  const onStop=()=>{stopping=true;};process.on('SIGTERM',onStop);process.on('SIGINT',onStop);
  const guard=()=>{if(stopping||elapsed()>=s.config.budgetMs) throw new Stop(stopping?'signal received':'active budget exhausted');};
  async function terminateIdle() {for(const slot of slots) if(!slot.busy&&!slot.dead) {slot.dead=true;await slot.worker.terminate();}}
  async function job(id,payload,cap=60000) {
    if(s.tasks[id]?.status==='complete') return read(s.tasks[id].path);
    guard();let slot=slots.find(w=>!w.dead&&!w.busy);
    if(!slot) {if(slots.filter(w=>!w.dead).length>=workerLimit) throw new Error('Oversubscribed');slot={worker:new Worker(new URL('./worker.mjs',import.meta.url),{resourceLimits:{maxOldGenerationSizeMb:320}})};slots.push(slot);}
    slot.busy=true;const start=performance.now(),startedAt=new Date().toISOString(),startedMs=elapsed();
    s.inflight??={};s.inflight[id]={type:payload.type,at:new Date().toISOString()};save();progress.set({stage:s.stage,substage:payload.type,task:id,model:payload.model??payload.candidate??'-',batch:payload.batch??payload.index??'-',epoch:'-',processedPositions:0,note:payload.type==='fit'?'no new training positions expected until fitting finishes':'',activeTasks:Object.keys(s.inflight)});
    const response=await new Promise(resolve=>{
      let done=false,timeout;const finish=r=>{if(done)return;done=true;clearTimeout(timeout);slot.worker.off('message',message);slot.worker.off('error',error);slot.worker.off('exit',exit);resolve(r);};
      const message=r=>{if(r.id!==id)return;if(r.progress){const {positions,...fields}=r.progress;progress.update({...fields,processedPositions:positions,task:id,activeTasks:Object.keys(s.inflight)});return;}finish(r);};
      const error=e=>{slot.dead=true;finish({ok:false,error:e.stack??String(e)});};
      const exit=code=>{slot.dead=true;finish({ok:false,error:`Worker exited ${code}`});};
      slot.worker.on('message',message);slot.worker.on('error',error);slot.worker.on('exit',exit);
      timeout=setTimeout(()=>{slot.dead=true;slot.worker.terminate();finish({ok:false,error:'bounded task time cap',interrupted:elapsed()>=s.config.budgetMs||stopping});},Math.max(1,Math.min(['fit','generate'].includes(payload.type)?Infinity:cap,s.config.budgetMs-elapsed())));
      slot.worker.postMessage({id,job:payload});
    });
    slot.busy=false;delete s.inflight[id];
    if(response.interrupted) {save();throw new Stop('interrupted bounded task; retry on resume');}
    if(!response.ok) {progress.emit('failure',{task:id,error:response.error});s.failures.push({id,error:response.error});save();throw new Error(`${id}: ${response.error}`);}
    const result=response.result;result.profile=response.profile;
    if(result.model) {const path=`${output}/models/${id}.json`;atomic(path,result.model);result.modelPath=path;delete result.model;}
    const path=`${output}/tasks/${id}.json`;atomic(path,result);s.tasks[id]={path,status:'complete',startedAt,startedMs,wallMs:performance.now()-start,type:payload.type};save();progress.emit('completed',{task:id,taskWallMs:performance.now()-start,activeTasks:Object.keys(s.inflight)});return result;
  }
  async function category(name,fn) {
    if(activeCategory) throw new Error('Accounting categories must not overlap');
    activeCategory=name;categoryLastWall=elapsed();categoryLastCpu=cpu();
    try{return await fn();}finally{save();activeCategory=null;}
  }
  try {
    const digest=sourceDigest(root);
    if(cli.resume) {
      const loaded=read(statePath);if(loaded.version!==VERSION||loaded.source!==digest) throw new Error('Frozen source/protocol mismatch');
      s=loaded;baseElapsed=s.elapsedMs;baseCpu=s.cpuMs;started=performance.now();
      for(const k of ['workers','seed','hours','seconds']) if(cli[k]!==undefined) throw new Error('Resume uses saved configuration; longer research requires --continue-from in a new output');
      if(s.status==='complete') {console.log('Already complete; no new games started');return s;}
    } else {
      if(existsSync(statePath)) throw new Error('Existing run: use --resume');
      const previous=[`${repository}/.local-research/six-hour-20261027`,`${repository}/.local-research/strong-calibration-20261027`,...(cli['continue-from']?[resolve(cli['continue-from'])]:[]),...(cli.excludeRuns??[])].filter(dir=>existsSync(`${dir}/manifest.json`)&&resolve(dir)!==output);
      const smoke=!!cli.smoke,config={smoke,longPattern:!!cli['long-pattern'],pilot:!!cli.pilot,workers:Math.max(1,Math.min(8,Number(cli.workers??1),availableParallelism()-1||1)),seed:Number(cli.seed??(smoke?2026102781:cli.pilot?2026102793:2026102797)),budgetMs:cli.seconds?Number(cli.seconds)*1000:Number(cli.hours??6)*3600000,
        repository,previous,continueFrom:cli['continue-from']?resolve(cli['continue-from']):null};
      const git=spawnSync('git',['rev-parse','HEAD'],{cwd:repository,encoding:'utf8'});
      s={version:VERSION,source:digest,git:git.stdout?.trim(),config,status:'running',stage:'initialize',elapsedMs:0,cpuMs:0,updated:new Date().toISOString(),sessions:[],tasks:{},data:{train:[],development:[],'confirmation-quality':[]},labels:{train:[],development:[],'confirmation-quality':[]},models:{},best:{},cycle:0,history:[],conditions:[],allocation:{},counts:{trainGames:0,positions:0,exact:0,search:0,rejected:0},next:{train:0,development:0,'confirmation-quality':0},failures:[],acceptedTasks:{},appliedFits:{},inflight:{},
        protocol:{confirmationTargets:{80:64,300:32,20:8},statistic:'two-sided Hoeffding on independent bounded opening-pair means; Bonferroni over two primary controls, family alpha=.05',decision:'frozen single finalist; fixed n per primary budget, no optional stopping; B retained unless both completed lower bounds exceed .5; no automatic installation',leakage:'exclude entire trajectory on cross-split canonical collision after omitted randomized prefix; reject colliding tournament pairs without reading outcomes; replace from pre-reserved backup roots'}};
    }
    workerLimit=Math.min(s.config.workers,Number(cli['worker-cap']??s.config.workers));
    s.status='running';s.sessions.push({pid:process.pid,workers:workerLimit,at:new Date().toISOString()});save();
    const historicalPath=`${output}/historical-keys.json`;
    const historical=existsSync(historicalPath)?(()=>{const h=read(historicalPath);return {keys:new Set(h.keys),audit:h.audit};})():historicalKeys(repository,s.config.previous),used=historical.keys;
    if(!existsSync(historicalPath)) atomic(historicalPath,{keys:[...used],audit:historical.audit});
    s.exclusionAudit=historical.audit;
    if(s.config.continueFrom) {
      const prev=read(`${s.config.continueFrom}/manifest.json`);
      if(prev.status!=='complete'&&prev.status!=='stopped') throw new Error('Continuation source must be stopped or complete');
      // Exclude all old splits and tournaments; carry only training/development
      // data and labels in their original roles. Confirmation stays sealed out.
      for(const split of Object.keys(prev.data)) for(const p of prev.data[split]) for(const g of read(p).games) for(const st of g.states) used.add(st.key);
      if(!s.inherited) {
        for(const split of ['train','development']) {s.data[split]=[...prev.data[split]];s.labels[split]=[...prev.labels[split]];}
        s.models={...prev.models};s.best={...prev.best};s.fitCursor={...prev.fitCursor};s.labelCursor={...prev.labelCursor};s.modelSeen={...prev.modelSeen};s.policyPaths=prev.policyPaths;
        s.inherited=true;for(const k of ['trainGames','positions','exact','search']) s.counts[k]=prev.counts[k];save();
      }
    }
    if(!s.openings) {s.openings={selection:reserve(s.config.seed,'selection',s.config.smoke?16:128,used),confirmation:reserve(s.config.seed,'confirmation',s.config.smoke?16:2048,used)};save();}
    else for(const list of Object.values(s.openings)) for(const p of list) used.add(p.key);
    const roles=new Map([...used].map(k=>[k,'historical/reserved'])),dataKeys=new Set(used);
    for(const [split,paths] of Object.entries(s.data)) for(const p of paths) for(const g of read(p).games) {
      for(const st of [...g.states,...g.roots]) {used.add(st.key);dataKeys.add(st.key);roles.set(st.key,split);}
      for(const side of [1,-1]) {const k=canonical(g.terminal,side);used.add(k);dataKeys.add(k);roles.set(k,split);}
    }
    const labelKeys=ref=>[canonical(ref.board,ref.player),...ref.rows.map(r=>canonical(play(ref.board,ref.player,r.move),-ref.player))];
    for(const [split,paths] of Object.entries(s.labels)) for(const p of paths) for(const ref of read(p).labels) for(const k of labelKeys(ref)) {used.add(k);dataKeys.add(k);roles.set(k,split);}
    const selectionKeys=new Set();
    for(const c of s.conditions.filter(c=>c.stage!=='confirmation')) for(const path of c.tasks) for(const g of read(path).games) for(const key of g.keys??[]) selectionKeys.add(key);
    const smoke=s.config.smoke;
    const modelIds=[];
    for(const family of (s.config.longPattern?['long']:['linear','short','long','hybrid'])) for(const objective of (s.config.longPattern?['margin','rank']:['margin','outcome','rank'])) {
      const m=createModel(family,objective);modelIds.push(m.id);
      if(!s.models[m.id]) {const path=`${output}/models/initial-${m.id}.json`;atomic(path,pack(m));s.models[m.id]=path;}
    }
    for(const family of (s.config.longPattern?[]:['linear','short'])) {const m=createModel(family,'rank',6);modelIds.push(m.id);if(!s.models[m.id]) {const path=`${output}/models/initial-${m.id}.json`;atomic(path,pack(m));s.models[m.id]=path;}}
    save();timer=setInterval(save,45000);
    async function generateBatch(split,n=8,depth=1) {
      const index=s.next[split],id=`generate-${split}-${index}`,paths=[];
      // Index advances only together with admission. Retrying a completed but
      // unadmitted shard after a crash makes exactly the same admission decision.
      const partitions=Math.min(s.config.workers,n);
      const chunks=Array.from({length:partitions},(_,part)=>{const from=Math.floor(n*part/partitions),to=Math.floor(n*(part+1)/partitions);return {from,to,part};});
      const outcomes=[];for(let at=0;at<chunks.length;at+=workerLimit) outcomes.push(...await Promise.allSettled(chunks.slice(at,at+workerLimit).map(({from,to,part})=>job(`${id}-part-${part}`,{type:'generate',n:to-from,index:index+from,split,depth,seeds:Array.from({length:to-from},(_,k)=>seedFor(s.config.seed,split,index+from+k)),models:s.policyPaths?.map(read)??[]}))));
      const r={games:outcomes.flatMap(result=>{if(result.status!=='fulfilled')throw result.reason;return result.value.games;})};
      if(!s.acceptedTasks[id]) {
        const accepted=[];
        for(const g of r.games) {
          const keys=[...new Set([...g.states,...g.roots].map(st=>st.key).concat([canonical(g.terminal,1),canonical(g.terminal,-1)]))];
          if(keys.some(k=>used.has(k))) {s.counts.rejected++;continue;}
          keys.forEach(k=>{used.add(k);dataKeys.add(k);roles.set(k,split);});accepted.push(g);
          if(split==='train') {s.counts.trainGames++;s.counts.positions+=g.states.length;}
        }
        const path=`${output}/data/${id}.json`;atomic(path,{games:accepted});s.data[split].push(path);s.acceptedTasks[id]=true;s.next[split]+=n;save();
      }
      paths.push(`${output}/data/${id}.json`);return paths;
    }
    async function labelBatch(split,paths,id,options={}) {
      const settings={limit:smoke?2:8,exactLimit:smoke?2:4,depth:smoke?3:5,empties:8,exactMs:smoke?500:2000,...options};
      const parts=Math.min(s.config.workers,settings.exactLimit||1);
      const outcomes=[];for(let at=0;at<parts;at+=workerLimit) outcomes.push(...await Promise.allSettled(Array.from({length:parts},(_,part)=>({part})).slice(at,at+workerLimit).map(({part})=>job(`${id}-part-${part}`,{type:'label',paths,models:s.policyPaths??[],...settings,partition:{part,parts},limit:Math.ceil(settings.limit/parts),exactLimit:Math.ceil(settings.exactLimit/parts)},45000))));
      const r={labels:[],skipped:[]};for(const result of outcomes){if(result.status!=='fulfilled')throw result.reason;r.labels.push(...result.value.labels);r.skipped.push(...result.value.skipped);}
      const admittedPath=`${output}/labels/${id}.json`;
      if(!s.labels[split].includes(admittedPath)) {
        const admitted=r.labels.filter(ref=>!labelKeys(ref).some(k=>roles.has(k)&&roles.get(k)!==split));
        for(const ref of admitted) for(const k of labelKeys(ref)) {roles.set(k,split);used.add(k);dataKeys.add(k);}
        atomic(admittedPath,{labels:admitted,skipped:r.skipped,rejectedForLeakage:r.labels.length-admitted.length});
        s.labels[split].push(admittedPath);
        if(split==='train') {s.counts.exact+=admitted.filter(r=>r.kind==='exact').length;s.counts.search+=admitted.filter(r=>r.kind==='search').length;}
        save();
      }return r;
    }
    const devPaths=()=>s.data.development;
    async function trainRound(prefix,epochs=2) {
      const ids=smoke&&!s.config.longPattern?['linear-margin-p4','short-rank-p4','long-margin-p4','hybrid-rank-p4']:modelIds;
      s.fitCursor??={};s.labelCursor??={};
      s.workProgress={completed:0,total:ids.reduce((n,id)=>n+Math.ceil((s.data.train.length-(s.fitCursor[id]??0))/8),0)};
      const fitCosts=Object.values(s.tasks).filter(t=>t.type==='fit').slice(-64).map(t=>t.wallMs);
      while(ids.some(id=>(s.fitCursor[id]??0)<s.data.train.length)) {
      if(s.stage==='learning'&&elapsed()>=s.learningEnd) break;
      for(let i=0;i<ids.length;i+=workerLimit) {
        const batch=ids.slice(i,i+workerLimit).filter(id=>(s.fitCursor[id]??0)<s.data.train.length);
        const jobs=batch.map(id=>{
          const from=s.fitCursor[id]??0,to=Math.min(s.data.train.length,from+8),newPaths=s.data.train.slice(from,to),old=s.data.train.slice(0,from),rng=seededRandom(seedFor(s.config.seed,`${prefix}-${id}`,from));
          const replay=old.length?Array.from(new Set(Array.from({length:Math.min(4,old.length)},()=>old[Math.floor(rng()*old.length)]))):[];
          const labelFrom=s.labelCursor[id]??0,labelTo=Math.min(s.labels.train.length,labelFrom+8),newLabels=s.labels.train.slice(labelFrom,labelTo);
          const newPositions=newPaths.reduce((sum,p)=>sum+read(p).games.reduce((a,g)=>a+Math.ceil(g.states.length/2),0),0);
          return {id,from,to,labelTo,newPositions,taskId:`${prefix}-${id}-${from}`,payload:{type:'fit',batch:`${Math.floor(from/8)+1}/${Math.ceil(s.data.train.length/8)}`,model:s.models[id],paths:[...newPaths,...replay],countPaths:newPaths,development:devPaths(),developmentLabels:s.labels.development,labels:newLabels,countLabels:newLabels,epochs,seed:seedFor(s.config.seed,`${prefix}-${id}`,from)}};
        });
        const outcomes=await Promise.allSettled(jobs.map(j=>job(j.taskId,j.payload,60000)));
        for(let k=0;k<outcomes.length;k++) {
          const result=outcomes[k];if(result.status!=='fulfilled') throw result.reason;
          const {id,taskId,to,labelTo,newPositions}=jobs[k],r=result.value;
          if(s.appliedFits[taskId]) continue;
          s.models[id]=r.modelPath;const last=r.loss??r.curve.at(-1);
          s.modelSeen??={};s.modelSeen[id]=(s.modelSeen[id]??0)+newPositions;
          s.historyChunks??={};s.historyChunks[taskId]=historyChunk(output,taskId,r.curve);
          for(const row of r.curve.slice(-1)) s.history.push(compactEpoch({id,...row,totalPositions:s.modelSeen[id],generatedPositions:s.counts.positions,totalCpuMs:cpu()}));
          s.history=s.history.slice(-1024);
          const quality=r.quality?.exact.regret;
          if(last&&(!s.best[id]||(Number.isFinite(quality)?quality<(s.best[id].regret??Infinity)||(quality===s.best[id].regret&&last.mse<s.best[id].mse):last.mse<s.best[id].mse))) s.best[id]={path:r.modelPath,mse:last.mse,regret:quality,positions:s.counts.positions};
          s.fitCursor[id]=to;s.labelCursor[id]=labelTo;s.appliedFits[taskId]=true;s.workProgress.completed++;
          const left=s.workProgress.total-s.workProgress.completed,width=Math.min(workerLimit,ids.length);
          if(fitCosts.length)progress.update({eta:`${(Math.min(...fitCosts)*left/width/60000).toFixed(1)}..${(Math.max(...fitCosts)*left*1.35/width/60000).toFixed(1)} min; observed fit range +35%`});
          save();
        }
      }
      }
      delete s.workProgress;
    }
    async function assess(id,split='development',models=null,deep=false) {
      await terminateIdle();
      const calibrationPaths=[...new Set([...s.data.train.slice(0,8),...s.data.train.slice(-8)])];
      const r=await job(id,{type:'assess',models:models??['B',...modelIds.filter(id=>s.best[id]).map(id=>s.best[id].path)],paths:s.data[split],labels:s.labels[split],calibrationPaths,deep,calls:smoke?300:3000},120000);
      if(split==='development') {
        s.latestAssessment=r.metrics;
        for(const m of r.metrics) {const row=[...s.history].reverse().find(r=>r.id===m.id);if(row) row.ranking={depth:m.ranking.depth,exact:m.ranking.exact,search:m.ranking.search};}
        // Pareto screening rewards actual move decisions and cost separately.
        s.selectionAudit=shortlist(r.metrics,{limit:s.config.longPattern?2:4});
        s.screening=s.selectionAudit.ids;s.policyPaths=s.screening.slice(0,2).map(id=>s.best[id].path);save();
      }
      return r;
    }
    if(s.stage==='initialize') {
      s.stage='pilot';save();
    }
    if(s.stage==='pilot') {
      const start=performance.now();
      await category('calibration',async()=>{
        if(!s.inherited) for(let i=0;i<(smoke?1:s.config.pilot?4:32);i++) await generateBatch('development',8,1+i%2);
        if(!s.labels.development.length) await labelBatch('development',devPaths(),'development-labels',{limit:smoke?3:s.config.pilot?32:64,exactLimit:smoke?3:s.config.pilot?24:64});
        const measurements=[];
        for(const depth of smoke?[1]:[1,2,3]) {const t=performance.now(),p=await generateBatch('train',8,depth);measurements.push({depth,games:8,wallMs:performance.now()-t,paths:p});}
        await labelBatch('train',s.data.train,'pilot-train-labels');
        await trainRound('pilot-fit',1);await assess('pilot-assess');
        s.pilot={generation:measurements,labelWork:read(`${output}/labels/pilot-train-labels.json`).labels.map(l=>({kind:l.kind,nodes:l.nodes,wallMs:l.wallMs})),fitTasks:Object.entries(s.tasks).filter(([id])=>id.startsWith('pilot-fit')).map(([id,t])=>({id,wallMs:t.wallMs})),elapsedMs:performance.now()-start};
        const pairTimings={};
        for(const timeMs of smoke?[1]:[20,80,300]) {
          pairTimings[timeMs]=[];for(let repeat=0;repeat<(smoke?1:3);repeat++){const t=performance.now();await terminateIdle();await job(`pilot-pair-${timeMs}-${repeat}`,{type:'pair',candidate:s.policyPaths[0],opponent:'B',opening:s.openings.selection[repeat],index:repeat,budget:{timeMs}},60000);pairTimings[timeMs].push(performance.now()-t);}
        }
        s.pilot.pairTimings=pairTimings;
        if(!smoke&&!s.config.pilot) s.budgetPlan=budgetPlan(s.config.budgetMs,elapsed(),pairTimings,{targets:s.protocol.confirmationTargets});
        s.learningEnd=smoke?Math.min(s.config.budgetMs*.50,elapsed()+3000):s.config.pilot?s.config.budgetMs*.50:s.budgetPlan.learningEnd;
        const perGame=measurements[0].wallMs/8;s.pilot.estimatedPositionsPerHour=44*3600000/perGame;
        s.pilot.batchGames=Math.min(64,Math.max(8,8*Math.floor(10000/Math.max(1,perGame)/8)));
      });s.stage='learning';refresh();
    }
    while(s.stage==='learning'&&elapsed()<s.learningEnd) {
      const cycle=s.cycle,cycleStart=elapsed(),cycleEnd=Math.min(s.learningEnd,cycleStart+(smoke?500:s.config.pilot?20000:300000));
      s.cycleProgress??={dataEnd:cycleStart+(cycleEnd-cycleStart)*0.60};const progress=s.cycleProgress;
      await category('data-and-labels',async()=>{
        const dataEnd=progress.dataEnd;
        do {
          guard();const paths=await generateBatch('train',smoke?4:8,1+((s.next.train/8)%5===0?1:0));
          const labelId=`cycle-${cycle}-labels-${s.next.train}`;
          await labelBatch('train',paths,labelId,{depth:smoke?3:5+cycle%2,empties:smoke?8:[8,8,10,12][cycle%4],exactLimit:smoke?1:4});
        } while(!smoke&&elapsed()<dataEnd);
      });
      if(elapsed()>=s.learningEnd) break;
      await category('fitting',()=>trainRound(`cycle-${cycle}-fit`,smoke?1:12));
      await category('model-comparison',()=>assess(`cycle-${cycle}-assess`));
      // Each early-converged round returns to NEW data and stronger labels,
      // rather than extra epochs or enlarged tournaments.
      s.cycle++;delete s.cycleProgress;refresh();
      if(smoke) break;
    }
    if(s.stage==='learning') {s.stage='selection';refresh();}
    function condition(stage,id,budget,target) {
      const name=`${stage}-${id}-${budget.timeMs?`t${budget.timeMs}`:`d${budget.depth}`}`;
      let c=s.conditions.find(c=>c.id===name);if(!c) {c={id:name,stage,candidateId:id,candidate:s.best[id].path,budget,target,tasks:[],attempts:0,rejected:0};s.conditions.push(c);save();}return c;
    }
    async function tournament(conditions) {
      await terminateIdle();
      const max=Math.max(...conditions.map(c=>c.target));
      for(let i=0;i<max;i++) for(const c of conditions) {
        if(c.tasks.length>i||i>=c.target) continue;
        while(c.tasks.length<=i) {
          guard();if(c.stage==='confirmation'&&createHash('sha256').update(readFileSync(c.candidate)).digest('hex')!==s.freeze.sha256) throw new Error('Frozen finalist changed');
          const roots=s.openings[c.stage==='confirmation'?'confirmation':'selection'],opening=roots[c.attempts];if(!opening) throw new Error('Reserved backup roots exhausted');
          const id=`pair-${c.id}-${c.attempts}`,r=await job(id,{type:'pair',candidate:c.candidate,opponent:'B',opening,index:i,budget:c.budget},Math.max(30000,(c.budget.timeMs??10)*160));
          // Canonical leakage filter never examines points or outcomes.
          const collision=r.games.some(g=>(g.keys??[]).some(k=>dataKeys.has(k)||(c.stage==='confirmation'&&selectionKeys.has(k))));
          c.attempts++;
          if(collision) {c.rejected++;save();continue;}
          c.tasks.push(s.tasks[id].path);
          if(c.stage!=='confirmation') for(const g of r.games) for(const k of g.keys??[]) selectionKeys.add(k);
          save();break;
        }
        refresh();
      }
    }
    if(s.stage==='selection') {
      const shortlist=(s.screening??[]).slice(0,smoke?1:4);if(!shortlist.length) throw new Error('No fitted challenger');
      const preliminary=shortlist.map(id=>condition('preliminary',id,{depth:2},smoke||s.config.pilot?1:4));await category('selection',()=>tournament(preliminary));
      const serious=shortlist.flatMap(id=>(smoke?[1]:[80,300,20]).map(timeMs=>condition('selection',id,{timeMs},smoke||s.config.pilot?1:4)));await category('selection',()=>tournament(serious));
      const score=id=>{const cs=serious.filter(c=>c.candidateId===id);return cs.reduce((a,c)=>a+c.tasks.reduce((sum,p)=>sum+read(p).point,0)/c.target,0)/cs.length;};
      shortlist.sort((a,b)=>score(b)-score(a)||a.localeCompare(b));
      s.freeze={id:shortlist[0],path:s.best[shortlist[0]].path,sha256:createHash('sha256').update(readFileSync(s.best[shortlist[0]].path)).digest('hex'),at:new Date().toISOString(),elapsedMs:elapsed(),targets:smoke?{1:1}:s.config.pilot?{80:2,300:1,20:1}:s.budgetPlan.targets,rule:s.protocol};
      atomic(`${output}/selection-freeze.json`,s.freeze);s.stage='confirmation';refresh();
    }
    if(s.stage==='confirmation') {
      await category('independent-assessment',async()=>{
        while(s.data['confirmation-quality'].reduce((n,p)=>n+read(p).games.length,0)<(smoke?1:48)) {if(s.next['confirmation-quality']>=(smoke?128:2048))throw new Error('Cannot reach accepted independent quality target');await generateBatch('confirmation-quality',8,2);}
        if(!s.labels['confirmation-quality'].length) await labelBatch('confirmation-quality',s.data['confirmation-quality'],'confirmation-labels',{limit:smoke?3:32,exactLimit:smoke?3:48,empties:8,depth:smoke?3:6});
        const r=await assess('confirmation-assess','confirmation-quality',['B',s.freeze.path],true);s.confirmationAssessment=r;atomic(`${output}/confirmation-assessment.json`,r);
        const d=await job('diagnostic-positions',{type:'diagnostics',model:s.freeze.path,labels:s.labels['confirmation-quality']},60000);atomic(`${output}/diagnostics.json`,d);
      });
      const cs=(smoke?[1]:[80,300,20]).map(timeMs=>condition('confirmation',s.freeze.id,{timeMs},s.freeze.targets[timeMs]));
      await category('confirmation-games',()=>tournament(cs));s.stage='done';s.status='complete';refresh();
    }
  } catch(e) {
    if(!s) throw e;
    s.status=e instanceof Stop?'stopped':'failed';s.stoppingReason=e.message;refresh();if(!(e instanceof Stop)) throw e;
  } finally {
    clearInterval(timer);progress.close();instrumentIO(null);profiler.close();process.off('SIGTERM',onStop);process.off('SIGINT',onStop);await Promise.allSettled(slots.map(s=>s.worker.terminate()));
    if(existsSync(lockPath)) unlinkSync(lockPath);
  }
  console.log(`[strong] ${s.status}; ${output}/report.md`);return s;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(e=>{console.error(e.stack??String(e));process.exitCode=1;});
