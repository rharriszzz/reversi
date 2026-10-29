#!/usr/bin/env node
import { existsSync, mkdirSync, appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { uptime, freemem } from 'node:os';
import { atomic, read, sourceDigest } from '../research/io.mjs';
import { identity, sha } from '../teacher/edax.mjs';
import { verifyPreflight } from '../teacher/bound-preflight.mjs';
import { writerLock, parallel } from '../teacher/qualification-core.mjs';
import { PROTOCOL, hash, slots, transferIds } from './protocol.mjs';
import { historical, trajectoryKeys, verifyTrajectory, preferences } from './data.mjs';
import { normalizePairs, fit, zero, select, makeModel, verifyModel, weightsFor, objective } from './model.mjs';
import { lossSummary, frontierDecisions, summarizeDecisions, corrections, forecast, bootstrapSources, positionalGate } from './diagnostics.mjs';
import { fullWindow } from './frontier.mjs';
import { game, evaluationCost, pairBootstrap, gameSummary } from './games.mjs';
import { Pool } from './pool.mjs';
import { Progress } from './progress.mjs';
import { KeyIndex } from './index.mjs';
import { executionIdentity, compactSearchReceipt } from './planning-source.mjs';

class Pause extends Error {}
const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i].replace(/^--/,'')]=process.argv[i+1];
const output=resolve(args.output),repository=resolve(args.repository??'.'),mode=args.mode??'session-one';
if(!['pilot','session-one','continue'].includes(mode))throw Error('Invalid residual execution mode');
mkdirSync(output,{recursive:true});
const path=name=>`${output}/${name}.json`,execution=executionIdentity(fileURLToPath(new URL('../..',import.meta.url)),output),source=execution.source;
const experimentCapMs=execution.scheduling?.experimentCapMs??PROTOCOL.experimentCapMs;
const qualification=read(`${repository}/.local-research/teacher-qualification-v4r1-20261028/manifest.json`);
const pin=identity(qualification.pin.binary,qualification.pin.evalFile,{buildFile:qualification.pin.experimental.buildFile});
if(hash(pin)!==hash(qualification.pin)||qualification.status!=='complete'||!Object.values(qualification.gates??{}).every(Boolean))throw Error('Qualified teacher identity/gates mismatch');
verifyPreflight(qualification.adapterPreflightPath,pin);
const runIdentity=hash({source,protocol:PROTOCOL,pin,qualification:qualification.runIdentity});
const session=read(path('session'));
let state=existsSync(path('manifest'))?read(path('manifest')):{version:1,source,protocol:PROTOCOL,pin,runIdentity,
  status:'created',stage:'initialize',elapsedMs:session.experimentPriorMs??0,sessions:[],counts:{},created:new Date().toISOString(),repairFrom:session.repairFrom};
