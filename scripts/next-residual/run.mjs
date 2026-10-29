#!/usr/bin/env node
import { existsSync,mkdirSync,appendFileSync,readFileSync,readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { uptime,freemem } from 'node:os';
import { atomic,read,sourceDigest } from '../research/io.mjs';
import { identity } from '../teacher/edax.mjs';
import { verifyPreflight } from '../teacher/bound-preflight.mjs';
import { writerLock,parallel,mean } from '../teacher/qualification-core.mjs';
import { trajectoryKeys,verifyTrajectory,keysFor } from '../residual/data.mjs';
import { KeyIndex } from '../residual/index.mjs';
import { legalMoves,play,counts } from '../../src/rules.js';
import { PROTOCOL,hash,slots,transferIds } from './protocol.mjs';
import { verifyLinear,verifyPattern } from './model.mjs';
import { Pool } from './pool.mjs';
import { Progress } from './progress.mjs';
import { qualifyTwo } from './scaling.mjs';
import { forecast } from './forecast.mjs';
import { analyzeSources } from './analyze.mjs';
import { game,pairBootstrap,gameSummary } from './games.mjs';
class Pause extends Error {}
const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i].replace(/^--/,'')]=process.argv[i+1];
const output=resolve(args.output),repository=resolve(args.repository??'.'),old=resolve(args.old),engineering=resolve(args.engineering);
const path=name=>`${output}/${name}.json`,source=sourceDigest(fileURLToPath(new URL('../..',import.meta.url)));
const fit=read(`${engineering}/fit-report.json`),benchmark=read(`${engineering}/benchmark.json`),pilot=read(`${engineering}/pilot.json`);
for(const artifact of [fit,benchmark,pilot]){const {checksum,...body}=artifact;if(hash(body)!==checksum)throw Error('Engineering artifact checksum mismatch');}
if(fit.status!=='qualified'||!pilot.passed||!benchmark.speedPass)throw Error('Engineering qualification incomplete');
const L=read(`${engineering}/L.json`),P=read(`${engineering}/P.json`);verifyLinear(L);verifyPattern(P);
if(L.checksum!==fit.linear.checksum||P.checksum!==fit.pattern.checksum||benchmark.L!==L.checksum||benchmark.P!==P.checksum)throw Error('Engineering model identity mismatch');
const eligibleP=fit.admission.oldDevelopment&&benchmark.speedPass,models={B:'B',L,...(eligibleP?{P}:{})};
const qualification=read(`${repository}/.local-research/teacher-qualification-v4r1-20261028/manifest.json`),pin=identity(qualification.pin.binary,qualification.pin.evalFile,{buildFile:qualification.pin.experimental.buildFile});
if(hash(pin)!==hash(qualification.pin)||qualification.status!=='complete'||!Object.values(qualification.gates).every(Boolean))throw Error('Qualified teacher changed');verifyPreflight(qualification.adapterPreflightPath,pin);
const runIdentity=hash({source,protocol:PROTOCOL,pin,fit:fit.checksum,benchmark:benchmark.checksum,pilot:pilot.checksum,models:Object.fromEntries(Object.entries(models).map(([k,m])=>[k,m==='B'?'B':m.checksum]))});
let state=existsSync(path('manifest'))?read(path('manifest')):{version:1,status:'created',stage:'initialize',created:new Date().toISOString(),source,runIdentity,pin,protocolHash:hash(PROTOCOL),models:Object.fromEntries(Object.entries(models).map(([k,m])=>[k,m==='B'?'B':m.checksum])),elapsedMs:0,counts:{},configuredWorkers:Number(args.workers??2),sessions:[]};
if(state.runIdentity!==runIdentity)throw Error('Frozen execution/protocol/teacher/model identity changed');
if(['complete','positional-gate-failed'].includes(state.status)){console.log('Completed experiment; no work repeated');process.exit(0);}
if(state.status==='failed')throw Error('Failed run preserved; a bounded audited engineering repair is required');
const unlock=writerLock(`${output}/writer.lock`),started=performance.now(),prior=state.elapsedMs;
const bootId=existsSync('/proc/sys/kernel/random/boot_id')?readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim():null;
const recovery=state.status==='running'?(state.bootId===bootId?Math.max(0,uptime()*1000-(state.heartbeatBootMs??0)):PROTOCOL.workerTaskCapMs):0;
let stopped=false,pool=null,workers=1,resourceAt=0,keys=null,owners=new Map(),historicalSeeds=new Set(),independenceCollisions=[];
const progress=new Progress(output,state,()=>pool),event=(name,fields={})=>progress.emit(name,fields);
const elapsed=()=>prior+recovery+performance.now()-started;
function checkpoint(){state.elapsedMs=elapsed();state.updated=new Date().toISOString();state.pid=process.pid;state.bootId=bootId;state.heartbeatBootMs=uptime()*1000;
  state.actualPool=pool?.slots.length??0;state.activeTasks=pool?.active.size??0;state.activeLabelTasks=[...(pool?.active.values()??[])].filter(t=>t.type==='label').length;
  state.rssBytes=process.memoryUsage().rss;state.nodeMaxRssBytes=process.resourceUsage().maxRSS*1024;state.nodeCpu=process.cpuUsage();atomic(path('manifest'),state);}
