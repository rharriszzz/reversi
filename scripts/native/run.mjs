#!/usr/bin/env node
import { resolve } from 'node:path';
import { existsSync,readFileSync,mkdirSync,appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { NativeEngine } from './client.mjs';
import { playGame,choose,replay } from './game.mjs';
import { engineeringPositions } from './positions.mjs';
import { hash,PROTOCOL } from './protocol.mjs';
import { sha } from './build.mjs';
import { measure,output,atomic,read,resources } from './measure.mjs';
const reg=read(resolve(output,'registration.json')),{checksum,...body}=reg;assert.equal(hash(body),checksum);assert.deepEqual(reg.protocol,PROTOCOL);
for(const [p,digest] of Object.entries(reg.sources)){assert.equal(sha(readFileSync(p)),digest,`Frozen source changed: ${p}`);assert.equal(sha(readFileSync(resolve(output,'snapshot',p))),digest);}
assert.equal(sha(readFileSync(reg.receipt.executable)),reg.receipt.executableSha256);
const statePath=resolve(output,'progress.json'),eventPath=resolve(output,'events.jsonl');
const event=data=>{const row={at:new Date().toISOString(),...data};appendFileSync(eventPath,JSON.stringify(row)+'\n');console.log(JSON.stringify(row));};
let stopping=false;process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
await measure('tournament',async budget=>{
 const start=performance.now(),engine=new NativeEngine({receipt:reg.receipt,ttMiB:PROTOCOL.ttMiB});let completed=0,lastResource=0,previous=null;
 const check=()=>{if(stopping)throw Error('Paused at durable game checkpoint');if(budget.spentMs+performance.now()-start>=budget.capMs-budget.reportingReserveMs)throw Error('Protected reporting reserve reached');};
 function sample() {
  const current=resources();if(current.availableGiB!==undefined)assert.ok(current.availableGiB>=3,'Physical headroom below 3 GiB');
  if(previous&&current.swapins!==undefined){const seconds=(Date.parse(current.at)-Date.parse(previous.at))/1000;assert.ok(Math.max(current.swapins-previous.swapins,current.swapouts-previous.swapouts)/Math.max(1,seconds)<256,'Sustained swapping');}
  const args=execFileSync('ps',['-axo','pid=,args='],{encoding:'utf8'});const competing=args.split('\n').filter(l=>{const pid=Number(l.trim().split(/\s+/)[0]);return pid!==process.pid&&/\bnode\s+.*scripts\/(?:native\/(?:benchmark|profile|compare-optimization|prepare|run)|(?:p-confirmation|frozen-player)\/run)/.test(l);});assert.deepEqual(competing,[],'Competing measurement coordinator');
  appendFileSync(resolve(output,'tournament-resources.jsonl'),JSON.stringify(current)+'\n');previous=current;lastResource=performance.now();
 }
 try {
  await engine.ready();sample();for(const p of engineeringPositions().slice(0,4))for(const backend of ['javascript','native'])for(const depth of [3,5])await choose(engine,p.board,p.player,{backend,depth,model:'P'});
  mkdirSync(resolve(output,'games'),{recursive:true});
  for(const condition of reg.schedule) {
   check();const path=resolve(output,`games/game-${condition.game}.json`),opening=reg.openings[condition.family];
   if(existsSync(path)) {const r=read(path),{checksum,...rbody}=r;assert.equal(hash(rbody),checksum);assert.equal(r.registration,reg.checksum);assert.deepEqual(r.condition,condition);assert.equal(hash(r.result),r.resultHash);assert.deepEqual(replay(opening,r.result.moves,{complete:true}).board,r.result.board);completed++;continue;}
   if(performance.now()-lastResource>30000)sample();
   const checkpointPath=resolve(output,`games/prefix-${condition.game}.json`),resume=existsSync(checkpointPath)?read(checkpointPath):null;
   if(condition.game===0||reg.schedule[condition.game-1].family!==condition.family||reg.schedule[condition.game-1].timeMs!==condition.timeMs) {const p=engineeringPositions()[7];for(const backend of ['javascript','native'])await choose(engine,p.board,p.player,{backend,model:'P',depth:3});}
   const taskStart=performance.now();
   const result=await playGame(engine,opening,{timeMs:condition.timeMs,nativeColor:condition.nativeColor,resume,check,checkpoint:s=>{atomic(checkpointPath,s);check();}});
   const record={registration:reg.checksum,condition,result,resultHash:hash(result),wallMs:performance.now()-taskStart};atomic(path,{...record,checksum:hash(record)});completed++;
   atomic(statePath,{registration:reg.checksum,completed,total:768,lastGame:condition.game,lastCheckpoint:new Date().toISOString(),activeMs:performance.now()-start,measurementSpentBeforeMs:budget.spentMs,complete:completed===768});
   if(completed%8===0||completed===768)event({stage:'serial-tournament',completed,total:768,activeMinutes:(performance.now()-start)/60000,remainingEstimateMinutes:(performance.now()-start)/Math.max(1,completed)*(768-completed)/60000,lastCheckpoint:new Date().toISOString()});
  }
  event({stage:'complete-games-awaiting-audit',completed,total:768});
 }finally{engine.close();}
});