if(state.runIdentity!==runIdentity)throw Error('Frozen source/protocol/teacher mismatch');
Object.assign(state,execution);
if(state.status==='failed')throw Error('Scientific/correctness failure preserved; repair and use a new engineering run');
const unlock=writerLock(`${output}/writer.lock`),started=performance.now(),prior=state.elapsedMs;
const priorCpu=state.nodeCpuTotal??{user:0,system:0},priorRss=state.nodeMaxRssBytes??0;
let bootId=null;try{bootId=readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim();}catch{}
// Charge uncheckpointed same-boot time after a hard crash. A reboot's uncertainty
// is conservatively charged one maximum task; no completed receipt is repeated.
const recoveryCharge=state.status==='running'?(state.bootId===bootId&&state.heartbeatBootMs?Math.min(PROTOCOL.workerTaskCapMs,Math.max(0,uptime()*1000-state.heartbeatBootMs)):PROTOCOL.workerTaskCapMs):0;
let stopped=false,pool=null,progress=null,keys=null,owners=null,historicalSeeds=null;
const elapsed=()=>prior+recoveryCharge+performance.now()-started;
const sessionElapsed=()=>session.priorActiveMs+recoveryCharge+performance.now()-started;
const remaining=()=>Math.min(session.budgetMs-sessionElapsed(),session.deadlineEpochMs-Date.now(),experimentCapMs-elapsed());
const checkpoint=()=>{
  state.elapsedMs=elapsed();state.updated=new Date().toISOString();state.pid=process.pid;state.bootId=bootId;state.heartbeatBootMs=uptime()*1000;
  state.session={id:session.id,activeMs:sessionElapsed(),budgetMs:session.budgetMs,remainingMs:remaining(),deadlineEpochMs:session.deadlineEpochMs};
  state.nodeCpu=process.cpuUsage();state.nodeMaxRssBytes=process.resourceUsage().maxRSS*1024;
  state.nodeCpuTotal={user:priorCpu.user+state.nodeCpu.user,system:priorCpu.system+state.nodeCpu.system};
  state.nodeMaxRssBytes=Math.max(priorRss,state.nodeMaxRssBytes);
  atomic(path('manifest'),state);
  atomic(path('session'),{...session,priorActiveMs:sessionElapsed()});
};
const check=(costMs=0)=>{
  if(stopped)throw new Pause('Requested graceful pause');
  if(remaining()<PROTOCOL.sessionDrainReserveMs+costMs)throw new Pause('Session allowance protected; no new expensive work dispatched');
  if(freemem()<768*2**20)throw new Pause('WSL memory reserve; drain and resume after resources recover');
};
const event=(name,fields={})=>progress?.emit(name,fields);
const telemetry=row=>appendFileSync(`${output}/tasks-telemetry.jsonl`,JSON.stringify({at:new Date().toISOString(),...row})+'\n');
progress=new Progress(output,state,()=>pool);
let resourceAt=0,workers=Math.min(Number(args.workers??2),read(path('preflight')).workers,state.measuredWorkers??Infinity);
if(workers<1)throw Error('No safe worker count');
function setPool(count=workers){pool=new Pool(count,output,runIdentity,{check:()=>check(PROTOCOL.workerTaskCapMs),event,telemetry});}
setPool();
async function resources(force=false,allowIncrease=false) {
  if(!force&&performance.now()-resourceAt<60000)return;
  const result=spawnSync('python3',[fileURLToPath(new URL('./launch.py',import.meta.url)),'--output',output,'--resources-only'],{encoding:'utf8',timeout:40000});
  if(result.status!==0)throw new Pause(`Resource preflight unavailable: ${result.stderr}`);
  const r=JSON.parse(result.stdout);appendFileSync(`${output}/resource-history.jsonl`,JSON.stringify(r)+'\n');resourceAt=performance.now();
  state.resources={limitingAvailableGiB:r.limitingAvailableGiB,workers:r.workers,effectiveWorkers:workers,swapPagesInOutPerSecond:r.swapPagesInOutPerSecond,windowsCpuPercent:r.windows?.cpuPercent};
  if(r.blockers.length)throw new Pause(`Resource headroom: ${r.blockers.join('; ')}`);
  const ceiling=allowIncrease?Number(args['worker-ceiling']??4):workers;
  const safe=Math.min(ceiling,r.workers,Math.floor((r.limitingAvailableGiB-1.5)/.6));
  if(safe<1)throw new Pause('Available physical memory below worker reserve');
  if(safe!==workers) {
    if(pool?.active.size)throw new Pause('Reduced memory cap; drain active tasks before resuming with fewer workers');
    await pool?.close();workers=safe;setPool();event('workers-adjusted',{workers,availableGiB:r.limitingAvailableGiB});
  }
  state.resources.effectiveWorkers=workers;
  return r;
}
const stage=name=>{state.stage=name;checkpoint();event('stage',{name,remainingMinutes:remaining()/60000});};
process.on('SIGINT',()=>{stopped=true;event('pause-requested');});process.on('SIGTERM',()=>{stopped=true;event('pause-requested');});
const heartbeat=setInterval(checkpoint,10000);heartbeat.unref();

async function loadIndex() {
  if(keys)return;
  stage('historical-exclusions');check(60000);
  const cache=path('historical-index');
  if(existsSync(cache)) {
    const saved=read(cache);keys=KeyIndex.load(`${output}/historical-index.bin`);
    if(saved.runIdentity!==runIdentity||keys.digest()!==saved.digest)throw Error('Historical index receipt mismatch');
    historicalSeeds=new Set(saved.seeds);state.historical=saved.audit;
  }else {
    check(120000);event('historical-builder-start',{note:'separate bounded process; large parsing heap released on exit'});
    const result=spawnSync(process.execPath,[fileURLToPath(new URL('./build-index.mjs',import.meta.url)),repository,output,runIdentity],
      {encoding:'utf8',timeout:120000,maxBuffer:1000000});
    if(result.status!==0)throw Error(`Historical builder failed: ${result.stderr}`);
    const saved=read(cache);keys=KeyIndex.load(`${output}/historical-index.bin`);historicalSeeds=new Set(saved.seeds);state.historical=saved.audit;
    if(saved.runIdentity!==runIdentity||keys.digest()!==saved.digest)throw Error('Built historical index identity mismatch');
  }
  owners=new Map();
  if(existsSync(path('reservation-progress')))for(const root of read(path('reservation-progress')).roots) {
    const tr=read(`${output}/trajectories/${root.id}.json`),f=root.role==='games'?null:read(`${output}/frontiers/${root.id}.json`).result;
    verifyTrajectory(tr);
    for(const k of trajectoryKeys(tr,f)) {
      if(keys.has(k)||owners.has(k))throw Error(`Reserved trajectory leakage: ${root.id}`);
      owners.set(k,root.id);
    }
  }
  global.gc?.();checkpoint();event('historical-index-ready',{...state.historical,reservedKeys:owners.size});await resources(true,!state.pilot?.passed);
}

