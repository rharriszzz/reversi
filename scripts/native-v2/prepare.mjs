#!/usr/bin/env node
import assert from 'node:assert/strict';
import {existsSync,readdirSync,readFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {build,sha} from '../native/build.mjs';
import {players,playGame} from './game.mjs';
import {PROTOCOL,slots,schedule} from './protocol.mjs';
import {buildHistory} from './history.mjs';
import {generate,verifyTrajectory} from '../residual/data.mjs';
import {admissionKeys} from '../frozen-player/execution.mjs';
import {output,measure,read,atomic,sealed,checked,hash,resources} from './common.mjs';
const path=resolve(output,'registration.json');if(existsSync(path))throw Error('Registration already exists; never overwrite');
const receipt=build({directory:resolve(output,'build-final')});
const qualification=read(resolve(output,'qualification.json'));assert.ok(qualification.passed);assert.equal(qualification.receipt.executableSha256,receipt.executableSha256,'Core changed since qualification');
await measure('preparation-v2',async budget=>{
 const start=performance.now();
 // Eight disclosed historical openings, both colors at both budgets; costs are
 // engineering data only. Prefix checkpoints remain durable and separate.
 const old=read('.local-research/p-independent-confirmation-v1-20261029/reservation.json'),games=[];
 for(const timeMs of [80,300])for(const family of [0,1])for(const color of [1,-1]){
  const id=`${timeMs}-${family}-${color}`,file=resolve(output,`pilot/game-${id}.json`);
  if(existsSync(file)){games.push(read(file));continue;}
  const opening={...old.roots[family],id:`disclosed-v2-cost-${family}`},warmStart=performance.now(),engines=await players(receipt,games.length),warmupMs=performance.now()-warmStart,t=performance.now();
  try{const result=await playGame(engines,opening,{color,timeMs,checkpoint:p=>atomic(resolve(output,`pilot/prefix-${id}.json`),p)});const r={opening,result,warmupMs,wallMs:performance.now()-t};atomic(file,r);games.push(r);console.log(JSON.stringify({stage:'disclosed-complete-game-cost',completed:games.length,total:8,timeMs,wallMs:r.wallMs}));}finally{Object.values(engines).forEach(e=>e.close());}
 }
 atomic(resolve(output,'pilot-games.json'),games);
 const history=buildHistory(),h=history.h,owners=new Map(),seeds=new Set(h.seeds);
 let progress=existsSync(resolve(output,'admission.json'))?checked(resolve(output,'admission.json')):{attempt:0,roots:[],rejected:[],identity:hash({protocol:PROTOCOL,history:h.checksum})};
 assert.equal(progress.identity,hash({protocol:PROTOCOL,history:h.checksum}));
 for(const root of progress.roots){const tr=read(resolve(output,`trajectories/${root.id}.json`));assert.equal(hash(tr),root.trajectoryHash);verifyTrajectory(tr);for(const k of admissionKeys(tr).all){assert.ok(!history.has(k)&&!owners.has(k));owners.set(k,root.id);}seeds.add(root.seed);}
 let last=performance.now();
 for(const spec of slots().slice(progress.roots.length))for(;;){
  assert.ok(progress.attempt<100000,'Predeclared admission attempt cap; no sample reduction');assert.ok(budget.spentMs+performance.now()-start+20*60000<budget.capMs);
  const attempt=progress.attempt++,tr=generate(spec,attempt,{namespace:PROTOCOL.namespace,strata:[[12,19]],commonPrefixBoundary:12});
  const task=resolve(output,`admission-attempts/${attempt}.json`);atomic(task,{spec,attempt,trajectory:tr});
  let reason=!tr.root?'no-root':seeds.has(tr.seed)?'seed-reuse':null,conflict=null,ks;
  if(!reason){verifyTrajectory(tr);ks=admissionKeys(tr).all;for(const k of ks)if(history.has(k)||owners.has(k)){reason='historical-or-shared-ancestry';conflict={key:k,owner:owners.get(k)??'historical'};break;}}
  if(reason)progress.rejected.push({attempt,seed:tr.seed,reason,conflict});
  else{const root={...spec,...tr.root,id:`native-v2-${spec.family}`,seed:tr.seed,attempt,trajectoryHash:hash(tr)};if(spec.reverse){root.board=root.board.map(v=>-v);root.player=-root.player;}ks.forEach(k=>owners.set(k,root.id));seeds.add(tr.seed);atomic(resolve(output,`trajectories/${root.id}.json`),tr);progress.roots.push(root);}
  const {checksum,...body}=progress;atomic(resolve(output,'admission.json'),{...body,checksum:hash(body)});
  if(performance.now()-last>30000||progress.roots.length===768){const resource=resources();assert.ok(resource.availableGiB>=3,'Physical headroom during source admission');atomic(resolve(output,'preparation-resource-latest.json'),resource);console.log(JSON.stringify({stage:'outcome-blind-source-admission',completed:progress.roots.length,total:768,attempts:progress.attempt,elapsedMinutes:(performance.now()-start)/60000}));last=performance.now();}
  if(!reason)break;
 }
 // Max all remaining placements plus 1 ms per move; passes need no search.
 // Complete fresh slowest game, actual checkpoint overhead, warmup and audit
 // allowances are all covered, then 35% contingency and protected reporting.
 const estimates={};let gameMs=0;
 for(const ms of [80,300]){const xs=games.filter(g=>g.result.timeMs===ms),maxGameMs=Math.max(...xs.map(g=>g.wallMs)),overheadMs=Math.max(250,2*Math.max(...xs.map(g=>g.wallMs-g.result.moveTimeMs)));const perGameMs=Math.max(52*(ms+1),1.1*maxGameMs)+overheadMs;estimates[ms]={maxGameMs,overheadMs,perGameMs};gameMs+=perGameMs*(ms===80?1536:512);}
 const elapsedMs=performance.now()-start,remaining={games:gameMs,warmup:2048*Math.max(25,2*Math.max(...games.map(g=>g.warmupMs))),checkpointReplayProvenanceStatisticsIndependentAudit:30*60000};
 const forecast={spentBeforeMs:budget.spentMs,preparationMs:elapsedMs,remaining,estimates,contingency:1.35,reportReserveMs:20*60000,totalMs:budget.spentMs+elapsedMs+1.35*Object.values(remaining).reduce((s,v)=>s+v,0)+20*60000,capMs:budget.capMs};
 atomic(resolve(output,'feasibility.json'),forecast);assert.ok(forecast.totalMs<=forecast.capMs,'Full fixed sample infeasible; stop before scored outcomes');
 const sources={};for(const dir of ['src','native','scripts']){function visit(d){for(const e of readdirSync(d,{withFileTypes:true})){const p=`${d}/${e.name}`;if(e.isDirectory())visit(p);else if(/\.(mjs|js|cpp|hpp|py|json)$/.test(p))sources[p]=sha(readFileSync(p));}}visit(dir);}
 for(const p of ['tests/oracle.mjs','tests/native-internals.cpp','tests/native-v2.test.mjs','docs/data/next-residual-coefficients-20261029.json','docs/NATIVE_SEARCH_V2_PROTOCOL.md'])sources[p]=sha(readFileSync(p));
 for(const [p,digest] of Object.entries(sources)){const target=resolve(output,'snapshot',p);mkdirSync(dirname(target),{recursive:true});copyFileSync(p,target);assert.equal(sha(readFileSync(target)),digest);}
 mkdirSync(resolve(output,'snapshot/build'),{recursive:true});const executable=resolve(output,'snapshot/build/reversi-native');copyFileSync(receipt.executable,executable);
 const reg=sealed(path,{format:'native-v2-registration-v1',at:new Date().toISOString(),protocol:PROTOCOL,sources,receipt:{...receipt,executable},qualification:sha(readFileSync(resolve(output,'qualification.json'))),history:h.checksum,openings:progress.roots,schedule:schedule(),forecast,gitHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,attempts:progress.attempt});
 console.log(JSON.stringify({registered:true,checksum:reg.checksum,games:reg.schedule.length,forecastMinutes:forecast.totalMs/60000}));
});
