#!/usr/bin/env node
import assert from 'node:assert/strict';
import {existsSync,readFileSync,appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {players,playGame,replay} from './game.mjs';
import {PROTOCOL,schedule} from './protocol.mjs';
import {output,read,checked,sealed,atomic,measure,resources,hash} from './common.mjs';
import {sha} from '../native/build.mjs';
const reg=checked(resolve(output,'registration.json'));assert.deepEqual(reg.protocol,PROTOCOL);assert.deepEqual(reg.schedule,schedule());
for(const [p,digest] of Object.entries(reg.sources)){assert.equal(sha(readFileSync(p)),digest,`Frozen source changed: ${p}`);assert.equal(sha(readFileSync(resolve(output,'snapshot',p))),digest);}
assert.equal(sha(readFileSync(reg.receipt.executable)),reg.receipt.executableSha256);
const published=JSON.parse(execFileSync('git',['show','HEAD:docs/data/native-v2-registration-20261030.json'],{encoding:'utf8',maxBuffer:8*1024*1024}));assert.equal(published.checksum,reg.checksum,'Commit the independent registration before scored outcomes');
const verified=read(resolve(output,'reservation-verification.json'));assert.ok(verified.passed);assert.equal(verified.registration,reg.checksum);
let stop=false;for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>stop=true);
await measure('native-v2-tournament',async budget=>{
 const start=performance.now();let completed=0,lastSample=0,previous;
 const event=(stage,fields={})=>{const r={at:new Date().toISOString(),stage,...fields};appendFileSync(resolve(output,'events.jsonl'),JSON.stringify(r)+'\n');console.log(JSON.stringify(r));};
 function check(){if(stop)throw Error('Paused at durable move checkpoint');assert.ok(budget.spentMs+performance.now()-start+budget.reportingReserveMs<budget.capMs,'Protected reporting reserve');}
 function sample(){const r=resources();assert.ok(r.availableGiB>=3,'Physical headroom below 3 GiB');if(previous){const seconds=(Date.parse(r.at)-Date.parse(previous.at))/1000;assert.ok(Math.max(r.swapins-previous.swapins,r.swapouts-previous.swapouts)/Math.max(1,seconds)<256,'Sustained swapping');}
  const ps=execFileSync('ps',['-axo','pid=,ppid=,args='],{encoding:'utf8'}),competing=ps.split('\n').filter(l=>{const pid=Number(l.trim().split(/\s+/)[0]);return pid!==process.pid&&/^\s*\d+\s+\d+\s+(?:\S*\/)?(?:node|python3?)\s+.*scripts\/(?:native(?:-v2)?\/(?:run|prepare|benchmark|profile|timed|counters)|(?:p-confirmation|frozen-player|teacher|strong|residual)\/run)/.test(l);});assert.deepEqual(competing,[],'Competing scientific worker');
  appendFileSync(resolve(output,'tournament-resources.jsonl'),JSON.stringify(r)+'\n');previous=r;lastSample=performance.now();}
 sample();event('serial-games-start',{total:2048,registration:reg.checksum});
 for(const [i,condition] of reg.schedule.entries()){
  check();if(performance.now()-lastSample>30000)sample();
  const file=resolve(output,`games/game-${i}.json`),opening=reg.openings[condition.family];
  if(existsSync(file)){const r=checked(file);assert.equal(r.registration,reg.checksum);assert.deepEqual(r.condition,condition);assert.equal(hash(r.result),r.resultHash);assert.deepEqual(replay(opening,r.result.moves,{complete:true}).board,r.result.board);completed++;continue;}
  const prefix=resolve(output,`games/prefix-${i}.json`),resume=existsSync(prefix)?checked(prefix):null;
  if(resume)event('resume-prefix',{game:i,moves:resume.moves.length});
  const t=performance.now(),engines=await players(reg.receipt,i);
  try{
   const result=await playGame(engines,opening,{...condition,resume,check,checkpoint:p=>{atomic(prefix,p);check();}});
   sealed(file,{registration:reg.checksum,condition,result,resultHash:hash(result),wallMs:performance.now()-t,committed:new Date().toISOString()});
  }finally{Object.values(engines).forEach(e=>e.close());}
  completed++;atomic(resolve(output,'progress.json'),{registration:reg.checksum,completed,total:2048,lastGame:i,lastCheckpoint:new Date().toISOString(),activeMs:performance.now()-start,complete:completed===2048});
  if(completed%8===0||completed===2048)event('serial-games-progress',{completed,total:2048,activeMinutes:(performance.now()-start)/60000,remainingEstimateMinutes:(performance.now()-start)/completed*(2048-completed)/60000,lastCheckpoint:new Date().toISOString()});
 }
 event('all-games-complete-awaiting-blind-audit',{completed});
});