async function reserve(roles) {
  await loadIndex();stage('source-reservation');
  let saved=existsSync(path('reservation-progress'))?read(path('reservation-progress')):{runIdentity,attempt:0,roots:[],rejected:{noRoot:0,collision:0,seed:0},pending:[]};
  if(saved.runIdentity!==runIdentity||saved.identity&&saved.identity!==hash({...saved,identity:undefined}))throw Error('Reservation checkpoint mismatch');
  const save=()=>{saved.identity=hash({...saved,identity:undefined});atomic(path('reservation-progress'),saved);state.counts.reserved=Object.fromEntries([...new Set(saved.roots.map(r=>r.role))].map(role=>[role,saved.roots.filter(r=>r.role===role).length]));checkpoint();};
  const plan=roles.flatMap(role=>slots(role));
  const done=()=>new Set(saved.roots.map(r=>r.id));
  while(plan.some(s=>!done().has(`${s.role}-${s.slot}`))) {
    check(PROTOCOL.workerTaskCapMs);await resources();
    if(!saved.pending.length) {
      // Fixed four-task partitions: worker count never changes reservation order.
      saved.pending=plan.filter(s=>!done().has(`${s.role}-${s.slot}`)).slice(0,4).map(spec=>({spec,attempt:saved.attempt++}));save();
    }
    if(saved.attempt>PROTOCOL.maxAttempts)throw Error('Predeclared source admission attempt cap');
    const results=await parallel(saved.pending,workers,p=>pool.task(`generation-${p.spec.role}-${p.attempt}`,{type:'generate',...p}));
    const prepared=await parallel(results,workers,async(tr,i)=>{
      const spec=saved.pending[i].spec,id=`${spec.role}-${spec.slot}`;
      if(!tr.root||done().has(id)||historicalSeeds.has(tr.seed))return null;
      verifyTrajectory(tr);if([...trajectoryKeys(tr)].some(k=>keys.has(k)||owners.has(k)))return null;
      const root={...tr.root,...spec,id,seed:tr.seed,attempt:tr.attempt,occupied:tr.target,trajectoryHash:hash(tr)};
      return spec.role==='games'?null:pool.task(`frontier-${id}-a${tr.attempt}`,{type:'frontier',root});
    });
    for(let i=0;i<results.length;i++) {
      const tr=results[i],spec=saved.pending[i].spec,id=`${spec.role}-${spec.slot}`;
      if(done().has(id))continue;
      if(!tr.root){saved.rejected.noRoot++;continue;}
      if(historicalSeeds.has(tr.seed)){saved.rejected.seed++;continue;}
      verifyTrajectory(tr);
      const prekeys=trajectoryKeys(tr);
      if([...prekeys].some(k=>keys.has(k)||owners.has(k))){saved.rejected.collision++;continue;}
      const root={...tr.root,...spec,id,seed:tr.seed,attempt:tr.attempt,occupied:tr.target,trajectoryHash:hash(tr)};
      const frontier=prepared[i];if(spec.role!=='games'&&!frontier){saved.rejected.collision++;continue;}
      const allKeys=trajectoryKeys(tr,frontier);
      if([...allKeys].some(k=>keys.has(k)||owners.has(k))){saved.rejected.collision++;continue;}
      atomic(`${output}/trajectories/${id}.json`,tr);
      if(frontier)atomic(`${output}/frontiers/${id}.json`,{runIdentity,rootHash:hash(root),result:frontier,resultHash:hash(frontier)});
      saved.roots.push(root);for(const k of allKeys)owners.set(k,id);save();
      event('source-admitted',{id,occupied:root.occupied,player:root.player,policy:root.policy,depth:root.depth,parents:frontier?.parents.length??0,
        reserved:saved.roots.length,attempt:saved.attempt,rejected:saved.rejected,
        throughputPerMinute:saved.roots.length/Math.max(1,state.elapsedMs)*60000});
    }
    saved.pending=[];save();
  }
  return saved;
}
function verifyFrontier(root) {
  const receipt=read(`${output}/frontiers/${root.id}.json`);
  if(receipt.runIdentity!==runIdentity||receipt.rootHash!==hash(root)||receipt.resultHash!==hash(receipt.result))throw Error('Frontier receipt mismatch');
  return receipt.result;
}
function readLabels(root,frontier) {
  return frontier.parents.map((_,i)=>{
    const entry=Object.fromEntries([10,12].map(d=>[d,read(`${output}/tasks/label-${root.id}-p${i}-d${d}.json`).result]));
    const exact=`${output}/tasks/exact-${root.id}-p${i}.json`;if(existsSync(exact))entry.independent=read(exact).result;
    return entry;
  });
}
async function labelRoot(root) {
  const frontier=verifyFrontier(root),labels=[];
  for(const [i,parent] of frontier.parents.entries()) {
    const entry={};
    for(const depth of PROTOCOL.teacherDepths) {
      check(PROTOCOL.queryCapMs);entry[depth]=await pool.task(`label-${root.id}-p${i}-d${depth}`,
        {type:'label',pin,state:{board:parent.board,player:parent.player},depth,timeoutMs:PROTOCOL.queryCapMs,transcript:`${output}/raw/${root.id}-p${i}-d${depth}.json`});
    }
    if(64-parent.occupied<=10) {
      entry.independent=await pool.task(`exact-${root.id}-p${i}`,{type:'exact',state:{board:parent.board,player:parent.player}});
      if(entry[12].rows.some(row=>row.value!==entry.independent.awarded.rows.find(r=>r.move===row.move)?.value))throw Error('Independent exact frontier mismatch');
    }
    labels.push(entry);
  }
  const group=preferences(root,frontier,labels);
  atomic(`${output}/preferences/${root.id}.json`,{runIdentity,rootHash:hash(root),frontierHash:hash(frontier),labelsHash:hash(labels),group,groupHash:hash(group)});
  return {frontier,labels,group};
}
async function labelRole(roots,role) {
  stage(`label-${role}`);let completed=0,preferenceCount=0;const started=performance.now();
  for(let offset=0;offset<roots.length;offset+=workers) {
    await resources();check(PROTOCOL.workerTaskCapMs);
    const rows=await parallel(roots.slice(offset,offset+workers),workers,async root=>{
      const r=await labelRoot(root);completed++;preferenceCount+=r.group.pairs.length;
      state.counts[role]={sources:completed,target:roots.length,parents:undefined,preferences:preferenceCount};checkpoint();
      const rate=completed/Math.max(.001,(performance.now()-started)/1000);
      state.stageProgress={completed,total:roots.length,preferences:preferenceCount,sourcesPerSecond:rate,
        etaUpperSeconds:(roots.length-completed)/rate*1.35};
      event('source-labeled',{id:root.id,...state.stageProgress,remaining:roots.length-completed});return r;
    });
  }
}

