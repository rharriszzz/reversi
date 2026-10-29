#!/usr/bin/env node
import assert from 'node:assert/strict';
import {existsSync,appendFileSync,mkdirSync,readFileSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {atomic,read} from '../research/io.mjs';
import {PROTOCOL,hash,assessmentSlots,gameSchedule} from './protocol.mjs';
import {frozenModels} from './models.mjs';
import {inventory,sha,resource,admissionKeys,terminal} from './execution.mjs';
import {Pool} from './pool.mjs';
import {KeyIndex} from '../residual/index.mjs';
import {keysFor,verifyTrajectory} from '../residual/data.mjs';
import {pinFor} from '../machine-benchmark/suite.mjs';
import {compile} from '../next-residual/model.mjs';
import {findBestMove} from '../../src/search.js';
import {playGame,replay} from './game.mjs';
import {legalMoves,play} from '../../src/rules.js';
import {analyze} from './analyze.mjs';
const [mode,historyArg,preflightArg,outputArg]=process.argv.slice(2);
assert.ok(['prepare','execute','analyze'].includes(mode));
const history=resolve(historyArg),preflight=resolve(preflightArg),output=resolve(outputArg);mkdirSync(output,{recursive:true});
const h=read(`${history}/manifest.json`),p=read(`${preflight}/preflight.json`),models=frozenModels();
for(const r of [h,p]){const {checksum,...b}=r;assert.equal(hash(b),checksum);}
assert.equal(p.historyChecksum,h.checksum);assert.ok(p.qualified);assert.equal(hash(inventory()),p.source,'Source changed since complete preflight');
const pin=pinFor('.local-research/machine-benchmark-teacher-mac-aligned/fixed/build.json','.local-research/machine-benchmark-teacher-mac-aligned/eval.dat');
assert.equal(pin.binarySha,'643b4a39dea9d85f3a862c37510c90e70188f0b7f02b37bde693841746c8f1c2');
const prereg={protocol:PROTOCOL,source:p.source,history:h.checksum,preflight:p.checksum,pin,models:PROTOCOL.models};
const identity=hash(prereg),statePath=`${output}/state.json`,start=performance.now();
let state=existsSync(statePath)?read(statePath):{status:'created',identity,elapsedMs:0,stage:'created',created:new Date().toISOString(),counts:{}};
assert.equal(state.identity,identity);if(state.status==='complete'){console.log('Complete fixed experiment; no scientific work repeated. Use verify-run.mjs for read-only verification.');process.exit(0);}const prior=state.elapsedMs+(state.status==='running'?Math.min(180000,Math.max(0,Date.now()-Date.parse(state.updated))):0),resources=[],owners=new Map(),seeds=new Set([...h.seeds,...p.seeds]);
const priorCpu=state.cpuTotal??{user:0,system:0};
let pool=null,stopped=false,lastResource=0;
const elapsed=()=>prior+performance.now()-start;
function checkpoint(){state.elapsedMs=elapsed();state.updated=new Date().toISOString();state.pid=process.pid;state.cpu=process.cpuUsage();state.cpuTotal={user:priorCpu.user+state.cpu.user,system:priorCpu.system+state.cpu.system};state.maxRssBytes=process.resourceUsage().maxRSS*1024;atomic(statePath,state);}
function event(name,fields={}){appendFileSync(`${output}/events.jsonl`,JSON.stringify({at:new Date().toISOString(),event:name,elapsedMs:elapsed(),...fields})+'\n');console.log(JSON.stringify({event:name,...fields}));checkpoint();}
function check(cost=0){if(stopped)throw Error('Execution interrupted; completed receipts retained');if(elapsed()+cost+PROTOCOL.resources.reportingReserveMs>PROTOCOL.resources.scientificCapMs)throw Error('Four-hour ceiling/reporting reserve protected');}
function resourcesNow(force=false){if(!force&&performance.now()-lastResource<60000)return state.resources;const r=resource(),old=state.resources;lastResource=performance.now();if(old){const seconds=(Date.parse(r.at)-Date.parse(old.at))/1000;r.swapInPagesPerSecond=seconds>0?(r.swapins-old.swapins)/seconds:0;r.swapOutPagesPerSecond=seconds>0?(r.swapouts-old.swapouts)/seconds:0;assert.ok(Math.max(r.swapInPagesPerSecond,r.swapOutPagesPerSecond)<256,'Sustained swap activity');}r.configuredWorkers=6;r.actualWorkers=pool?.slots.length??0;r.activeTasks=pool?.active.size??0;
 appendFileSync(`${output}/resources.jsonl`,JSON.stringify(r)+'\n');state.resources=r;
 assert.ok(r.availableGiB>=1.5,'Physical-memory reserve');assert.ok(r.safeCap>=Math.max(1,pool?.slots.length??0),'Active pool exceeds fresh physical-memory cap');return r;}
const telemetry=r=>appendFileSync(`${output}/tasks.jsonl`,JSON.stringify({at:new Date().toISOString(),...r})+'\n');
function makePool(dir,id){const r=resourcesNow(true),n=Math.min(6,r.safeCap);state.actualWorkers=n;pool=new Pool(n,dir,id,{check:()=>{check(180000);resourcesNow();},event,telemetry});return pool;}
function store(name,body){const path=`${output}/${name}.json`,full={...body,identity};const result={...full,checksum:hash(full)};if(existsSync(path)){assert.deepEqual(read(path),result,'Immutable scientific artifact');return read(path);}atomic(path,result);return result;}
const index=KeyIndex.load(`${history}/membership.bin`),eng=KeyIndex.load(`${preflight}/engineering-keys.bin`);assert.equal(index.digest(),h.digest);assert.equal(eng.digest(),p.engineeringDigest);
const historical=k=>index.has(k)||eng.has(k);
function conflict(ks,id){for(const key of ks)if(historical(key)||owners.has(key)&&owners.get(key)!==id)return {key,other:historical(key)?'historical':owners.get(key)};return null;}
const sampleProtocol={namespace:PROTOCOL.namespace,strata:PROTOCOL.assessment.strata,commonPrefixBoundary:12};
const schedule=gameSchedule(),plan=[...assessmentSlots(),...Array.from({length:32},(_,i)=>({role:'exact',slot:i,phase:3,policy:PROTOCOL.assessment.policies[i%2],depth:6,occupied:54,parity:0,player:1})),...Array.from({length:96},(_,i)=>({role:'games',slot:i,phase:0,policy:schedule.find(r=>r.family===i).policy,depth:4,occupied:12+i%2,parity:i%2,player:i%2?-1:1}))];
process.on('SIGINT',()=>{stopped=true;});process.on('SIGTERM',()=>{stopped=true;});
const lock=`${output}/writer.lock`;if(existsSync(lock)){const pid=read(lock).pid;try{process.kill(pid,0);throw Error(`Active scientific writer ${pid}`);}catch(e){if(e.code!=='ESRCH')throw e;}unlinkSync(lock);}
const fd=openSync(lock,'wx');closeSync(fd);atomic(lock,{pid:process.pid});
try{
 state.status='running';resourcesNow(true);checkpoint();
 if(mode==='prepare'){
  store('preregistration',prereg);state.stage='joint-reservation';
  let reservation=existsSync(`${output}/admission-progress.json`)?read(`${output}/admission-progress.json`):{identity,attempt:0,roots:[],rejected:[],pending:[]};assert.equal(reservation.identity,identity);
  for(const root of reservation.roots){const tr=read(`${output}/trajectories/${root.id}.json`);verifyTrajectory(tr);const fs=root.diagnostic?read(`${output}/frontiers/${root.id}.json`):[];for(const k of admissionKeys(tr,fs).all)owners.set(k,root.id);seeds.add(root.seed);}
  makePool(`${output}/admission`,identity);
  while(reservation.roots.length<plan.length){check(180000);const completed=new Set(reservation.roots.map(r=>r.id));
   if(!reservation.pending.length){reservation.pending=plan.filter(s=>!completed.has(`${s.role}-${s.slot}`)).slice(0,pool.slots.length).map(spec=>({spec,attempt:reservation.attempt++}));atomic(`${output}/admission-progress.json`,reservation);}
   assert.ok(reservation.attempt<=100000,'Frozen maximum admission attempts');
   const generated=await Promise.all(reservation.pending.map(({spec,attempt})=>pool.task(`generate-${attempt}`,{type:'generate',spec,attempt,protocol:sampleProtocol})));
   for(let i=0;i<generated.length;i++){
    const tr=generated[i],{spec,attempt}=reservation.pending[i],id=`${spec.role}-${spec.slot}`;
    let reason=!tr.root?{reason:'no-root'}:seeds.has(tr.seed)?{reason:'seed-reuse'}:null;
    if(!reason){verifyTrajectory(tr);const c=conflict(admissionKeys(tr).all,id);if(c)reason={reason:'historical-or-shared-ancestry',...c};}
    let fs=[];
    const root=tr.root?{...tr.root,...spec,id,seed:tr.seed,attempt,occupied:tr.target,trajectoryHash:hash(tr),family:id}:null;
    if(!reason&&spec.diagnostic){fs=await Promise.all(['B','L','P'].map(name=>pool.task(`frontier-${id}-${name}-a${attempt}`,{type:'frontier',root,model:models[name]})));for(const f of fs)for(const line of f.lines)assert.ok(line.terminal||line.rootLeafObserved||terminal(line.endpoint.board),'Retained frontier requires an observed active leaf');const c=conflict(admissionKeys(tr,fs).all,id);if(c)reason={reason:'frontier-direct-state',...c};}
    if(reason){reservation.rejected.push({id,attempt,seed:tr.seed,...reason,wallMs:tr.wallMs});continue;}
    for(const k of admissionKeys(tr,fs).all)owners.set(k,id);seeds.add(tr.seed);atomic(`${output}/trajectories/${id}.json`,tr);if(spec.diagnostic)atomic(`${output}/frontiers/${id}.json`,fs);
    reservation.roots.push(root);event('source-admitted',{id,accepted:reservation.roots.length,total:256,attempt:reservation.attempt,rejected:reservation.rejected.length});
   }
   reservation.pending=[];atomic(`${output}/admission-progress.json`,reservation);
  }
  await pool.close();pool=null;state.actualWorkers=0;const remaining=p.forecast.requiredMs;assert.ok(elapsed()+remaining<=PROTOCOL.resources.scientificCapMs,'Measured reservation plus complete remaining forecast does not fit');
  const roots=plan.map(s=>reservation.roots.find(r=>r.id===`${s.role}-${s.slot}`));
  const frozen=store('reservations',{roots,schedule,attempts:reservation.attempt,rejections:reservation.rejected.length,historyDigest:h.digest,engineeringDigest:p.engineeringDigest});
  const launch=store('launch',{preregistration:hash(prereg),reservationChecksum:frozen.checksum,source:p.source,teacher:pin,models:PROTOCOL.models,forecast:p.forecast,elapsedBeforeGamesMs:elapsed(),at:new Date().toISOString()});
  state.launch=launch.checksum;state.status='reserved';event('all-identities-frozen',{reservation:frozen.checksum,launch:launch.checksum,roots:128,exact:32,families:96});
 }else{
  const frozen=read(`${output}/reservations.json`),launch=read(`${output}/launch.json`);for(const r of [frozen,launch]){const {checksum,...b}=r;assert.equal(hash(b),checksum);assert.equal(r.identity,identity);}assert.equal(launch.reservationChecksum,frozen.checksum);assert.equal(state.launch,launch.checksum);
  const rootById=new Map(frozen.roots.map(r=>[r.id,r]));
  if(mode==='execute'){
   state.stage='serial-games';state.actualWorkers=0;assert.ok(!pool);const warmRoots=read('docs/data/next-residual-results-20261029.json').reservedRootIdentities.slice(0,16);
   const gameRows=[];
   for(let i=0;i<frozen.schedule.length;i++){
    const condition=frozen.schedule[i],{family,candidate,color,timeMs}=condition,opening=rootById.get(`games-${family}`),path=`${output}/games/game-${i}.json`;
    if(existsSync(path)){const saved=read(path);assert.equal(saved.identity,hash({launch:launch.checksum,condition,opening}));assert.equal(saved.resultHash,hash(saved.result));gameRows.push(saved.result);continue;}
    check(52*(timeMs+1)+1000);resourcesNow();
    if(i%2===0)for(const name of ['B','L','P']){const evaluate=compile(models[name]).evaluate;for(const r of warmRoots)findBestMove(r.board,r.player,3,undefined,{evaluate});}
    const checkpointPath=`${output}/games/checkpoint-${i}.json`,resume=existsSync(checkpointPath)?read(checkpointPath):null;
    const started=performance.now(),result=await playGame(opening,models[candidate],color,timeMs,{resume,checkpoint:s=>atomic(checkpointPath,s),check:()=>check()});
    assert.deepEqual(replay(opening,result.moves,{complete:true}).board,result.board);
    const body={identity:hash({launch:launch.checksum,condition,opening}),launch:launch.checksum,condition,openingId:opening.id,result,resultHash:hash(result),wallMs:performance.now()-started,committed:new Date().toISOString()};atomic(path,{...body,checksum:hash(body)});gameRows.push(result);state.counts.games=gameRows.length;event('scored-game-complete',{index:i+1,total:384,family,candidate,timeMs});
   }
   assert.equal(gameRows.length,384);event('all-games-complete');
   state.stage='fixed-search-and-sealed-labels';makePool(output,launch.checksum);
   const assessment=frozen.roots.filter(r=>r.role==='assessment'),exact=frozen.roots.filter(r=>r.role==='exact');
   await Promise.all(Array.from({length:pool.slots.length},async(_,worker)=>{
    for(let i=worker;i<assessment.length;i+=pool.slots.length){const root=assessment[i];
     for(const depth of [10,12])await pool.task(`root-${root.id}-d${depth}`,{type:'label',pin,state:{board:root.board,player:root.player},depth,transcript:`${output}/sealed/root-${root.id}-d${depth}.json`});
     if(64-root.occupied<=12)await pool.task(`exact-${root.id}`,{type:'exact',state:root});
     if(root.diagnostic){const fs=read(`${output}/frontiers/${root.id}.json`),parents=[...new Map(fs.flatMap(f=>f.parents).map(p=>[hash({board:p.board,player:p.player}),p])).values()];
      for(let j=0;j<parents.length;j++){const parent=parents[j];for(const depth of [10,12])await pool.task(`frontier-${root.id}-p${j}-d${depth}`,{type:'label',pin,state:{board:parent.board,player:parent.player},depth,transcript:`${output}/sealed/frontier-${root.id}-p${j}-d${depth}.json`});
       if(64-parent.occupied<=12)await pool.task(`frontier-exact-${root.id}-p${j}`,{type:'exact',state:{board:parent.board,player:parent.player}});
      }
     }
     event('sealed-source-labeled',{id:root.id});
    }
   }));
   await Promise.all([...assessment,...exact].map(async root=>{
    if(root.role==='exact')await pool.task(`exact-${root.id}`,{type:'exact',state:root});
    for(const name of ['B','L','P'])for(const depth of [4,5,6])await pool.task(`search-${root.id}-${name}-${depth}`,{type:'search',state:{board:root.board,player:root.player},depth,model:models[name]});
   }));
   await pool.close();pool=null;state.actualWorkers=0;event('all-fixed-and-label-tasks-complete');
   state.stage='isolated-timed-root-choices';
   for(const root of [...assessment,...exact])for(const timeMs of [80,300])for(const name of ['B','L','P']){
    check(1000);resourcesNow();const path=`${output}/timed/${root.id}-${name}-${timeMs}.json`,input={launch:launch.checksum,root,name,timeMs};
    if(existsSync(path)){const r=read(path);assert.equal(r.identity,hash(input));assert.equal(r.resultHash,hash(r.result));continue;}
    const evaluate=compile(models[name]).evaluate;for(const r of warmRoots.slice(0,4))findBestMove(r.board,r.player,3,undefined,{evaluate});
    const result=findBestMove(root.board,root.player,14,undefined,{evaluate,timeMs});atomic(path,{identity:hash(input),input,result,resultHash:hash(result),committed:new Date().toISOString()});
   }
   event('all-timed-roots-complete');
  }
  state.stage='independent-replay-overlap-audit-analysis';const summary=await analyze(output,history,preflight,models);store('summary',summary);state.status=summary.integrity?'complete':'integrity-failed';event('scientific-work-finished',{status:state.status,independence:summary.independence});
 }
}catch(e){state.status='stopped';state.error=e.stack;checkpoint();console.error(e);process.exitCode=1;}
finally{await pool?.close();pool=null;state.actualWorkers=0;checkpoint();unlinkSync(lock);}
