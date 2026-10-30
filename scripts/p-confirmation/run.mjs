#!/usr/bin/env node
import assert from 'node:assert/strict';
import {existsSync,appendFileSync,openSync,closeSync,unlinkSync,readFileSync} from 'node:fs';
import {OUT,OLD,read,atomic,checked,sealed,scientificInventory,snapshot,resources,sha} from './common.mjs';
import {PROTOCOL,hash,slots,schedule} from './protocol.mjs';
import {buildHistory,loadExclusions} from './history.mjs';
import {generate,verifyTrajectory} from '../residual/data.mjs';
import {admissionKeys} from '../frozen-player/execution.mjs';
import {frozenModels} from '../frozen-player/models.mjs';
import {compile} from '../next-residual/model.mjs';
import {playGame,replay,gameIdentity} from '../frozen-player/game.mjs';
import {findBestMove} from '../../src/search.js';
const mode=process.argv[2],output=process.argv[3]??OUT;assert.ok(['prepare','execute'].includes(mode));
const q=checked(`${output}/qualification/report.json`),inventory=scientificInventory(),source=hash(inventory),models=frozenModels();assert.equal(q.source,source,'Source changed after qualification');assert.ok(q.passed);
const statePath=`${output}/state.json`,start=performance.now();let state=existsSync(statePath)?read(statePath):{source,status:'created',activeMs:0,counts:{games:0},created:new Date().toISOString()};assert.equal(state.source,source);
const prior=state.activeMs+(state.status==='running'?180000:0);let interrupted=false,lastResource=0;
const elapsed=()=>prior+performance.now()-start;
function save(){state.activeMs=elapsed();state.updated=new Date().toISOString();state.pid=process.pid;state.cpu=process.cpuUsage();state.maxRssBytes=process.resourceUsage().maxRSS*1024;atomic(statePath,state);}
function event(event,fields={}){appendFileSync(`${output}/events.jsonl`,JSON.stringify({at:new Date().toISOString(),event,activeMs:elapsed(),...fields})+'\n');console.log(JSON.stringify({event,...fields}));save();}
function check(){if(interrupted)throw Error('Interrupted: durable receipts and current prefix retained');assert.ok(elapsed()+PROTOCOL.resources.reportReserveMs<PROTOCOL.resources.capMs,'Eight-hour ceiling and reporting reserve protected');}
function sample(force=false){if(!force&&performance.now()-lastResource<60000)return;const r=resources(output,state.resources);lastResource=performance.now();state.resources=r;appendFileSync(`${output}/resources.jsonl`,JSON.stringify(r)+'\n');}
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{interrupted=true;});
const lock=`${output}/writer.lock`;if(existsSync(lock)){const pid=read(lock).pid;try{process.kill(pid,0);throw Error(`Active writer ${pid}`);}catch(e){if(e.code!=='ESRCH')throw e;}unlinkSync(lock);}const fd=openSync(lock,'wx');closeSync(fd);atomic(lock,{pid:process.pid});
try{state.status='running';save();sample(true);
 if(mode==='prepare'){
  state.stage='incremental-history';event('history-start');const h=buildHistory(output),index=loadExclusions(output);event('history-complete',{addedKeys:h.addedKeys,wallMs:h.wallMs});
  const pilot=q.admissionPilot.rows,oldPilot=read(`${OLD}/preflight-final/preflight.json`).rows.filter(r=>r.spec.role==='engineering-game');
  const admissionUnitMs=2*Math.max(...pilot.map(r=>r.wallMs),...oldPilot.map(r=>r.wallMs));
  const overheads=q.games.map(g=>{const r=read(`${output}/qualification/tasks/game-${g.timeMs}-${g.opening.slot??Number(g.opening.id.at(-1))}-${g.color}.json`);return r.wallMs-g.game.moveTimeMs;});
  const perGameOverheadMs=Math.max(250,2*Math.max(...overheads));
  const gameMs=[80,300].reduce((s,b)=>s+(b===80?1536:512)*(Math.max(52*(b+1),1.1*q.gameCosts[b].priorMaxMs,1.1*q.gameCosts[b].freshMaxMs)+perGameOverheadMs),0);
  const components={games:gameMs,admission:768*admissionUnitMs,warmup:1024*480,checkpointReplayStatisticsIndependentAudit:25*60000,sourceAdmissionExclusionBuild:elapsed()};
  const rawMs=Object.values(components).reduce((s,v)=>s+v,0),requiredMs=rawMs*1.35+20*60000;
  const forecast=existsSync(`${output}/forecast.json`)?checked(`${output}/forecast.json`):sealed(`${output}/forecast.json`,{components,admissionUnitMs,perGameOverheadMs,rawMs,contingency:1.35,reportReserveMs:20*60000,requiredMs,capMs:PROTOCOL.resources.capMs,fits:requiredMs<=PROTOCOL.resources.capMs,gameCosts:q.gameCosts,method:'All possible placements plus 1ms each; larger than 1.1x previous and current maximum complete clocked game search; >=250ms or twice maximum fresh checkpoint/start/replay overhead per game. Twice slowest complete game-opening admission pilot per source. Serial, no parallel speedup; prior 480ms warmup/pair; 25min full legal replay, provenance, statistical analysis and separate audit, then 35% contingency and separate 20min report reserve.'});
  event('full-forecast',{requiredMinutes:forecast.requiredMs/60000,fits:forecast.fits});assert.ok(forecast.fits,'Complete experiment fails pre-outcome feasibility; fixed samples must not be shortened');
  const identity=hash({source,protocol:PROTOCOL,history:h.checksum,qualification:q.checksum,forecast:forecast.checksum});
  const owners=new Map(),seeds=new Set(h.seeds),path=`${output}/admission.json`;let progress=existsSync(path)?checked(path):{identity,attempt:0,roots:[],rejected:[]};assert.equal(progress.identity,identity);
  for(const root of progress.roots){const tr=read(`${output}/trajectories/${root.id}.json`);assert.equal(hash(tr),root.trajectoryHash);verifyTrajectory(tr);for(const k of admissionKeys(tr).all){assert.ok(!index.has(k)&&!owners.has(k));owners.set(k,root.id);}seeds.add(root.seed);}
  state.stage='opening-reservation';
  for(const spec of slots().slice(progress.roots.length)){
   for(;;){check();sample();assert.ok(progress.attempt<100000);const attempt=progress.attempt++,id=`games-${spec.family}`,task=`${output}/admission-attempts/${attempt}.json`,tr=existsSync(task)?checked(task).trajectory:generate(spec,attempt,{namespace:PROTOCOL.namespace,strata:[[12,19]],commonPrefixBoundary:12});
    sealed(task,{identity,spec,attempt,trajectory:tr});let reason=!tr.root?'no-root':seeds.has(tr.seed)?'seed-reuse':null,conflict=null,keys;
    if(!reason){verifyTrajectory(tr);keys=admissionKeys(tr).all;for(const k of keys)if(index.has(k)||owners.has(k)){reason='historical-or-shared-ancestry';conflict={key:k,owner:owners.get(k)??'historical'};break;}}
    if(reason){progress.rejected.push({attempt,seed:tr.seed,reason,conflict});const {checksum,...body}=progress;atomic(path,{...body,checksum:hash(body)});continue;}
    const root={...spec,...tr.root,id,seed:tr.seed,attempt,trajectoryHash:hash(tr)};if(spec.reverse){root.board=root.board.map(v=>-v);root.player=-root.player;}
    for(const k of keys)owners.set(k,id);seeds.add(tr.seed);atomic(`${output}/trajectories/${id}.json`,tr);progress.roots.push(root);const {checksum,...body}=progress;atomic(path,{...body,checksum:hash(body)});progress=read(path);
    if(progress.roots.length%16===0)event('families-reserved',{completed:progress.roots.length,total:768,attempts:progress.attempt});break;
   }
  }
  const remainingRaw=components.games+components.warmup+components.checkpointReplayStatisticsIndependentAudit;
  assert.ok(elapsed()+remainingRaw*1.35+20*60000<=PROTOCOL.resources.capMs,'Measured reservation plus complete remaining workload does not fit; stop before outcomes');
  const reservation=sealed(`${output}/reservation.json`,{identity,source,history:h.checksum,protocol:PROTOCOL,roots:progress.roots,schedule:schedule(),attempts:progress.attempt,rejections:progress.rejected.length});
  snapshot(output,inventory);sealed(`${output}/launch.json`,{identity,source,inventory,history:h.checksum,qualification:q.checksum,forecast:forecast.checksum,reservation:reservation.checksum,models:PROTOCOL.models,at:new Date().toISOString(),activeBeforeGamesMs:elapsed()});
  state.status='reserved';event('all-science-frozen',{reservation:reservation.checksum,games:2048,families:768,dualFamilies:256});
 }else{
  const launch=checked(`${output}/launch.json`),reservation=checked(`${output}/reservation.json`);assert.equal(launch.source,source);assert.equal(launch.reservation,reservation.checksum);assert.deepEqual(reservation.schedule,schedule());assert.equal(reservation.roots.length,768);
  const registration=checked('docs/data/p-confirmation-registration-20261029.json');assert.equal(registration.launchChecksum,launch.checksum,'Publish and commit reservation before scored games');
  const independent=read(`${output}/independent-reservation-verification.json`);assert.ok(independent.passed);assert.equal(independent.launch,launch.checksum,'Independent Python reservation audit required before outcomes');
  const warm=read('docs/data/next-residual-results-20261029.json').reservedRootIdentities.slice(0,16);state.stage='serial-scored-games';
  for(const [i,condition] of reservation.schedule.entries()){
   check();sample();const opening=reservation.roots[condition.family];assert.equal(opening.family,condition.family);const identity=hash({launch:launch.checksum,condition,opening}),path=`${output}/games/game-${i}.json`;
   if(existsSync(path)){const r=checked(path);assert.equal(r.identity,identity);assert.equal(hash(r.result),r.resultHash);assert.deepEqual(replay(opening,r.result.moves,{complete:true}).board,r.result.board);continue;}
   if(i%2===0)for(const name of ['B','P']){const evaluate=compile(models[name]).evaluate;for(const r of warm)findBestMove(r.board,r.player,3,undefined,{evaluate});}
   const checkpoint=`${output}/games/prefix-${i}.json`,resume=existsSync(checkpoint)?checked(checkpoint):null;if(resume){assert.equal(resume.launch,launch.checksum);assert.equal(resume.condition,identity);event('validated-resume-request',{index:i,prefixMoves:resume.game.moves.length});}
   const t=performance.now(),result=await playGame(opening,models.P,condition.color,condition.timeMs,{resume:resume?.game,check,checkpoint:game=>{const body={launch:launch.checksum,condition:identity,game};atomic(checkpoint,{...body,checksum:hash(body)});}});
   assert.equal(result.identity,gameIdentity(opening,models.P,condition.color,condition.timeMs));assert.deepEqual(replay(opening,result.moves,{complete:true}).board,result.board);
   sealed(path,{identity,launch:launch.checksum,condition,result,resultHash:hash(result),wallMs:performance.now()-t,committed:new Date().toISOString()});state.counts.games=i+1;state.lastCheckpoint=new Date().toISOString();
   event('game-complete',{completed:i+1,total:2048,family:condition.family,timeMs:condition.timeMs,remaining:2047-i});
  }
  state.status='games-complete';state.stage='awaiting-provenance-and-independent-audit';event('all-games-complete',{completed:2048});
 }
}catch(e){state.status='stopped';state.error=e.stack;event('stopped',{error:e.message});process.exitCode=1;}finally{save();unlinkSync(lock);}