async function searchedAssessment(roots,model,ids) {
  stage('locked-root-transfer');const selected=ids.map(id=>roots.find(r=>r.id===id)),rows=[];
  await parallel(selected,workers,async root=>{
    const labels={};for(const depth of [10,12])labels[depth]=await pool.task(`transfer-${root.id}-d${depth}`,{
      type:'label',pin,state:{board:root.board,player:root.player},depth,timeoutMs:PROTOCOL.queryCapMs,
      transcript:`${output}/raw/transfer-${root.id}-d${depth}.json`});
    const h=new Map(labels[10].rows.map(r=>[r.move,r.value])),r=new Map(labels[12].rows.map(r=>[r.move,r.value])),best=Math.max(...r.values());
    for(const depth of [4,6]) {
      const search={};for(const which of ['B','candidate']) {
        const id=`search-${root.id}-${depth}-${which}`;
        search[which]=compactSearchReceipt(await pool.task(id,{
          type:'root-search',state:{board:root.board,player:root.player},depth,weights:which==='B'?weightsFor(zero()):model.weights}),id);
      }
      const b=search.B.rows[0].move,candidate=search.candidate.rows[0].move;
      rows.push({source:root.id,phase:root.phase,policy:root.policy,sourceDepth:root.depth,depth,b,candidate,
        disagreement:b!==candidate,bRegret:best-r.get(b),candidateRegret:best-r.get(candidate),
        improvement:r.get(candidate)-r.get(b),significantChange:Math.abs(r.get(candidate)-r.get(b))>=4,
        reversal:h.get(candidate)-h.get(b)>=4&&r.get(candidate)-r.get(b)<=-4,
        teacherValues:labels,search,estimated:root.occupied+12<64});
    }
    if(64-root.occupied<=10) {
      const independent=await pool.task(`transfer-exact-${root.id}`,{type:'exact',state:{board:root.board,player:root.player}});
      for(const row of rows.filter(x=>x.source===root.id))row.independent=independent;
    }
    checkpoint();event('root-transfer-complete',{id:root.id,completed:rows.length/2,total:128});
  });
  rows.sort((a,b)=>ids.indexOf(a.source)-ids.indexOf(b.source)||a.depth-b.depth);return rows;
}