function check(cost=0){if(stopped)throw new Pause('Graceful pause requested');if(elapsed()+cost+PROTOCOL.reportingReserveMs+PROTOCOL.sessionDrainReserveMs>PROTOCOL.experimentCapMs)throw new Pause('Eight-hour active computation ceiling protected');if(freemem()<768*2**20)throw new Pause('WSL free-memory reserve');}
const stage=name=>{state.stage=name;checkpoint();event('stage',{name,activeMinutes:elapsed()/60000});};
const telemetry=r=>appendFileSync(`${output}/tasks-telemetry.jsonl`,JSON.stringify({at:new Date().toISOString(),...r})+'\n');
const setPool=n=>{workers=n;pool=new Pool(n,output,runIdentity,{check:()=>check(PROTOCOL.workerTaskCapMs),event,telemetry});};
async function resources(force=false,{timed=false}={}) {
  if(!force&&performance.now()-resourceAt<60000)return;
  global.gc?.();
  const r=spawnSync('python3',[`${repository}/scripts/next-residual/launch.py`,'--output',output,'--resources-only'],{encoding:'utf8',timeout:40000});
  if(r.status!==0)throw new Pause(`Resource preflight failed: ${r.stderr}`);
  const value=JSON.parse(r.stdout);resourceAt=performance.now();appendFileSync(`${output}/resource-history.jsonl`,JSON.stringify({...value,actualPool:pool?.slots.length??0,configuredWorkers:state.configuredWorkers})+'\n');
  state.resources=value;if(value.blockers.length)throw new Pause(value.blockers.join('; '));
  if(timed){checkpoint();return;}
  if(value.limitingAvailableGiB<1.5)throw new Pause('Physical-memory free reserve below 1.5 GiB');
  const safe=Math.min(2,state.configuredWorkers,value.workers);
  if(safe<1)throw new Pause('Insufficient physical-memory headroom for one worker');
  // Fresh two-worker engineering scaling is required before using that pool.
  if(safe>=2&&!state.scaling){if(pool?.active.size)throw new Pause('Drain before fresh two-worker qualification');await pool?.close();pool=null;state.scaling=await qualifyTwo(output,runIdentity,{check:()=>check(180000),event,telemetry});}
  const useful=Math.min(safe,state.scaling?.useful?2:1);
  if(!pool||useful!==workers){if(pool?.active.size)throw new Pause('Drain active tasks before changing pool');const previous=pool?.slots.length??0;await pool?.close();setPool(useful);event('workers-adjusted',{configured:state.configuredWorkers,safeCap:value.workers,previousPool:previous,actualPool:useful,limitingAvailableGiB:value.limitingAvailableGiB,reason:useful<safe?'Measured two-worker throughput did not qualify':'Physical-memory reserve and measured throughput'});}
  checkpoint();
}
process.on('SIGINT',()=>{stopped=true;});process.on('SIGTERM',()=>{stopped=true;});
const heartbeat=setInterval(checkpoint,10000);heartbeat.unref();
function receiptResult(name){const r=read(`${output}/tasks/${name}.json`);if(r.runIdentity!==runIdentity||r.inputHash!==hash({job:r.job,runIdentity})||r.resultHash!==hash(r.result))throw Error(`Task identity mismatch: ${name}`);return r.result;}
function verifyStored(name){const r=read(path(name)),{checksum,...body}=r;if(hash(body)!==checksum||r.runIdentity!==runIdentity)throw Error(`Artifact identity mismatch: ${name}`);return r;}
function store(name,body){const r={...body,runIdentity};r.checksum=hash(r);atomic(path(name),r);return r;}
function panelReceipt(root,selector){const id=`main-frontier-${root.id}-${selector}-a${root.attempt}`;return receiptResult(id);}
async function loadIndex(){
  if(keys)return;stage('historical-exclusions');
  if(!existsSync(path('historical-index'))){check(120000);const r=spawnSync(process.execPath,[fileURLToPath(new URL('./build-index.mjs',import.meta.url)),old,output,runIdentity],{encoding:'utf8',timeout:120000,maxBuffer:1000000});if(r.status!==0)throw Error(`Historical index extension failed: ${r.stderr}`);event('historical-index-built',{result:r.stdout.trim()});}
  const saved=read(path('historical-index'));keys=KeyIndex.load(`${output}/historical-index.bin`);
  if(saved.runIdentity!==runIdentity||saved.digest!==keys.digest())throw Error('Historical index identity mismatch');historicalSeeds=new Set(saved.seeds);state.historical={keys:keys.size,digest:saved.digest,delta:saved.delta,inventoryHash:saved.inventoryHash};
  if(existsSync(path('reservation-progress')))for(const root of verifyStored('reservation-progress').roots){const tr=read(`${output}/trajectories/${root.id}.json`),f=root.role==='games'?null:read(`${output}/frontiers/${root.id}.json`).result;verifyTrajectory(tr);
    for(const k of trajectoryKeys(tr,f)){if(keys.has(k)||owners.has(k))throw Error('Reserved trajectory independence mismatch');owners.set(k,root.id);}}
  global.gc?.();checkpoint();
}
async function reserve(design){
  await loadIndex();stage('joint-reservation');let saved=existsSync(path('reservation-progress'))?verifyStored('reservation-progress'):{attempt:0,roots:[],pending:[],rejected:{noRoot:0,collision:0,seed:0}};
  const plan=[...slots('assessment',design.sources),...slots('games',design.primaryPairs+design.shadowPairs)],done=()=>new Set(saved.roots.map(r=>r.id));
  const save=()=>{delete saved.checksum;saved=store('reservation-progress',saved);state.counts.reserved=saved.roots.length;checkpoint();};
  while(plan.some(s=>!done().has(`${s.role}-${s.slot}`))){
    check(180000);await resources();
    if(!saved.pending.length){saved.pending=plan.filter(s=>!done().has(`${s.role}-${s.slot}`)).slice(0,4).map(spec=>({spec,attempt:saved.attempt++}));save();}
    if(saved.attempt>PROTOCOL.maxAttempts)throw new Pause('Frozen admission attempt ceiling reached');
    const results=await parallel(saved.pending,workers,p=>pool.task(`main-generation-${p.attempt}`,{type:'generate',...p}));
    const frontiers=await parallel(results,workers,async(tr,i)=>{
      const spec=saved.pending[i].spec,id=`${spec.role}-${spec.slot}`;
      if(!tr.root||done().has(id)||historicalSeeds.has(tr.seed)||[...trajectoryKeys(tr)].some(k=>keys.has(k)||owners.has(k)))return null;
      if(spec.role==='games')return null;
      const root={...tr.root,...spec,id,seed:tr.seed,attempt:tr.attempt,occupied:tr.target,trajectoryHash:hash(tr)},panels={};
      for(const selector of ['B','L'])panels[selector]=await pool.task(`main-frontier-${id}-${selector}-a${tr.attempt}`,{type:'frontier',root,model:models[selector]});
      return {panels,union:{parents:[...new Map(Object.values(panels).flatMap(f=>f.parents).map(p=>[p.key,p])).values()],lines:Object.values(panels).flatMap(f=>f.lines)}};
    });
    for(let i=0;i<results.length;i++) {
      const tr=results[i],spec=saved.pending[i].spec,id=`${spec.role}-${spec.slot}`;if(done().has(id))continue;
      if(!tr.root){saved.rejected.noRoot++;continue;}if(historicalSeeds.has(tr.seed)){saved.rejected.seed++;continue;}verifyTrajectory(tr);
      const f=frontiers[i];if(spec.role!=='games'&&!f){saved.rejected.collision++;continue;}
      const ks=trajectoryKeys(tr,f?.union);if([...ks].some(k=>keys.has(k)||owners.has(k))){saved.rejected.collision++;continue;}
      const root={...tr.root,...spec,id,seed:tr.seed,attempt:tr.attempt,occupied:tr.target,trajectoryHash:hash(tr)};
      atomic(`${output}/trajectories/${id}.json`,tr);
      if(f)atomic(`${output}/frontiers/${id}.json`,{runIdentity,rootHash:hash(root),result:f.union,resultHash:hash(f.union)});
      saved.roots.push(root);for(const k of ks)owners.set(k,id);save();event('source-admitted',{id,occupied:root.occupied,accepted:saved.roots.length,total:plan.length,attempt:saved.attempt,rejected:saved.rejected});
    }
    saved.pending=[];save();
  }
  const roots=saved.roots.filter(r=>r.role==='assessment').sort((a,b)=>a.slot-b.slot),games=saved.roots.filter(r=>r.role==='games').sort((a,b)=>a.slot-b.slot);
  const body={design,assessment:roots,games,transferIds:transferIds(roots,design.transfer),attempts:saved.attempt,exclusionDigest:keys.digest(),models:state.models};
  const frozen=store('reservations',body);state.reservationDigest=frozen.checksum;checkpoint();event('all-identities-frozen',{checksum:frozen.checksum,sources:roots.length,transfer:frozen.transferIds.length,primaryOpenings:design.primaryPairs,shadowOpenings:design.shadowPairs});return frozen;
}
const pvOwners=new Map();
function auditBoard(board,id,role){
  if(64-counts(board).empty<12)return;
  for(const k of keysFor(board)) {
    const other=owners.get(k)??pvOwners.get(k),historical=keys.has(k);
    if(historical||other&&other!==id)independenceCollisions.push({role,source:id,other:other??'historical',key:k});
    if(!other&&!historical)pvOwners.set(k,id);
  }
}
function auditPV(root,state,result){
  auditBoard(state.board,root.id,'teacher-PV');
  for(const row of result.rows){let board=[...state.board],player=state.player;
    for(const move of [row.move,...(row.pv??[])]){
      if(move===undefined)continue;
      if(move===null){if(legalMoves(board,player).length)throw Error('Fresh teacher illegal pass');}
      else{if(!legalMoves(board,player).includes(move))throw Error('Fresh teacher illegal PV');board=[...play(board,player,move)];}
      auditBoard(board,root.id,'teacher-PV');player=-player;
    }
  }
}
async function labelState(root,id,s){
  const labels={};for(const depth of [10,12]) {
    labels[depth]=await pool.task(`${id}-d${depth}`,{type:'label',pin,state:{board:s.board,player:s.player},depth,timeoutMs:PROTOCOL.queryCapMs,transcript:`${output}/raw/${id}-d${depth}.json`});
    auditPV(root,s,labels[depth]);
  }
  if(counts(s.board).empty<=10)labels.independent=await pool.task(`${id}-exact`,{type:'exact',state:{board:s.board,player:s.player}});
  return labels;
}
async function assess(reservations){
  stage('independent-union-frontier-labeling');const records=[];let completed=0;
  for(let i=0;i<reservations.assessment.length;i+=workers){check(180000);await resources();
    const batch=reservations.assessment.slice(i,i+workers);
    const results=await parallel(batch,workers,async root=>{
      const panels=Object.fromEntries(['B','L'].map(s=>[s,panelReceipt(root,s)]));
      const parents=[...new Map(Object.values(panels).flatMap(f=>f.parents).map(p=>[p.key,p])).values()],labels=[];
      for(let j=0;j<parents.length;j++)labels.push(await labelState(root,`main-label-${root.id}-p${j}`,parents[j]));
      const result={root,panels,labels:Object.fromEntries(['B','L'].map(s=>[s,panels[s].parents.map(p=>labels[parents.findIndex(q=>q.key===p.key)])]))};
      completed++;state.counts.labeled=completed;checkpoint();event('source-labeled',{id:root.id,completed,total:reservations.assessment.length});return result;
    });records.push(...results);
  }
  stage('independent-root-transfer');const rootRows=[];let transferCompleted=0;
  for(let i=0;i<reservations.transferIds.length;i+=workers){check(180000);await resources();
    const batch=reservations.transferIds.slice(i,i+workers).map(id=>reservations.assessment.find(r=>r.id===id));
    const results=await parallel(batch,workers,async root=>{
      const labels=await labelState(root,`main-transfer-${root.id}`,root),values=new Map(labels[12].rows.map(r=>[r.move,r.value])),best=Math.max(...values.values()),rows=[];
      for(const searchDepth of [4,6]) {
        const search={},choice={},regret={},exact={};
        for(const [name,model] of Object.entries(models)) {
          const id=`main-search-${root.id}-${searchDepth}-${name}`;
          const result=await pool.task(id,{type:'root-search',state:{board:root.board,player:root.player},depth:searchDepth,model});
          search[name]={...result,receipt:`tasks/${id}.json`};choice[name]=result.rows[0].move;regret[name]=best-values.get(choice[name]);
          if(labels.independent)for(const convention of ['raw','awarded']) {
            const ref=labels.independent[convention],value=ref.rows.find(r=>r.move===choice[name]).value;
            (exact[convention]??={})[name]={value,regret:ref.value-value,wdlError:Math.sign(value)<Math.sign(ref.value)};
          }
        }
        rows.push({source:root.id,phase:root.phase,policy:root.policy,depth:root.depth,searchDepth,choice,regret,search,exact,
          teacherReceipt:[10,12].map(d=>`tasks/main-transfer-${root.id}-d${d}.json`)});
      }
      transferCompleted++;state.counts.transferred=transferCompleted;checkpoint();event('root-transfer-complete',{id:root.id,completed:transferCompleted,total:reservations.transferIds.length});return rows;
    });rootRows.push(...results.flat());
  }
  stage('paired-source-analysis');const analysisStart=performance.now();
  const independence=store('independence-audit',{collisions:independenceCollisions,passed:!independenceCollisions.length,pvKeys:pvOwners.size,exclusionDigest:keys.digest(),reservationChecksum:reservations.checksum});
  const result=analyzeSources(records,models,reservations.design,rootRows,independence.passed);
  result.modelChecksums=state.models;result.reservationChecksum=reservations.checksum;result.statisticsMs=performance.now()-analysisStart;
  const saved=store('assessment-results',result);state.assessment={checksum:saved.checksum,gates:saved.gates};checkpoint();event('positional-gates',{gates:saved.gates,independenceCollisions:independenceCollisions.length});return saved;
}
function auditGame(opening,result){
  let board=opening.board,player=opening.player;auditBoard(board,opening.id,'game');
  for(const step of result.moves){if(step.player!==player)throw Error('Game replay turn mismatch');
    if(step.move===null){if(legalMoves(board,player).length)throw Error('Game replay illegal pass');}
    else{if(!legalMoves(board,player).includes(step.move))throw Error('Game replay illegal move');board=[...play(board,player,step.move)];}
    auditBoard(board,opening.id,'game');player=-player;
  }
  if(hash(board)!==hash(result.board)||legalMoves(board,1).length||legalMoves(board,-1).length)throw Error('Game replay terminal mismatch');
}
async function tournament(reservations,assessment){
  if(!assessment.gates.L.pass){state.status='positional-gate-failed';return;}
  await pool.close();pool=null;checkpoint();stage('isolated-primary-games');
  const conditions={L80:[],L300:[],P80:[]},n=reservations.design.primaryPairs;
  async function pair(condition,index,opening,candidate,reference,timeMs){
    check(104*timeMs*1.35);await resources(false,{timed:true});
    const name=`confirmation/${condition}-${index}`,identity={openingHash:hash(opening),candidate:candidate.checksum,reference:reference==='B'?'B':reference.checksum,timeMs};
    let saved;
    if(existsSync(path(name))){saved=verifyStored(name);if(hash(saved.identity)!==hash(identity))throw Error('Completed game-pair identity mismatch');}
    else {
      const games=[];for(const color of index%2?[-1,1]:[1,-1]) {
        const partial=`${output}/confirmation/partial-${condition}-${index}-${color}.json`;
        games.push(await game(opening,candidate,reference,color,timeMs,{check:()=>check(),resume:existsSync(partial)?read(partial):null,checkpoint:s=>atomic(partial,s)}));
      }
      saved=store(name,{identity,openingId:opening.id,index,games,points:mean(games.map(g=>g.points))});
    }
    for(const g of saved.games)auditGame(opening,g);
    conditions[condition].push(saved);state.counts.gamePairs=Object.fromEntries(Object.entries(conditions).map(([k,rows])=>[k,rows.length]));checkpoint();event('opening-pair-complete',{condition,index:index+1,points:saved.points,completed:conditions[condition].length,total:condition==='P80'?reservations.design.shadowPairs:n});
  }
  for(let i=0;i<n;i++)for(const timeMs of i%2?[300,80]:[80,300])await pair(`L${timeMs}`,i,reservations.games[i],L,'B',timeMs);
  if(eligibleP&&assessment.gates.P?.pass){stage('isolated-shadow-games');for(let i=0;i<reservations.design.shadowPairs;i++)await pair('P80',i,reservations.games[n+i],P,L,80);}
  const results={};for(const [condition,pairs] of Object.entries(conditions))if(pairs.length){const summary=gameSummary(pairs.flatMap(p=>p.games));results[condition]={pairs:pairs.length,summary,bootstrap:pairBootstrap(pairs.map(p=>p.points)),reference:condition==='P80'?'L':'B'};}
  const independent=!independenceCollisions.length,primaryStronger=independent&&results.L80.bootstrap.lower975>.5&&results.L300.bootstrap.lower975>.5;
  store('game-results',{conditions:results,independenceCollisions,independence:independent,primaryStronger,
    shadowScreenPositive:!!results.P80&&independent&&results.P80.bootstrap.mean>.5&&results.P80.bootstrap.lower95>.5,models:state.models});
  state.games={conditions:Object.fromEntries(Object.entries(results).map(([k,v])=>[k,{pairs:v.pairs,mean:v.bootstrap.mean,interval95:v.bootstrap.interval95}])),independence:independent,primaryStronger};state.status='complete';checkpoint();
}
try {
  state.status='running';state.sessions.push({pid:process.pid,started:new Date().toISOString()});checkpoint();await resources(true);
  const cost=read(`${repository}/docs/data/next-residual-strategy-20261029.json`).prospectiveForecast;
  const forecasts=Object.fromEntries(Object.entries(PROTOCOL.designs).map(([name,design])=>[name,forecast(design,pilot,cost,fit.elapsedMs,workers,state.scaling?.safeSpeedup??1,{elapsedMs:elapsed()})]));
  if(!state.design){const choice=forecasts.expanded.comfortable?'expanded':forecasts.fallback.comfortable?'fallback':null;
    store('pre-experiment-forecast',{forecasts,chosen:choice,actualWorkers:workers,safeCap:state.resources.workers});
    if(!choice){state.status='cost-infeasible';event('no-feasible-complete-protocol',{forecasts});}
    else {state.design={name:choice,...PROTOCOL.designs[choice]};store('protocol',{protocol:PROTOCOL,design:state.design,models:state.models,teacher:pin,fitChecksum:fit.checksum,benchmarkChecksum:benchmark.checksum,pilotChecksum:pilot.checksum});checkpoint();event('protocol-chosen',{design:state.design,hours:forecasts[choice].totalMs/3600000,actualWorkers:workers});}
  }
  if(state.design){
    const reservations=await reserve(state.design);
    const finalForecast=forecast(state.design,pilot,cost,0,workers,state.scaling?.safeSpeedup??1,{elapsedMs:elapsed(),reservedAssessment:state.design.sources,reservedGames:state.design.primaryPairs+state.design.shadowPairs});
    store('reserved-forecast',{forecast:finalForecast,reservationChecksum:reservations.checksum});
    if(!finalForecast.feasible)throw new Pause('Frozen complete protocol no longer fits; no new assessment label opened');
    const assessment=await assess(reservations);await tournament(reservations,assessment);
  }
}catch(error){
  if(error instanceof Pause){state.status='paused';state.pauseReason=error.message;event('normal-resumable-pause',{reason:error.message});}
  else{state.status='failed';state.error=error.stack;event('failure',{error:error.stack});process.exitCode=1;}
}finally{await pool?.close();pool=null;checkpoint();clearInterval(heartbeat);event('run-stopped',{status:state.status,elapsedMinutes:state.elapsedMs/60000,counts:state.counts});progress.close();unlock();}
