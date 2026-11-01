#!/usr/bin/env node
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,openSync,closeSync,unlinkSync,appendFileSync,readFileSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {OUT,PUBLIC,read,atomic,sealed,checked,hash,fileSha,ledger,checkTime,resources,qualification,history,sources,snapshot,verifySources,players,CAP_MS,RESERVE_MS,START} from './tournament-common.mjs';
import {TOURNAMENT,slots,schedule,requireRegistration} from './prospective-protocol.mjs';
import {priorEvidence} from './prior.mjs';
import {gunzipSync} from 'node:zlib';
import {generate,verifyTrajectory,keysFor} from '../residual/data.mjs';
import {admissionKeys,terminal} from '../frozen-player/execution.mjs';
import {PROTOCOL as INNER_GAME_PROTOCOL} from '../native-v2/protocol.mjs';
import {playGame,replay} from '../native-v2/game.mjs';
import {legalMoves,play} from '../../src/rules.js';
import {KeyIndex} from '../residual/index.mjs';
const mode=process.argv[2];assert.ok(['fixture','prepare','execute'].includes(mode),'fixture | prepare | execute');
mkdirSync(OUT,{recursive:true});mkdirSync(PUBLIC,{recursive:true});
const lock=resolve(OUT,'writer.lock');if(existsSync(lock)){const pid=read(lock).pid;let alive=true;try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH')alive=false;else throw e;}assert.ok(!alive,`Writer active: ${pid}`);unlinkSync(lock);}const fd=openSync(lock,'wx');closeSync(fd);atomic(lock,{pid:process.pid});
let interrupted=false;for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{interrupted=true;});
const check=()=>{checkTime();assert.ok(!interrupted,'Interrupted: retain incomplete experiment');};
const event=(stage,extra={})=>{ledger(stage,extra);console.log(JSON.stringify({stage,...extra}));};
try{
 check();event(`${mode}-start`);const q=qualification(),receipt=q.build;
 if(mode==='fixture'){
  assert.ok(!existsSync(resolve(OUT,'fixtures.json')),'Fixtures immutable');const times=[],attempts=[];
  for(const [i,spec] of slots().slice(0,4).entries()){const t=performance.now(),tr=generate(spec,i,{namespace:TOURNAMENT.namespace+'-disclosed-fixture',strata:[[12,19]],commonPrefixBoundary:12});if(tr.root)verifyTrajectory(tr);attempts.push(tr);times.push(performance.now()-t);}
  const warm=[],queries=[],games=[],hello=[],opening=q.roots[13];
  for(let i=0;i<2;i++){
   const start=performance.now(),p=await players(receipt,i);warm.push(performance.now()-start);hello.push(p.hello);
   try{if(i===0)for(const [j,r] of q.roots.entries())for(const model of j%2?['P','B']:['B','P']){const v=await p.engines[model].search(r.board,r.player,{model,timeMs:300});queries.push({root:r.id,model,interfaceMs:v.interfaceMs,elapsedMs:v.elapsedMs,depth:v.depth});}
    const t=performance.now(),g=await playGame(p.engines,opening,{color:i?-1:1,timeMs:300,check,checkpoint:v=>atomic(resolve(OUT,`fixture-prefix-${i}.json`),v)});games.push({opening,result:g,wallMs:performance.now()-t});
   }finally{Object.values(p.engines).forEach(e=>e.close());}
  }
  const io=[];for(let i=0;i<100;i++){const t=performance.now();atomic(resolve(OUT,'fixture-scratch.json'),{disclosed:true,padding:'x'.repeat(128000)});io.push(performance.now()-t);}
  const pair=sealed(resolve(OUT,'fixture-pair.json'),{fixture:true,games});assert.deepEqual(checked(resolve(OUT,'fixture-pair.json')),pair);
  const fixture=sealed(resolve(OUT,'fixtures.json'),{nonconfirmation:true,namespace:TOURNAMENT.namespace+'-disclosed-fixture',attempts,games,hello,queries,generationMs:times,warmupMs:warm,atomic128KBMs:io,executableSha256:receipt.executableSha256});
  // All new disclosed development positions are conservatively excluded.
  const keys=new Set();for(const tr of attempts){if(tr.root)for(const k of admissionKeys(tr).all)keys.add(k);else for(const s of tr.history)for(const k of keysFor(s.board))keys.add(k);}
  for(const {opening,result} of games){let b=opening.board,p=opening.player;for(const m of result.moves){if(!terminal(b))for(const k of keysFor(b))keys.add(k);if(m.move!==null)b=play(b,p,m.move);p=-p;}}
  KeyIndex.from(keys).save(resolve(OUT,'fixture-keys.bin'));copyFileSync(resolve(OUT,'fixtures.json'),resolve(PUBLIC,'fixtures.json'));event('disclosed-fixtures-complete',{fixture:fixture.checksum,games:games.length,additionalExcludedKeys:keys.size});
 }else if(mode==='prepare'){
  const f=checked(resolve(OUT,'fixtures.json')),tests=checked(resolve(OUT,'development-verification.json'));assert.ok(tests.passed);assert.equal(tests.fixture,f.checksum);
  const h=history(),fixtureIndex=KeyIndex.load(resolve(OUT,'disclosed-development-keys.bin'));event('inventory-verified',{keys:h.index.size,sha256:h.binding.indexSha256});
  const prior=read('docs/data/phase-a-provenance/forecast.json'),components={...prior.componentsMinutes};
  const oldGames=JSON.parse(gunzipSync(readFileSync('docs/data/phase-a-tournament/games.json.gz'))),mi=oldGames.telemetryColumns.indexOf('measuredMs');
  const oldSearchMs=oldGames.games.reduce((a,g)=>a+g.telemetry.reduce((b,row)=>b+row[mi],0),0),calibration=checked(resolve(OUT,'calibration.json'));
  // Actual complete-game expenditure captures solved endgames. Scale the previous
  // full 512-game measured search by 300/80, compare with the slower disclosed
  // complete 300-ms opening game, and add 10% before the required 35% contingency.
  const perGameSearchMs=Math.max(oldSearchMs/512*300/80,...calibration.games.map(g=>g.result.moveTimeMs));
  components.search=512*1.10*perGameSearchMs/60000;
  components.startupWarmup=512*2*Math.max(...f.warmupMs,...prior.startupWarmupMs)/60000;
  components.checkpointIO=512*106*2*Math.max(...f.atomic128KBMs)/60000;
  const raw=Object.values(components).reduce((a,b)=>a+b,0),spent=ledger('pre-admission-forecast')/60000,required=1.35*raw+15;
  const forecast=sealed(resolve(OUT,'forecast-before-admission.json'),{componentsMinutes:components,rawMinutes:raw,contingency:1.35,reserveMinutes:15,requiredRemainingMinutes:required,spentMinutes:spent,capMinutes:240,fits:spent+required<=240,fixture:f.checksum,priorForecastSha256:fileSha('docs/data/phase-a-provenance/forecast.json'),searchForecast:{oldSearchMs,scaledPriorMinutes:oldSearchMs*300/80/60000,calibrationMoveTimeMs:calibration.games.map(g=>g.result.moveTimeMs),perGameSearchMs,additionalSearchPadding:1.10,all52MovesAtDeadlineMinutes:512*52*301/60000,hardWorstCase:false},method:'Measured complete-game extrapolation (not a mathematical runtime upper bound), slower of prior full-study search scaled 300/80 and max disclosed full opening-game search, plus 10% search padding before 35% full contingency. Retain all original non-search allowances. Fresh maximum 128KB atomic write+file/directory fsync, twice per possible step; worst fresh 300ms IPC query >=301ms; twice worst B/P process startup and symmetric 16-root D3 warmup per game. Entire original 35% allowance and 15min reporting reserve. All new preparation charged.'});
  event('forecast',{spentMinutes:spent,requiredRemainingMinutes:required,fits:forecast.fits});assert.ok(forecast.fits,'Full remaining forecast exceeds new allowance; no scored games');
  const additional=priorEvidence(),owners=new Map(),seeds=new Set([...h.seeds,...f.attempts.map(r=>r.seed),...read(resolve(OUT,'development-test-trajectories.json')).map(r=>r.seed)]),roots=[],rejections=[];let attempt=0;
  assert.ok(!existsSync(resolve(OUT,'registration.json')),'Already registered');const prepareStart=performance.now();
  for(const spec of slots())for(;;){
   check();assert.ok(performance.now()-prepareStart<12*60000,'Source admission 12-minute allowance exceeded');assert.ok(attempt<100000);
   const tr=generate(spec,attempt,{namespace:TOURNAMENT.namespace,strata:[[12,19]],commonPrefixBoundary:12}),id=`games-${spec.family}`;let reason=!tr.root?'no-root':seeds.has(tr.seed)?'seed-reuse':null,conflict=null,keys;
   if(!reason){verifyTrajectory(tr);keys=admissionKeys(tr).all;for(const key of keys)if(h.index.has(key)||additional.index.has(key)||fixtureIndex.has(key)||owners.has(key)){reason='historical-or-mutual-exclusion';conflict={key,owner:owners.get(key)??(fixtureIndex.has(key)?'disclosed-fixture':additional.index.has(key)?'previous-80ms-study':'historical')};break;}}
   const a=sealed(resolve(OUT,`attempts/${attempt}.json`),{attempt,spec,seed:tr.seed,trajectory:tr,decision:reason?'rejected':'accepted',reason,conflict});attempt++;
   if(reason){rejections.push({attempt:tr.attempt,seed:tr.seed,reason,conflict,receipt:a.checksum});continue;}
   const root={...spec,...tr.root,id,seed:tr.seed,attempt:tr.attempt,trajectoryHash:hash(tr),attemptReceipt:a.checksum};if(spec.reverse){root.board=root.board.map(v=>-v);root.player=-root.player;}
   atomic(resolve(OUT,`trajectories/${id}.json`),tr);for(const key of keys)owners.set(key,id);seeds.add(tr.seed);roots.push(root);
   if(roots.length%16===0)event('admission-progress',{families:roots.length,attempts:attempt});break;
  }
  const remainingComponents={search:components.search,startupWarmup:components.startupWarmup,checkpointIO:components.checkpointIO,independentReservationAudit:3,replayRoleAuditStatistics:15};
  const remainingRaw=Object.values(remainingComponents).reduce((a,b)=>a+b,0),spentNow=ledger('source-admission-complete',{families:256,attempts:attempt})/60000;
  const finalForecast=sealed(resolve(OUT,'forecast-before-registration.json'),{componentsMinutes:remainingComponents,rawMinutes:remainingRaw,requiredRemainingMinutes:1.35*remainingRaw+15,spentMinutes:spentNow,capMinutes:240,fits:spentNow+1.35*remainingRaw+15<=240});assert.ok(finalForecast.fits,'Remaining complete study does not fit');
  const src=sources();snapshot(src);const registration=sealed(resolve(OUT,'registration.json'),{format:'phase-a-m4-tournament-registration-v1',status:'registered',at:new Date().toISOString(),parent:'1ccebefc436931c9ff8ff678addad4afcd37ed4d',protocol:TOURNAMENT,innerGameProtocol:INNER_GAME_PROTOCOL,additionalExclusions:additional.binding,historicalInventory:h.binding,executableSha256:receipt.executableSha256,receipt,sources:src,literalOpenings:roots,sourceTrajectories:roots.map(root=>{const tr=read(resolve(OUT,`trajectories/${root.id}.json`));return {family:root.family,seed:tr.seed,attempt:tr.attempt,root:tr.root,moves:tr.moves,terminal:tr.terminal,trajectoryHash:root.trajectoryHash};}),schedule:schedule(),attempts:attempt,rejections,attemptReceiptInventory:Array.from({length:attempt},(_,i)=>[i,fileSha(resolve(OUT,`attempts/${i}.json`))]),fixtures:{checksum:f.checksum,testTrajectoriesSha256:fileSha(resolve(OUT,'development-test-trajectories.json')),keysSha256:fixtureIndex.digest(),keys:[...Array(fixtureIndex.size)].map((_,i)=>fixtureIndex.bytes.subarray(i*32,i*32+32).toString('hex'))},forecasts:{beforeAdmission:forecast.checksum,beforeRegistration:finalForecast.checksum},analysisBeforeOutcomes:true});
  requireRegistration(registration);copyFileSync(resolve(OUT,'registration.json'),resolve(PUBLIC,'registration.json'));event('registered',{families:256,games:512,registration:registration.checksum});
 }else{
  const r=checked(resolve(OUT,'registration.json'));requireRegistration(r);verifySources(r.sources);assert.deepEqual(r.schedule,schedule());assert.equal(checked(resolve(PUBLIC,'registration.json')).checksum,r.checksum);const audit=checked(resolve(OUT,'reservation-verification.json'));assert.ok(audit.passed);assert.equal(audit.registration,r.checksum);
  const published=read(resolve(OUT,'registration-publication.json'));assert.equal(published.registration,r.checksum);assert.ok(published.remoteVerified);
  const h=history();assert.deepEqual(h.binding,r.historicalInventory);assert.deepEqual(priorEvidence().binding,r.additionalExclusions);const fixtureIndex=KeyIndex.load(resolve(OUT,'disclosed-development-keys.bin'));assert.equal(fixtureIndex.digest(),r.fixtures.keysSha256);
  const remaining=checked(resolve(OUT,'forecast-before-registration.json'));assert.ok((Date.now()-Date.parse(START))/60000+remaining.requiredRemainingMinutes<=240,'Final launch full forecast exceeds unspent time');
  const resource=resources();sealed(resolve(OUT,`resources-before-execute-${Date.now()}.json`),resource);event('scored-execution-start',{registration:r.checksum});
  let previous=null;
  for(let pair=0;pair<256;pair++){
   check();const pairPath=resolve(OUT,`pairs/pair-${pair}.json`),conditions=r.schedule.slice(pair*2,pair*2+2);
   if(existsSync(pairPath)){const p=checked(pairPath);assert.equal(p.registration,r.checksum);assert.equal(p.previous,previous);assert.equal(p.pair,pair);for(let j=0;j<2;j++){const g=checked(resolve(OUT,`games/game-${pair*2+j}.json`));assert.equal(g.checksum,p.games[j]);assert.deepEqual(g.condition,conditions[j]);replay(r.literalOpenings[conditions[j].family],g.result.moves,{complete:true});}previous=p.checksum;continue;}
   assert.ok(!existsSync(resolve(OUT,`games/game-${pair*2}.json`))&&!existsSync(resolve(OUT,`prefix/prefix-${pair*2}.json`)),'Incomplete prior pair retained; experiment incomplete, never replay/replace');
   const games=[];
   for(let j=0;j<2;j++){
    const index=pair*2+j,c=conditions[j],opening=r.literalOpenings[c.family],start=performance.now(),p=await players(receipt,index),warmupMs=performance.now()-start;
    try{const result=await playGame(p.engines,opening,{color:c.color,timeMs:300,check,checkpoint:game=>atomic(resolve(OUT,`prefix/prefix-${index}.json`),{registration:r.checksum,index,condition:c,game})});
     const g=sealed(resolve(OUT,`games/game-${index}.json`),{registration:r.checksum,index,condition:c,openingHash:hash(opening),hello:p.hello,processIds:p.pids,warmupMs,result,resultHash:hash(result),wallMs:performance.now()-start,committed:new Date().toISOString()});games.push(g.checksum);
    }finally{Object.values(p.engines).forEach(e=>e.close());}
   }
   const p=sealed(pairPath,{registration:r.checksum,pair,family:conditions[0].family,colors:conditions.map(c=>c.color),games,previous,at:new Date().toISOString()});previous=p.checksum;
   ledger('complete-pair',{pair,completedGames:(pair+1)*2,pairChecksum:p.checksum});if((pair+1)%8===0)console.log(JSON.stringify({stage:'scored-progress',completePairs:pair+1,games:(pair+1)*2,total:512}));
   if((pair+1)%16===0)sealed(resolve(OUT,`resources-pair-${pair}.json`),resources());
  }
  sealed(resolve(OUT,'execution-complete.json'),{registration:r.checksum,games:512,families:256,lastPair:previous,at:new Date().toISOString(),elapsedMs:Date.now()-Date.parse(START),awaitingIndependentAudits:true});event('all-games-complete',{games:512,families:256});
 }
}catch(e){ledger('stopped',{mode,error:e.stack});console.error(e.stack);process.exitCode=1;}finally{unlinkSync(lock);}