async function assess(roles,reservation,model) {
  if(session.id===state.sessions[0].id||args['open-assessment']!=='true')throw Error('First-session assessment lock');
  await labelRole(roles.assessment,'assessment');
  const groups=roles.assessment.map(getGroup),b=lossSummary(groups,zero()),candidate=lossSummary(groups,model.correction);
  const rows=await searchedAssessment(roles.assessment,model,reservation.transferIds);
  const rootSummary=Object.fromEntries([4,6].map(depth=>[depth,summarizeDecisions(rows.filter(r=>r.depth===depth).map(r=>({...r,sourcePhase:r.phase})))]));
  const frontier=roles.assessment.flatMap(root=>{
    const f=verifyFrontier(root),labels=readLabels(root,f);
    return frontierDecisions(root,f,labels,model.correction);
  });
  const lossInterval=bootstrapSources(groups,g=>g.pairs.length?objective(model.correction,normalizePairs([g])).loss-objective(zero(),normalizePairs([g])).loss:null);
  const rootIntervals=Object.fromEntries([4,6].map(depth=>[depth,bootstrapSources(rows.filter(r=>r.depth===depth).map(r=>({...r,depth:r.sourceDepth})),r=>r.candidateRegret-r.bRegret)]));
  const mismatch=rows.filter(r=>r.improvement<0&&frontier.filter(f=>f.source===r.source).reduce((a,f)=>a+f.improvement,0)>0);
  const ablations=[];
  for(let feature=0;feature<7;feature++) {
    const delta=model.correction.map((v,j)=>j%7===feature?0:v),without=lossSummary(groups,delta);
    const ablationRows=[];
    for(const id of reservation.transferIds.filter((_,i)=>i%4===0)) {
      const root=roles.assessment.find(r=>r.id===id),base=rows.find(r=>r.source===id&&r.depth===6);
      const result=await pool.task(`ablation-${feature}-${id}`,{type:'root-search',state:{board:root.board,player:root.player},depth:6,weights:weightsFor(delta)});
      const label=base.teacherValues[12].rows,best=Math.max(...label.map(r=>r.value)),regret=best-label.find(r=>r.move===result.rows[0].move).value;
      ablationRows.push({id,regret,candidateRegret:base.candidateRegret,change:regret-base.candidateRegret});
    }
    ablations.push({feature,lossWithout:without,lossDamageWhenRemoved:without.loss-candidate.loss,rootSubset:ablationRows});
  }
  const coefficientLoss=model.correction.map((_,j)=>{const delta=[...model.correction];delta[j]=0;return {coefficient:j,lossDamageWhenRemoved:objective(delta,normalizePairs(groups)).loss-candidate.loss};});
  const gates=positionalGate(b.loss,candidate.loss,rows),result={runIdentity,modelChecksum:model.checksum,B:b,candidate,
    frontier:summarizeDecisions(frontier),rootSummary,rootRows:rows,frontierRows:frontier,lossInterval,rootIntervals,
    immediateImprovesRootWorsens:mismatch,ablations,coefficientLoss,gates};
  atomic(path('assessment-results'),result);state.assessment={gates,modelChecksum:model.checksum};checkpoint();
  return result;
}

