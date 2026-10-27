#!/usr/bin/env node
// A local program owns all experiment decisions after launch.
import { Worker } from 'node:worker_threads';
import { availableParallelism, cpus, hostname, platform, arch, release } from 'node:os';
import { existsSync, openSync, closeSync, unlinkSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { atomic, read, sourceDigest, seedFor } from './research/io.mjs';
import { candidates, makeModel, canonical, shortlist, VERSION } from './research/core.mjs';
import { report, summarizePairs } from './research/report.mjs';
import { randomOpening, seededRandom } from '../src/learning.js';
import { openingSet } from './evaluate.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function parseArgs(args) {
  const options={};
  for(let i=0;i<args.length;i++) {
    const arg=args[i];
    if(arg==='--resume') options.resume=true;
    else if(['--mode','--hours','--seconds','--workers','--output','--seed'].includes(arg)) {
      if(!args[i+1]||args[i+1].startsWith('--')) throw new Error(`Missing ${arg} value`);
      options[arg.slice(2)]=args[++i];
    } else throw new Error(`Unknown argument ${arg}`);
  }
  if(options.hours!==undefined&&options.seconds!==undefined) throw new Error('Choose hours or seconds');
  for(const name of ['hours','seconds','workers','seed']) if(options[name]!==undefined&&(!Number.isFinite(Number(options[name]))||Number(options[name])<=0)) throw new Error(`Invalid ${name}`);
  if(options.workers!==undefined&&!Number.isInteger(Number(options.workers))) throw new Error('Workers must be an integer');
  if(options.seed!==undefined&&(!Number.isSafeInteger(Number(options.seed))||Number(options.seed)>0xffffffff)) throw new Error('Seed must be 1..4294967295');
  if(options.mode!==undefined&&!['smoke','full'].includes(options.mode)) throw new Error('Mode must be smoke or full');
  return options;
}
class Stop extends Error {}
function historicalKeys() {
  const keys=new Set(),old=new Set();
  const publishedSmoke=`${root}/docs/data/local-research-smoke.json`;
  if(existsSync(publishedSmoke)) for(const key of read(publishedSmoke).publishedKeys) keys.add(key);
  // Exclude all disclosed old opening roots and exact positions available in Git.
  for(const [seed,n] of [[20261026,16],[734917,16],[14659013,16],[14659117,16],[14659991,32],[14661007,6],[31027103,16],[31028033,32]])
    for(const p of openingSet(seed,n,old)) keys.add(canonical(p.board,p.player));
  const evidence=read(`${root}/docs/data/evaluator-comparison.json`);
  for(const key of [...evidence.reservedFinalGameKeys,...evidence.reservedFinalQualityKeys]) {
    const [side,cells]=key.split(':');keys.add(canonical(cells.split(',').map(Number),Number(side)));
  }
  for(const seed of [730000,730003]) {const p=randomOpening(seededRandom(seed),54);if(p.player) keys.add(canonical(p.board,p.player));}
  const rng=seededRandom(14664007);let count=0;
  while(count<32) {
    const p=randomOpening(seededRandom(Math.floor(rng()*0x7fffffff)),54);
    if(p.player===null||p.board.filter(v=>!v).length!==6) continue;
    keys.add(canonical(p.board,p.player));count++;
  }
  const development=seededRandom(31027011);count=0;
  while(count<64) {const p=randomOpening(seededRandom(Math.floor(development()*0x7fffffff)),54);if(!p.player||p.board.filter(v=>!v).length!==6) continue;keys.add(canonical(p.board,p.player));count++;}
  return keys;
}
function reserveOpenings(seed,name,count,used) {
  const rng=seededRandom(seedFor(seed,name)),result=[];
  for(let attempt=0;result.length<count&&attempt<100000;attempt++) {
    const p=randomOpening(rng,8);if(!p.player) continue;
    const key=canonical(p.board,p.player);if(used.has(key)) continue;used.add(key);
    result.push({board:[...p.board],player:p.player,key});
  }
  if(result.length!==count) throw new Error('Cannot reserve distinct openings');
  return result;
}
export async function main(args=process.argv.slice(2)) {
  const cli=parseArgs(args),output=resolve(cli.output??`${root}/.local-research/${cli.mode??'full'}`);
  if(output===root||['src','scripts','tests','.git'].some(dir=>output===`${root}/${dir}`||output.startsWith(`${root}/${dir}/`))) throw new Error('Choose a dedicated research output directory outside source/control directories');
  mkdirSync(output,{recursive:true});
  const lockPath=`${output}/run.lock`,manifestPath=`${output}/manifest.json`;
  if(existsSync(lockPath)) {
    const lock=read(lockPath);let live=true;
    if(lock.host===hostname()) {try {process.kill(lock.pid,0);} catch(error) {if(error.code==='ESRCH') live=false;}}
    if(live) throw new Error(`Run locked by PID ${lock.pid} on ${lock.host}; no second writer started`);
    unlinkSync(lockPath);
  }
  const lock=openSync(lockPath,'wx');closeSync(lock);atomic(lockPath,{pid:process.pid,host:hostname(),at:new Date().toISOString()});
  let state,timer,reportTimer,baseElapsed=0,start=performance.now(),stopping=false;
  const sessionCpu=process.cpuUsage();let baseCpu=0;
  const pool=[];
  try {
    if(cli.resume) {
      if(!existsSync(manifestPath)) throw new Error('No manifest to resume');const loaded=read(manifestPath);
      if(loaded.version!==VERSION||loaded.source!==sourceDigest(root)) throw new Error('Source/protocol changed; resume refused. Use the original checkout or a new output directory');
      for(const name of ['mode','seed','workers']) if(cli[name]!==undefined&&String(cli[name])!==String(loaded.config[name])) throw new Error(`Resume cannot change ${name}`);
      state=loaded;
      if(cli.hours!==undefined||cli.seconds!==undefined) state.config.budgetMs=cli.hours!==undefined?Number(cli.hours)*3600000:Number(cli.seconds)*1000;
      baseElapsed=state.elapsedMs;state.sessions.push({at:new Date().toISOString(),pid:process.pid});
      baseCpu=state.cpuMs;
      if(state.stageEnds) state.stageEnds={data:state.config.budgetMs*(state.config.mode==='smoke'?0.27:0.20),training:state.config.budgetMs*(state.config.mode==='smoke'?0.50:0.66),selection:state.config.budgetMs*(state.config.mode==='smoke'?0.68:0.79)};
      state.status='running';state.stoppingReason=null;
    } else {
      if(existsSync(manifestPath)) throw new Error('Output already contains a run; use --resume or a new output directory');
      if(readdirSync(output).some(name=>!['run.lock','launcher.log'].includes(name))) throw new Error('New runs require an empty output directory (launcher.log is allowed)');
      atomic(`${output}/.gitignore`,'*\n');
      const mode=cli.mode??'full',workers=Math.min(4,Math.max(1,(availableParallelism?.()??cpus().length)-1),Number(cli.workers??2));
      const config={mode,workers,requestedWorkers:Number(cli.workers??2),seed:Number(cli.seed??(mode==='smoke'?2026102717:2026102901)),budgetMs:cli.seconds!==undefined?Number(cli.seconds)*1000:Number(cli.hours??(mode==='smoke'?1/120:8))*3600000};
      const used=historicalKeys(),selection=reserveOpenings(config.seed,'selection',mode==='smoke'?8:256,used),confirmation=reserveOpenings(config.seed,'confirmation',mode==='smoke'?8:1024,used);
      state={version:VERSION,source:sourceDigest(root),config,platform:{system:platform(),arch:arch(),release:release(),node:process.version,cpus:cpus().length,host:hostname()},
        sessions:[{at:new Date().toISOString(),pid:process.pid}],status:'running',stage:'calibration',elapsedMs:0,cpuMs:0,tasks:{},failures:[],
        protocol:{comparisons:512,maxPairs:1024,selectionRule:'highest mean pair points over predefined selection conditions; ties development relative MSE then ID',
          evidenceRule:'128 moderate and 64 longer confirmation pairs, simultaneous lower bounds > .5 at 80 and 300 ms; no automatic production change',
          seedNamespaces:['train','development','confirmation-quality','selection','confirmation','fit'],reservedAt:new Date().toISOString()},
        openings:{selection,confirmation},usedKeys:[...used],splitAudit:{historicalAndReservedKeys:used.size,rejectedGames:0,reasons:{}},
        progress:{accepted:{train:0,development:0,'confirmation-quality':0},next:{}},data:{},references:{},models:{},
        training:{round:0,current:{},best:{},stale:{},history:[],applied:{}},conditions:[],assessmentTasks:[],allocation:{performance:0.10,data:0.20,training:0.45,validation:0.25,actualMs:{}}};
      const git=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});state.git=git.status===0?git.stdout.trim():'unavailable';
      for(const model of [makeModel('B'),{...makeModel('C'),extra:[]},...candidates()]) {
        const path=`${output}/models/initial-${model.id}.json`;atomic(path,model);state.models[model.id]=path;state.training.current[model.id]=path;
      }
    }
    const smoke=state.config.mode==='smoke';
    start=performance.now();
    const elapsed=()=>baseElapsed+performance.now()-start;
    const remaining=()=>state.config.budgetMs-elapsed();
    const checkpoint=()=>{state.elapsedMs=elapsed();const cpu=process.cpuUsage(sessionCpu);state.cpuMs=baseCpu+(cpu.user+cpu.system)/1000;atomic(manifestPath,state);};
    const refresh=()=>{checkpoint();report(state,output);};
    const stop=signal=>{stopping=true;state.stoppingReason=`received ${signal}`;for(const worker of pool) worker.cancel?.();};
    const onInt=()=>stop('SIGINT'),onTerm=()=>stop('SIGTERM');process.on('SIGINT',onInt);process.on('SIGTERM',onTerm);
    const guard=()=>{if(stopping||remaining()<=0) {state.stoppingReason??='active wall-clock budget exhausted';throw new Stop(state.stoppingReason);}};
    function workerSlot() {
      let slot=pool.find(s=>!s.busy&&!s.dead);
      if(slot) return slot;
      if(pool.filter(s=>!s.dead).length>=state.config.workers) throw new Error('Worker scheduler oversubscribed');
      slot={worker:new Worker(new URL('./research/worker.mjs',import.meta.url),{resourceLimits:{maxOldGenerationSizeMb:384}}),busy:false,dead:false};pool.push(slot);return slot;
    }
    async function execute(id,job,{maxMs}={}) {
      const previous=state.tasks[id];
      if(previous?.status==='complete'&&existsSync(previous.path)) return read(previous.path);
      if(previous?.status==='failed') return null;
      if(job.type==='pair'||job.type==='assess') {
        if(pool.some(s=>s.busy)) throw new Error('Timed/assessment work cannot overlap other tasks');
        const idle=pool.filter(s=>!s.dead);
        await Promise.all(idle.slice(1).map(async s=>{s.dead=true;await s.worker.terminate();}));
      }
      guard();const slot=workerSlot();slot.busy=true;
      state.tasks[id]={status:'running',type:job.type,startedMs:elapsed()};checkpoint();
      const taskStart=performance.now(),limit=Math.max(1,Math.min(remaining(),maxMs??remaining()));
      let timeout;
      const response=await new Promise(resolve=>{
        let finished=false;
        const finish=value=>{if(finished) return;finished=true;clearTimeout(timeout);slot.worker.off('message',message);slot.worker.off('error',error);slot.worker.off('exit',exit);slot.cancel=null;resolve(value);};
        const message=value=>{if(value.id===id) finish(value);};
        const error=e=>{slot.dead=true;finish({ok:false,error:e.stack??String(e)});};
        const exit=code=>{slot.dead=true;finish({ok:false,error:`worker exited ${code}`});};
        slot.worker.on('message',message);slot.worker.on('error',error);slot.worker.on('exit',exit);
        slot.cancel=()=>{slot.dead=true;slot.worker.terminate();finish({interrupted:true});};
        timeout=setTimeout(()=>{slot.dead=true;slot.worker.terminate();finish(remaining()<=20||stopping?{interrupted:true}:{ok:false,error:`task exceeded ${Math.round(limit)} ms cap`});},limit);
        slot.worker.postMessage({id,job});
      });
      slot.busy=false;
      const wallMs=performance.now()-taskStart;
      const category=job.type==='calibrate'?'performance':['generate','label'].includes(job.type)?'data':job.type==='train'?'training':'validation';
      // Sum task wall time separately from elapsed time: parallel tasks overlap.
      state.allocation.actualMs[category]=(state.allocation.actualMs[category]??0)+wallMs;
      if(response.interrupted) {state.tasks[id]={status:'interrupted',type:job.type,wallMs};checkpoint();throw new Stop('task interrupted at stop/budget');}
      if(!response.ok) {
        state.tasks[id]={status:'failed',type:job.type,wallMs,error:response.error};state.failures.push({id,error:response.error});checkpoint();return null;
      }
      const path=`${output}/tasks/${id}.json`,result=response.result;
      if(job.type==='train') {
        const modelPath=`${output}/models/${id}.json`;atomic(modelPath,result.model);result.modelPath=modelPath;delete result.model;
      }
      atomic(path,result);state.tasks[id]={status:'complete',type:job.type,startedMs:state.tasks[id].startedMs,path,wallMs:response.wallMs,cpuMs:response.cpuMs,cpuMeasurement:'process-wide sample; overlaps parallel tasks; do not sum'};checkpoint();return result;
    }
    timer=setInterval(()=>{
      if(sourceDigest(root)!==state.source) stop('source/input changed; resume requires the original checkout');
      checkpoint();console.log(`[research] ${state.stage}; active ${(elapsed()/60000).toFixed(1)} / ${(state.config.budgetMs/60000).toFixed(1)} min; games ${JSON.stringify(state.progress.accepted)}`);
    },15000);
    reportTimer=setInterval(refresh,30000);
    const setStage=stage=>{state.stage=stage;refresh();console.log(`[research] ${stage}`);};
    // Run correctness on each start. Skip only this runner's subprocess smoke
    // tests to prevent recursive test invocation; all rule/endgame cases run.
    const checks=spawnSync(process.execPath,['--test',...readdirSync(`${root}/tests`).filter(f=>f.endsWith('.test.mjs')).map(f=>`tests/${f}`)],
      {cwd:root,encoding:'utf8',env:{...process.env,REVERSI_RESEARCH_CHECK:'1'},timeout:Math.floor(Math.max(1,Math.min(30000,remaining())))});
    atomic(`${output}/correctness.log`,(checks.stdout??'')+(checks.stderr??''));
    if(checks.status!==0) throw new Error(`Correctness tests failed; see ${output}/correctness.log`);
    state.correctness={passed:true,at:new Date().toISOString()};
    const used=new Set(state.usedKeys);
    async function generate(split,target,stageDeadline) {
      state.data[split]??=[];
      while(state.progress.accepted[split]<target&&elapsed()<stageDeadline) {
        guard();const count=Math.min(state.config.workers,target-state.progress.accepted[split]),jobs=[];
        for(let k=0;k<count;k++) {
          const index=(state.progress.next[split]??0)+k;
          const seed=seedFor(state.config.seed,split,index),id=`game-${split}-${index}`;
          jobs.push({index,id,job:{type:'generate',seed,split,index,openingPlies:8+index%5,depth:smoke?1:(index%5===0?2:1)}});
        }
        const completed=await Promise.allSettled(jobs.map(j=>execute(j.id,j.job,{maxMs:smoke?5000:60000})));
        // Commit a generation batch as one coordinator transaction. A stop in
        // the middle leaves successful task artifacts reusable on resume.
        const interruption=completed.find(item=>item.status==='rejected');
        if(interruption) throw interruption.reason;
        for(let k=0;k<jobs.length;k++) {
          const {id,index}=jobs[k],item=completed[k];
          if(item.status==='rejected') throw item.reason;
          const result=item.value;state.progress.next[split]=index+1;
          if(!result) continue;
          const game=result.games[0],keys=[...game.prefixes,...game.states].filter(p=>p.player!==null).map(p=>canonical(p.board,p.player));
          // Historical/reserved roots exclude their whole generated trajectory.
          // Every retained board and root also excludes cross-split transpositions.
          if(keys.some(key=>used.has(key))) {
            state.splitAudit.rejectedGames++;state.splitAudit.reasons.canonicalCollision=(state.splitAudit.reasons.canonicalCollision??0)+1;
            continue;
          }
          for(const key of keys) used.add(key);
          state.data[split].push(state.tasks[id].path);state.progress.accepted[split]++;
        }
        state.usedKeys=[...used];checkpoint();
        if((state.progress.next[split]??0)>target*12+100) {state.failures.push({id:`generation-${split}`,error:'excessive duplicate/failing games; stopped this split'});break;}
      }
    }
    async function label(split,{limit,deep=0}={}) {
      const task=`labels-${split}`;
      if(!state.data[split]?.length) {state.references[split]=[];return;}
      const result=await execute(task,{type:'label',paths:state.data[split],empties:state.referenceEmpties??6,deep,limit:limit??(smoke?2:96)},
        {maxMs:smoke?4000:Math.min(remaining()*0.15,600000)});
      state.references[split]=result?[state.tasks[task].path]:[];checkpoint();
    }
    function modelPaths(ids) {return ids.map(id=>state.models[id]);}
    async function assessment(id,ids,split) {
      const result=await execute(id,{type:'assess',models:modelPaths(ids),baseline:state.models.B,paths:state.data[split]??[],references:state.references[split]??[]},
        {maxMs:smoke?5000:Math.min(remaining()*0.2,600000)});
      if(result&&!state.assessmentTasks.includes(id)&&split!=='confirmation-quality') state.assessmentTasks.push(id);
      checkpoint();return result;
    }
    function addCondition(stage,candidate,opponent,budget,target,originalTarget=target) {
      const id=`${stage}-${candidate}-${opponent}-${budget.timeMs?`ms${budget.timeMs}`:`d${budget.depth}`}`;
      let condition=state.conditions.find(c=>c.id===id);
      if(!condition) {condition={id,stage,candidate,opponent,budget,target,originalTarget,tasks:[]};state.conditions.push(condition);checkpoint();}
      return condition;
    }
    async function tournament(conditions,deadline) {
      // Higher-priority conditions are passed first. Deterministic round-robin;
      // no result-dependent early stopping or AI decisions.
      const max=Math.max(0,...conditions.map(c=>c.target));
      for(let pair=0;pair<max;pair++) for(const c of conditions) {
        if(pair>=c.target||elapsed()>=deadline) continue;
        const id=`pair-${c.id}-${pair}`;
        if(c.tasks.includes(id)) continue;
        guard();const opening=state.openings[c.stage==='confirmation'?'confirmation':'selection'][pair];
        const r=await execute(id,{type:'pair',candidate:state.models[c.candidate],opponent:state.models[c.opponent],budget:c.budget,
          opening,index:pair,options:state.calibration?.options,opponentDepth:c.opponentDepth},
          {maxMs:c.budget.timeMs?Math.max(10000,c.budget.timeMs*140+1000):smoke?3000:120000});
        if(r) {c.tasks.push(id);checkpoint();}
      }
    }
    function conditionMean(c) {return summarizePairs(c.tasks.map(id=>read(state.tasks[id].path))).mean;}
    let stages=0;
    while(state.stage!=='done') {
      guard();if(stages++>20) throw new Error('Invalid stage transition');
      switch(state.stage) {
        case 'calibration': {
          const result=await execute('calibration',{type:'calibrate',smoke,seed:seedFor(state.config.seed,'calibration')},{maxMs:smoke?4000:Math.min(remaining()*0.1,60000)});
          state.calibration=result??{options:{fastMoves:false,orderingHints:false},component:[]};
          state.referenceEmpties=6;
          state.stageEnds={data:Math.min(state.config.budgetMs*(smoke?0.27:0.20),elapsed()+(smoke?5000:state.config.budgetMs*0.19)),
            training:state.config.budgetMs*(smoke?0.50:0.66),selection:state.config.budgetMs*(smoke?0.68:0.79)};
          state.dataTargets=smoke?{train:8,development:4}:{train:1024,development:192};
          setStage('data');break;
        }
        case 'data': {
          // Development first, so limited runs still have an objective for fitting.
          await generate('development',state.dataTargets.development,state.stageEnds.data);
          await generate('train',state.dataTargets.train,state.stageEnds.data);
          await label('development',{deep:smoke?0:4,limit:smoke?2:64});
          await label('train',{limit:smoke?4:128});
          const timing=readIfComplete('labels-train');
          if(!smoke&&timing?.exactN) {
            const average=timing.exactMs/timing.exactN;
            // Pilot one deeper independent solve; increase at most two empties
            // per expansion and retain a hard per-task cap.
            state.referenceEmpties=average<2?10:average<15?8:6;
            if(state.referenceEmpties>6) {
              const id='labels-train-expanded';const result=await execute(id,{type:'label',paths:state.data.train.slice(0,32),empties:state.referenceEmpties,deep:0,limit:16},{maxMs:Math.min(60000,remaining()*0.025)});
              if(result) state.references.train.push(state.tasks[id].path);
              else state.referenceEmpties=6;
            }
          }
          // Keep at least the original 25% reserve. Cheap completed phases return
          // unused time; fitting stops on predefined development stagnation.
          setStage('training');break;
        }
        case 'training': {
          if(!state.data.train?.length||!state.data.development?.length) {state.failures.push({id:'training',error:'insufficient disjoint completed games; use B fallback'});setStage('assessment');break;}
          const calibrated=await execute('prediction-calibration',{type:'calibrate-predictions',models:modelPaths(['B','C']),paths:state.data.train});
          if(calibrated) for(const model of calibrated.models) {const path=`${output}/models/prediction-${model.id}.json`;atomic(path,model);state.models[model.id]=path;}
          checkpoint();
          const ids=candidates().map(m=>m.id),maxRounds=smoke?1:128;
          for(let round=state.training.round;round<maxRounds&&elapsed()<state.stageEnds.training;round++) {
            // Parallel fitting only; no tournaments share these CPUs.
            const eligible=ids.filter(id=>(state.training.stale[id]??0)<6);
            if(!eligible.length) break;
            for(let offset=0;offset<eligible.length&&elapsed()<state.stageEnds.training;offset+=state.config.workers) {
              const batch=eligible.slice(offset,offset+state.config.workers),outcomes=await Promise.allSettled(batch.map(id=>{
                const task=`fit-${id}-${round}`;
                if(state.training.applied[task]) return null;
                return execute(task,{type:'train',model:state.training.current[id],train:state.data.train,development:state.data.development,references:state.references.train,
                  epochs:smoke?1:2,seed:seedFor(state.config.seed,`fit-${id}`,round),maxMs:smoke?1500:60000},
                  {maxMs:Math.min(smoke?3000:120000,Math.max(1,state.stageEnds.training-elapsed()))});
              }));
              for(let k=0;k<batch.length;k++) {
                if(outcomes[k].status==='rejected') throw outcomes[k].reason;
                const result=outcomes[k].value,id=batch[k],task=`fit-${id}-${round}`;
                if(state.training.applied[task]) continue;
                state.training.applied[task]=true;
                if(!result) {state.training.stale[id]=6;continue;}
                state.training.current[id]=result.modelPath;
                state.training.trainingMs??={};state.training.trainingMs[id]=(state.training.trainingMs[id]??0)+state.tasks[task].wallMs;
                for(const row of result.curve) state.training.history.push({id,...row,trainingMs:state.training.trainingMs[id]});
                const mse=result.loss.mse,best=state.training.best[id];
                if(Number.isFinite(mse)&&(!best||mse<best.mse*(1-0.0001))) {state.training.best[id]={mse,path:result.modelPath};state.models[id]=result.modelPath;state.training.stale[id]=0;}
                else state.training.stale[id]=(state.training.stale[id]??0)+1;
              }
              checkpoint();
            }
            state.training.round=round+1;refresh();
          }
          setStage('assessment');break;
        }
        case 'assessment': {
          const ids=['B','C',...Object.keys(state.training.best)];
          const result=await assessment('development-assessment',ids,'development');
          state.shortlist=result?shortlist(result.metrics.filter(m=>!['B','C'].includes(m.id)),ids.map(id=>read(state.models[id])),smoke?2:4):[];
          if(!state.shortlist.includes('C')) state.shortlist.push('C');
          // Add/remove controls remain reported even when not shortlisted.
          setStage('preliminary');break;
        }
        case 'preliminary': {
          const conditions=state.shortlist.map(id=>addCondition('preliminary',id,'B',{depth:smoke?1:2},smoke?1:8));
          await tournament(conditions,smoke?state.config.budgetMs*0.62:state.config.budgetMs*0.73);
          const dev=readIfComplete('development-assessment')?.metrics??[];
          const rank=[...state.shortlist].sort((a,b)=>{
            const ca=conditions.find(c=>c.candidate===a),cb=conditions.find(c=>c.candidate===b);
            return (conditionMean(cb)??-1)-(conditionMean(ca)??-1)||(dev.find(m=>m.id===a)?.relativeMse??Infinity)-(dev.find(m=>m.id===b)?.relativeMse??Infinity)||a.localeCompare(b);
          });
          state.finalists=rank.slice(0,smoke?1:2);if(!state.finalists.length) state.finalists=['B'];
          setStage('serious');break;
        }
        case 'serious': {
          const budgets=smoke?[{depth:1},{timeMs:1}]:[{timeMs:80},{timeMs:300},{timeMs:20},{depth:3}],conditions=[];
          const pairCosts=state.conditions.filter(c=>c.tasks.length).flatMap(c=>c.tasks.map(id=>state.tasks[id].wallMs));
          const measured=pairCosts.length?pairCosts.reduce((s,v)=>s+v,0)/pairCosts.length:500;
          state.measuredPreliminaryPairMs=measured;
          const capacity=Math.max(1,Math.floor((state.stageEnds.selection-elapsed())/Math.max(1,measured*state.finalists.length*budgets.length)));
          state.feasibleSelectionPairs=smoke?1:Math.min(32,capacity);
          for(const id of state.finalists) if(id!=='B') for(const budget of budgets) conditions.push(addCondition('serious',id,'B',budget,smoke?1:Math.min(budget.timeMs===300?16:32,capacity),smoke?1:budget.timeMs===300?16:32));
          if(state.finalists.length===2) conditions.push(addCondition('serious',state.finalists[0],state.finalists[1],smoke?{depth:1}:{timeMs:80},smoke?1:Math.min(16,capacity),16));
          await tournament(conditions,state.stageEnds.selection);
          const dev=readIfComplete('development-assessment')?.metrics??[];
          // Compare only finalists with every planned condition represented;
          // missing conditions never earn free points. Otherwise fall back B.
          const eligible=state.finalists.filter(id=>id!=='B'&&conditions.filter(c=>c.candidate===id&&c.opponent==='B').every(c=>c.tasks.length>0));
          eligible.sort((a,b)=>{
            const score=id=>{const rows=conditions.filter(c=>c.candidate===id&&c.opponent==='B');return rows.reduce((s,c)=>s+(conditionMean(c)??0),0)/Math.max(1,rows.length);};
            return score(b)-score(a)||(dev.find(m=>m.id===a)?.relativeMse??Infinity)-(dev.find(m=>m.id===b)?.relativeMse??Infinity)||a.localeCompare(b);
          });
          state.selected=eligible[0]??'B';setStage('freeze');break;
        }
        case 'freeze': {
          // This durable record is written BEFORE any confirmation game or label.
          const chosen=read(state.models[state.selected]);const path=`${output}/models/frozen.json`;atomic(path,chosen);
          state.models[state.selected]=path;
          const secondsPerPair=timeMs=>{
            const rows=state.conditions.filter(c=>c.stage==='serious'&&c.budget.timeMs===timeMs).flatMap(c=>c.tasks.map(id=>state.tasks[id].wallMs/1000));
            return rows.length?rows.reduce((s,v)=>s+v,0)/rows.length:timeMs*0.104;
          };
          const baseSeconds=128*secondsPerPair(80)+64*secondsPerPair(300);
          // Selection timings set this expansion before confirmation is opened.
          const factor=smoke?1:Math.max(1,Math.min(8,Math.floor(remaining()*0.8/1000/Math.max(1,baseSeconds))));
          state.confirmationTargets={moderate:128*factor,long:64*factor,expansionFactor:factor,estimatedBaseSeconds:baseSeconds};
          state.freeze={id:state.selected,modelPath:path,elapsedMs:elapsed(),at:new Date().toISOString(),rule:state.protocol.selectionRule,confirmationTargets:state.confirmationTargets};
          atomic(`${output}/selection-freeze.json`,state.freeze);checkpoint();
          const ablation=await execute('ablations',{type:'ablations',model:path,paths:state.data.development??[]},{maxMs:smoke?2000:60000});
          if(ablation) atomic(`${output}/ablations.json`,ablation);
          setStage('confirmation');break;
        }
        case 'confirmation': {
          if(!state.freeze) throw new Error('Confirmation requires durable freeze');
          // Confirmation generation/labels are first accessed in this stage.
          await generate('confirmation-quality',smoke?2:96,Math.min(elapsed()+(smoke?1500:Math.max(1000,remaining()*0.04)),state.config.budgetMs*0.87));
          await label('confirmation-quality',{limit:smoke?2:64,deep:smoke?0:4});
          const ids=[...new Set(['B','C',state.freeze.id])];
          const result=await assessment('confirmation-assessment',ids,'confirmation-quality');
          if(result) state.confirmationTask='confirmation-assessment';
          const diagnostic=await execute('diagnostics',{type:'diagnostics',models:modelPaths(ids),references:state.references['confirmation-quality']??[]},{maxMs:smoke?2000:30000});
          if(diagnostic) atomic(`${output}/diagnostics.json`,diagnostic);
          const selected=state.freeze.id;
          if(selected==='B') state.stoppingReason='no eligible challenger; B retained; confirmation quality still reported';
          else {
            const conditions=smoke?[addCondition('confirmation',selected,'B',{depth:1},1),addCondition('confirmation',selected,'B',{timeMs:1},1)]:[
              addCondition('confirmation',selected,'B',{timeMs:80},state.confirmationTargets.moderate,128),addCondition('confirmation',selected,'B',{timeMs:300},state.confirmationTargets.long,64),
              addCondition('confirmation',selected,'B',{depth:3},64),addCondition('confirmation',selected,'B',{timeMs:20},32)];
            await tournament(conditions,state.config.budgetMs-100);
            if(conditions.some(c=>c.tasks.length<c.target)&&remaining()<200) {state.stoppingReason='budget exhausted with incomplete confirmation; resume can finish remaining pairs';throw new Stop(state.stoppingReason);}
            const controls=smoke?[]:[addCondition('depth-control','B','B',{depth:2},16)];
            // Pair worker supports asymmetric budgets explicitly, below.
            for(const c of controls) c.opponentDepth=3;
            await tournament(controls,state.config.budgetMs-100);
          }
          setStage('done');break;
        }
        default: throw new Error(`Unknown stage ${state.stage}`);
      }
    }
    state.status='complete';state.stoppingReason??='planned program completed (see individual incomplete conditions)';refresh();
    function readIfComplete(id) {return state.tasks[id]?.status==='complete'?read(state.tasks[id].path):null;}
    process.off('SIGINT',onInt);process.off('SIGTERM',onTerm);
  } catch(error) {
    if(state) {
      state.elapsedMs=baseElapsed+performance.now()-start;
      state.status=error instanceof Stop?'stopped':'failed';state.stoppingReason??=error.message;
      if(!(error instanceof Stop)) state.failures.push({id:'runner',error:error.stack??String(error)});
      atomic(manifestPath,state);report(state,output);
    }
    if(!(error instanceof Stop)) throw error;
  } finally {
    clearInterval(timer);clearInterval(reportTimer);
    await Promise.allSettled(pool.map(s=>s.worker.terminate()));
    if(existsSync(lockPath)) unlinkSync(lockPath);
  }
  console.log(`[research] ${state.status}; ${output}/report.md`);return state;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(error=>{console.error(error.message);process.exitCode=1;});
