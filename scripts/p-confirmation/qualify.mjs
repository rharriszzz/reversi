#!/usr/bin/env node
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {spawnSync,execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {OUT,OLD,read,atomic,checked,sealed,scientificInventory,resources,sha} from './common.mjs';
import {PROTOCOL,hash} from './protocol.mjs';
import {frozenModels} from '../frozen-player/models.mjs';
import {compile,phase} from '../next-residual/model.mjs';
import {findBestMove,terminalScore} from '../../src/search.js';
import {legalMoves} from '../../src/rules.js';
import {oracleScore} from '../../tests/oracle.mjs';
import {fullWindow} from '../next-residual/frontier.mjs';
import {playGame,replay} from '../frozen-player/game.mjs';
import {receipt} from '../frozen-player/receipts.mjs';
import {mean,quantile} from './statistics.mjs';
import {generate,verifyTrajectory} from '../residual/data.mjs';
import {KeyIndex} from '../residual/index.mjs';
import {admissionKeys} from '../frozen-player/execution.mjs';
const output=process.argv[2]??OUT,start=performance.now(),source=hash(scientificInventory()),models=frozenModels();
if(existsSync(`${output}/qualification/report.json`)){assert.equal(checked(`${output}/qualification/report.json`).source,source);console.log('Existing complete engineering qualification verified; no work repeated.');process.exit(0);}
assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');assert.equal(models.P.checksum,PROTOCOL.models.P);
const previousInventory=new Map(read(`${OLD}/preflight-final/preflight.json`).inventory);
for(const path of ['src/search.js','src/rules.js','src/features.js','src/fast-features.js','scripts/next-residual/model.mjs','scripts/next-residual/linear.mjs','scripts/frozen-player/game.mjs'])assert.equal(sha(path),previousInventory.get(path),'Exact previous playing implementation required');
const qdir=`${output}/qualification`,before=resources(output),old=checked(`${OLD}/scientific/reservations.json`),prior=read('docs/data/next-residual-results-20261029.json'),roots=prior.reservedRootIdentities.slice(0,16);
const work=(id,input,fn)=>receipt(`${qdir}/tasks/${id}.json`,hash({source,input}),fn);
sealed(`${qdir}/source.json`,{source,inventory:scientificInventory(),protocol:PROTOCOL});
console.log('Disclosed qualification: frozen identity, production search, phases, static cost, eight games and real interruption/recovery.');
const evaluations=Object.fromEntries(['B','P'].map(n=>[n,compile(models[n]).evaluate]));
const search=await work('search',roots,async()=>{let comparisons=0;for(const r of roots)for(const name of ['B','P'])for(const depth of [2,4]){
 const full=fullWindow(r,depth,undefined,()=>{},evaluations[name]),production=findBestMove(r.board,r.player,depth,undefined,{evaluate:evaluations[name]});
 assert.ok(Math.abs(full.score-production.score)<1e-8);assert.ok(full.rows.some(x=>x.move===production.move&&Math.abs(x.score-full.score)<1e-8));
 if(depth===2)assert.ok(Math.abs(production.score-oracleScore(r.board,r.player,depth,evaluations[name]))<1e-8);comparisons++;
 }assert.deepEqual([27,28,51,52].map(phase),[0,1,1,2]);return {comparisons,phaseBoundaries:[28,52]};});
const staticCost=await work('static',roots,async()=>{const rows=[];let sink=0;for(let rep=0;rep<5;rep++)for(const name of (rep%2?['P','B']:['B','P'])){
 const fn=evaluations[name],mob=roots.map(r=>legalMoves(r.board,r.player).length);for(let i=0;i<5000;i++){const j=i%16;sink+=fn(roots[j].board,roots[j].player,undefined,mob[j]);}
 const t=performance.now(),n=40000;for(let i=0;i<n;i++){const j=i%16;sink+=fn(roots[j].board,roots[j].player,undefined,mob[j]);}rows.push({rep,name,ns:(performance.now()-t)*1e6/n});
 }return {rows,sink,knownOwnMobility:true};});
const games=[];
for(const timeMs of [80,300])for(const family of [0,1])for(const color of [1,-1]){
 const opening={...old.roots.find(r=>r.id===`games-${family}`),id:`disclosed-previous-screen-${family}`},input={opening,timeMs,color};
 const game=await work(`game-${timeMs}-${family}-${color}`,input,async()=>{
  const checkpoint=`${qdir}/prefix-${timeMs}-${family}-${color}.json`,job=`${qdir}/restart-job.json`,resultPath=`${qdir}/restart-result.json`;
  if(timeMs===80&&family===0&&color===1){atomic(job,{...input,candidate:'P'});const first=spawnSync(process.execPath,['scripts/frozen-player/restart-probe.mjs',job,checkpoint,resultPath,'interrupt'],{encoding:'utf8'});assert.equal(first.status,73,first.stderr);assert.equal(read(checkpoint).moves.length,1);
   const damaged=structuredClone(read(checkpoint));damaged.board[0]=1-damaged.board[0];await assert.rejects(playGame(opening,models.P,color,timeMs,{resume:damaged}));
   execFileSync(process.execPath,['scripts/frozen-player/restart-probe.mjs',job,checkpoint,resultPath,'resume'],{timeout:120000});return {...read(resultPath),realProcessRestart:true,tamperRejected:true};
  }return playGame(opening,models.P,color,timeMs,{checkpoint:s=>atomic(checkpoint,s)});
 });assert.deepEqual(replay(opening,game.moves,{complete:true}).board,game.board);games.push({...input,game});console.log(JSON.stringify({qualificationGame:games.length,total:8,timeMs}));
}
const priorGames=read(`${OLD}/scientific/replayed-games.json`).filter(g=>g.candidate==='P');
const gameCosts=Object.fromEntries([80,300].map(b=>{const costs=priorGames.filter(g=>g.timeMs===b).map(g=>g.moveTimeMs),fresh=games.filter(g=>g.timeMs===b).map(g=>g.game.moveTimeMs);return [b,{priorGames:costs.length,priorMeanMs:mean(costs),priorP95Ms:quantile(costs,.95),priorMaxMs:Math.max(...costs),freshMeanMs:mean(fresh),freshMaxMs:Math.max(...fresh),placementCeilingMs:52*(b+1)}];}));
const admissionPilot=await work('admission-pilot',{namespace:'p-confirmation-disclosed-engineering-20261029'},async()=>{
 const base=KeyIndex.load(`${OLD}/history-v2/membership.bin`),eng=KeyIndex.load(`${OLD}/preflight-final/engineering-keys.bin`),seen=new Set(),rows=[],attempts=[];
 for(const r of old.roots)for(const k of admissionKeys(read(`${OLD}/scientific/trajectories/${r.id}.json`)).all)seen.add(k);
 let attempt=0;for(let i=0;i<16;i++){const parity=(i>>1)&1,spec={role:'disclosed-qualification',slot:i,phase:0,policy:i&1?'B4-2%':'B1-12%',occupied:12+parity,parity,player:parity?-1:1},t=performance.now();
  for(;;){assert.ok(attempt<2000);const tr=generate(spec,attempt++,{namespace:'p-confirmation-disclosed-engineering-20261029',strata:[[12,19]],commonPrefixBoundary:12});attempts.push(tr);if(!tr.root)continue;verifyTrajectory(tr);const ks=admissionKeys(tr).all;if([...ks].some(k=>base.has(k)||eng.has(k)||seen.has(k)))continue;for(const k of ks)seen.add(k);rows.push({spec,attempt:tr.attempt,wallMs:performance.now()-t});break;}
 }return {rows,attempts};
});
const after=resources(output,before),report={format:'p-confirmation-engineering-v1',at:new Date().toISOString(),source,models:PROTOCOL.models,search,staticCost,games,gameCosts,admissionPilot,before,after,wallMs:performance.now()-start,passed:true};
sealed(`${qdir}/report.json`,report);console.log(JSON.stringify({passed:true,wallMs:report.wallMs,gameCosts}));