async function tournament(roles,model,gates) {
  if(!gates.complete||!gates.preference||!gates.root) {state.status='positional-gate-failed';return;}
  await pool.close();pool=null;stage('isolated-confirmation');
  const inferenceCost=evaluationCost(roles.assessment,model.weights),conditions=[];
  for(const timeMs of [80,300]) {
    const pairs=[];
    for(const [index,opening] of roles.games.entries()) {
      const pairPath=path(`confirmation/${timeMs}-${index}`);
      if(existsSync(pairPath)){const saved=read(pairPath);if(saved.modelChecksum!==model.checksum||saved.openingId!==opening.id)throw Error('Confirmation receipt mismatch');pairs.push(saved);continue;}
      await resources();check(120*timeMs*1.35);const games=[];
      for(const candidateColor of index%2?[-1,1]:[1,-1]) {
        const partial=path(`confirmation/partial-${timeMs}-${index}-${candidateColor}`);
        const saved=existsSync(partial)?read(partial):null;
        if(saved&&(saved.modelChecksum!==model.checksum||saved.openingId!==opening.id))throw Error('Partial game identity mismatch');
        const result=await game(opening,model.weights,candidateColor,timeMs,{check:()=>check(),resume:saved,
          checkpoint:s=>atomic(partial,{...s,modelChecksum:model.checksum,openingId:opening.id})});
        // Outcome-independent trajectory check: any forbidden collision blocks a claim;
        // never silently replace a predetermined opening after seeing game outcomes.
        const {keyFor}=await import('./data.mjs');let board=opening.board,player=opening.player;
        for(const move of result.moves){if(move.move!==null){const {play}=await import('../../src/rules.js');board=[...play(board,player,move.move)];}player=-player;
          if(board.filter(Boolean).length>=12)for(const side of [1,-1]) {const key=keyFor(board,side),owner=owners.get(key);if(keys.has(key)||(owner&&owner!==opening.id&& !owner.startsWith('games-')))throw Error('Confirmation trajectory collides with scientific source; frozen sample not replaced');}}
        games.push(result);
      }
      const pair={runIdentity,modelChecksum:model.checksum,openingId:opening.id,timeMs,index,games,point:games.reduce((s,g)=>s+g.points,0)/2};
      atomic(pairPath,pair);pairs.push(pair);checkpoint();event('confirmation-pair-checkpoint',{timeMs,completed:pairs.length,target:256});
    }
    conditions.push({timeMs,...pairBootstrap(pairs.map(p=>p.point)),...gameSummary(pairs.flatMap(p=>p.games))});
  }
  const positive=conditions.every(c=>c.pairs===256&&c.lower975>.5);
  atomic(path('confirmation-results'),{runIdentity,modelChecksum:model.checksum,conditions,positive,inferenceCost,
    conclusion:positive?'Stronger equal-time play at both budgets under the predeclared treatment':'Inconclusive or negative; no production promotion'});
  state.confirmation={conditions,positive};state.status='complete';
}
function refreshForecast(pilotResult) {
  const reserved=existsSync(path('reservation-progress'))?read(path('reservation-progress')).roots:[];
  const labeled=reserved.filter(r=>existsSync(`${output}/preferences/${r.id}.json`));
  const scientificCosts=labeled.filter(r=>r.role!=='pilot'&&r.role!=='games').map(root=>{
    const f=verifyFrontier(root),sum=d=>f.parents.reduce((n,_,i)=>n+read(`${output}/tasks/label-${root.id}-p${i}-d${d}.json`).wallMs,0);
    return {id:root.id,phase:root.phase,policy:root.policy,depth:root.depth,generationMs:read(`${output}/trajectories/${root.id}.json`).wallMs,
      frontierMs:f.wallMs,teacher10Ms:sum(10),teacher12Ms:sum(12)};
  });
  const gamePairs=Object.fromEntries([80,300].map(timeMs=>[timeMs,existsSync(`${output}/confirmation`)?readdirSync(`${output}/confirmation`).filter(n=>n.startsWith(`${timeMs}-`)&&n.endsWith('.json')).length:0]));
  const conservativePilot={...pilotResult,costs:[...pilotResult.costs,...scientificCosts]};
  state.forecast=forecast(conservativePilot,{...state.resources,effectiveWorkers:workers},elapsed(),{reserved,labeled,gamePairs,experimentCapMs});
  state.initialForecast??=state.forecast;atomic(path('forecast'),state.forecast);checkpoint();event('complete-experiment-forecast',state.forecast);
  return state.forecast.feasible;
}
function getGroup(root) {
  const r=read(`${output}/preferences/${root.id}.json`);
  if(r.runIdentity!==runIdentity||r.rootHash!==hash(root)||r.groupHash!==hash(r.group))throw Error('Preference receipt mismatch');
  return r.group;
}
function trainModels(groups,development,prefix) {
  stage(`fit-${prefix}`);const pairs=normalizePairs(groups),dev=normalizePairs(development),candidates=[{delta:zero(),lambda:0,control:true}];
  const fits=[];for(const lambda of PROTOCOL.lambdas) {
    const p=path(`optimizer/${prefix}-${lambda}`),result=fit(pairs,lambda,{state:existsSync(p)?read(p):null,check,
      checkpoint:s=>{atomic(p,s);checkpoint();}});
    fits.push(result);candidates.push({delta:result.delta,lambda,trainingLoss:result.preferenceLoss});
  }
  const selected=select(candidates,dev),model=makeModel(selected.delta,{runIdentity,prefix,lambda:selected.lambda,trainingIds:groups.map(g=>g.id),developmentIds:development.map(g=>g.id)});
  verifyModel(JSON.parse(JSON.stringify(model)));atomic(path(`models/${prefix}`),model);
  return {model,selected,fits:fits.map(({history,...r})=>r),training:lossSummary(groups,selected.delta),development:lossSummary(development,selected.delta),
    BTraining:lossSummary(groups,zero()),BDevelopment:lossSummary(development,zero()),corrections:corrections(selected.delta)};
}

async function pilot() {
  if(state.pilot?.passed){event('pilot-reused',{checksum:state.pilot.digest});return;}
  const reservation=await reserve(['pilot']),roots=reservation.roots.filter(r=>r.role==='pilot').sort((a,b)=>a.slot-b.slot);
  atomic(path('pilot-reservation'),{runIdentity,roots,digest:hash(roots),beforeLabels:true});
  await labelRole(roots,'pilot');
  const groups=roots.map(getGroup),training=groups.filter((_,i)=>i%3!==2),development=groups.filter((_,i)=>i%3===2);
  const learned=trainModels(training,development,'pilot');
  const decisions=roots.flatMap(root=>{
    const f=verifyFrontier(root),labels=readLabels(root,f);
    return frontierDecisions(root,f,labels,learned.model.correction);
  });
  const costs=roots.map(root=>{
    const f=verifyFrontier(root),sum=d=>f.parents.reduce((n,_,i)=>n+read(`${output}/tasks/label-${root.id}-p${i}-d${d}.json`).result.wallMs,0);
    return {id:root.id,phase:root.phase,policy:root.policy,depth:root.depth,generationMs:read(`${output}/trajectories/${root.id}.json`).wallMs,
      frontierMs:f.wallMs,initialSearchMs:f.initialSearchMs,parents:f.parents.length,alternatives:f.parents.reduce((n,p)=>n+p.children.length,0),
      teacher10Ms:sum(10),teacher12Ms:sum(12),rootLeafObserved:f.lines.filter(l=>l.rootLeafObserved).length};
  });
  // Full source-root Edax costs are needed to forecast the separate root-transfer stage.
  stage('pilot-root-transfer-cost');const rootLabelCosts=[];
  for(const root of roots.filter((_,i)=>i%4===0)) {
    let cost=0;for(const depth of [10,12]) {
      const result=await pool.task(`pilot-root-${root.id}-d${depth}`,{type:'label',pin,state:{board:root.board,player:root.player},depth,timeoutMs:PROTOCOL.queryCapMs,transcript:`${output}/raw/root-${root.id}-d${depth}.json`});cost+=result.wallMs;
    }rootLabelCosts.push(cost);
  }
  stage('pilot-scaling');await resources(true,true);const scaling={};
  // Matched repeated fixed work, kept separate from the 24 independent observations.
  for(const type of ['generate','label']) {
    const jobs=roots.slice(0,8).map((root,i)=>type==='generate'?{type,spec:read(`${output}/trajectories/${root.id}.json`).spec,attempt:root.attempt}:
      {type,pin,state:verifyFrontier(root).parents[0],depth:12,timeoutMs:PROTOCOL.queryCapMs});
    const trials=[];
    for(const count of [...new Set([1,Math.min(2,workers),workers])])for(let repetition=0;repetition<2;repetition++) {
      const savedTrial=path(`scaling/${type}-${count}-${repetition}`);
      if(existsSync(savedTrial)){const saved=read(savedTrial);if(saved.runIdentity!==runIdentity)throw Error('Scaling trial identity mismatch');trials.push(saved.trial);continue;}
      const partialRecovery=jobs.some((_,i)=>existsSync(`${output}/tasks/scaling-${type}-${count}-${repetition}-${i}.json`));
      const start=performance.now();await parallel(jobs,count,(job,i)=>pool.task(`scaling-${type}-${count}-${repetition}-${i}`,job));
      const trial={workers:count,repetition,wallMs:performance.now()-start,partialRecovery};
      trials.push(trial);atomic(savedTrial,{runIdentity,trial});
    }
    const medians=[...new Set(trials.map(t=>t.workers))].map(count=>{
      const times=trials.filter(t=>t.workers===count).map(t=>t.wallMs).sort((a,b)=>a-b);
      return {workers:count,medianMs:(times[0]+times[times.length-1])/2};
    });
    const best=Math.min(...medians.map(t=>t.medianMs)),selectedWorkers=Math.min(...medians.filter(t=>t.medianMs<=best/.9).map(t=>t.workers));
    const serial=trials.filter(x=>x.workers===1).map(x=>x.wallMs),multi=trials.filter(x=>x.workers===selectedWorkers).map(x=>x.wallMs);
    scaling[type]={trials,selectedWorkers,safeSpeedup:selectedWorkers===1||trials.some(t=>t.partialRecovery)?1:Math.max(1,Math.min(...serial)/Math.max(...multi))};event('scaling-measured',{type,...scaling[type]});
  }
  workers=Math.min(...Object.values(scaling).map(s=>s.selectedWorkers));state.measuredWorkers=workers;
  // Stop all teacher/search workers before timed cost probes.
  await pool.close();pool=null;stage('pilot-isolated-games');
  const gameCosts=[],weights=verifyModel(learned.model),gameRoots=roots.filter(r=>r.phase===0).slice(0,2);
  const inferenceCost=evaluationCost(roots,weights);
  for(const timeMs of [80,300])for(const [index,root] of gameRoots.entries()) {
    const receiptPath=path(`pilot-games/pair-${index}-${timeMs}`);
    if(existsSync(receiptPath)){gameCosts.push(read(receiptPath));continue;}
    // A complete pair costs at most 120 placements times the budget, plus 35%.
    check(120*timeMs*1.35);const games=[];
    for(const candidateColor of index%2?[-1,1]:[1,-1]) {
      const partial=path(`pilot-games/partial-${index}-${timeMs}-${candidateColor}`);
      const resume=existsSync(partial)?read(partial):null;
      games.push(await game(root,weights,candidateColor,timeMs,{check:()=>check(),resume,checkpoint:s=>atomic(partial,s)}));
    }
    const cost={timeMs,index,wallMs:games.reduce((s,g)=>s+g.wallMs,0),games};atomic(receiptPath,cost);gameCosts.push(cost);
    checkpoint();event('pilot-game-pair-complete',{timeMs,index,seconds:cost.wallMs/1000});
  }
  setPool();
  const receipts=readdirSync(`${output}/tasks`).filter(x=>x.endsWith('.json')).map(x=>`${output}/tasks/${x}`);
  // A re-read from disk verifies completed expensive work survives a restart.
  let verified=0;for(const p of receipts){const r=read(p);if(r.runIdentity!==runIdentity||r.inputHash!==hash({job:r.job,runIdentity})||r.resultHash!==hash(r.result))throw Error('Pilot recovery receipt mismatch');verified++;}
  const result={passed:true,roots:roots.length,attempts:reservation.attempt,costs,learned,decisions:summarizeDecisions(decisions),
    fitWallMs:learned.fits.reduce((n,f)=>n+f.wallMs,0),rootLabelCosts,gameCosts,scaling,inferenceCost,
    recovery:{verified,source,runIdentity},sampleExamples:roots.slice(0,4).map(r=>({root:r,frontier:verifyFrontier(r),preferences:getGroup(r)}))};
  result.digest=hash(result);atomic(path('pilot-results'),result);state.pilot={passed:true,digest:result.digest,roots:24};checkpoint();
  event('pilot-passed',{roots:24,preferences:groups.reduce((s,g)=>s+g.pairs.length,0),verifiedReceipts:verified});
}

try {
  state.status='running';state.sessions.push({id:session.id,pid:process.pid,mode,started:new Date().toISOString()});checkpoint();
  atomic(path('protocol'),{source,runIdentity,pin,protocol:PROTOCOL});
  await resources(true);await pilot();
  const pilotResult=read(path('pilot-results'));
  const feasible=refreshForecast(pilotResult);
  if(!feasible){state.status='paused';state.planningHold=true;state.pauseReason=`Full fixed experiment forecast exceeds authorized ${experimentCapMs/3600000}-hour ceiling at the actual pool size; no locked assessment opened`;}
  else if(mode==='pilot'){state.status='paused';state.pauseReason='Integrated pilot complete; full targets preserved';}
  else {
    const reservation=await reserve(['pilot','training','development','assessment','games']);
    const roles=Object.fromEntries(['pilot','training','development','assessment','games'].map(role=>[role,reservation.roots.filter(r=>r.role===role).sort((a,b)=>a.slot-b.slot)]));
    const frozen={runIdentity,roles,transferIds:transferIds(roles.assessment),digest:hash(roles),keys:owners.size,attempts:reservation.attempt,exclusions:state.historical};
    if(existsSync(path('reservations'))&&read(path('reservations')).digest!==frozen.digest)throw Error('Frozen split identities changed');
    atomic(path('reservations'),frozen);state.reservationDigest=frozen.digest;checkpoint();event('all-splits-frozen',{digest:frozen.digest,counts:state.counts.reserved});
    await labelRole(roles.training,'training');
    refreshForecast(pilotResult);
    // First session is deliberately barred from all locked positional or game results.
    if(mode==='continue') {
      await labelRole(roles.development,'development');
      const result=trainModels(roles.training.map(getGroup),roles.development.map(getGroup),'selected');
      atomic(path('fit-results'),result);state.candidate={checksum:result.model.checksum,lambda:result.selected.lambda};
      // Fixed independent-size curves use the final development-selected lambda,
      // never a confirmation outcome. They cannot select a different finalist.
      const curve=[];
      for(const size of PROTOCOL.learningCurve) {
        const groups=roles.training.slice(0,size).map(getGroup),pairs=normalizePairs(groups),lambda=result.selected.lambda;
        const fitResult=lambda===0?{delta:zero()}:fit(pairs,lambda,{check});
        curve.push({size,training:lossSummary(groups,fitResult.delta),development:lossSummary(roles.development.map(getGroup),fitResult.delta),corrections:fitResult.delta});
      }
      atomic(path('learning-curve'),{runIdentity,lambda:result.selected.lambda,curve});
      if(args['open-assessment']==='true') {
        if(!refreshForecast(pilotResult))throw new Pause(`Complete fixed experiment no longer fits authorized ${experimentCapMs/3600000}-hour ceiling; locked outcomes remain unopened`);
        const assessment=await assess(roles,frozen,result.model);
        await tournament(roles,result.model,assessment.gates);
      }
    }
    if(!['complete','positional-gate-failed'].includes(state.status)) {
      state.status='paused';state.pauseReason=mode==='session-one'?'Training labels ready; development and locked assessments unopened':'Candidate frozen; locked assessment requires later authorized continuation';
    }
  }
} catch(error) {
  if(error instanceof Pause){state.status='paused';state.pauseReason=error.message;event('normal-resumable-pause',{reason:error.message});}
  else {state.status='failed';state.error=error.stack;event('failure',{error:error.stack});process.exitCode=1;}
} finally {
  // parallel() drains started tasks before propagating; completed receipts are durable.
  await pool?.close();checkpoint();clearInterval(heartbeat);event('session-finished',{status:state.status,reason:state.pauseReason,elapsedMinutes:state.elapsedMs/60000,counts:state.counts});
  progress.close();unlock();
}
