#!/usr/bin/env node
import { existsSync,readFileSync,mkdirSync,copyFileSync,readdirSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { build,sha,root } from './build.mjs';
import { NativeEngine } from './client.mjs';
import { playGame,choose } from './game.mjs';
import { engineeringPositions } from './positions.mjs';
import { initialBoard,legalMoves,play } from '../../src/rules.js';
import { seededRandom } from '../../src/learning.js';
import { keysFor } from '../residual/data.mjs';
import { loadExclusions } from '../p-confirmation/history.mjs';
import { PROTOCOL,schedule,hash } from './protocol.mjs';
import { measure,output,atomic,read } from './measure.mjs';
const path=resolve(output,'registration.json');
if(existsSync(path))throw Error('Registration already exists; use run.mjs. Never overwrite a reserved experiment.');
const receipt=build();
await measure('preparation',async budget=>{
 // Verified legacy exclusions read only. This is an engineering screen, not a
 // new claim that all historic role and late played-state issues are resolved.
 const old='.local-research/p-independent-confirmation-v1-20261029',exclusions=loadExclusions(old),forbidden=new Set();
 const add=b=>{if(b.filter(Boolean).length>=12)for(const k of keysFor(b))forbidden.add(k);};
 const oldReservation=read(`${old}/reservation.json`);
 for(const tr of readdirSync(`${old}/trajectories`).filter(n=>n.endsWith('.json'))) {
  const r=read(`${old}/trajectories/${tr}`);const visit=v=>{if(!v||typeof v!=='object')return;if(Array.isArray(v)&&v.length===64&&v.every(x=>[-1,0,1].includes(x))){add(v);return;}for(const x of Object.values(v))visit(x);};visit(r);
 }
 for(const name of readdirSync(`${old}/games`).filter(n=>/^game-\d+\.json$/.test(n))) {
  const record=read(`${old}/games/${name}`),g=record.result;const c=oldReservation.schedule[Number(name.match(/\d+/)[0])];const opening=oldReservation.roots.find(r=>r.id===`games-${c.family}`);let b=opening.board,p=opening.player;add(b);
  for(const m of g.moves){if(m.move!==null)b=[...play(b,p,m.move)];p=-p;add(b);}
 }
 for(const p of engineeringPositions())add(p.board);
 const admitted=new Set(),attempts=[];
 function generate(target,attempt) {
  const seed=(0x4e540000+attempt)>>>0,rng=seededRandom(seed),history=[],moves=[];let board=[...initialBoard()],player=1;
  while(board.filter(Boolean).length<target) {
   const legal=legalMoves(board,player);if(!legal.length){if(!legalMoves(board,-player).length)return null;moves.push({player,move:null});player=-player;continue;}
   const move=legal[Math.floor(rng()*legal.length)];moves.push({player,move});board=[...play(board,player,move)];player=-player;if(board.filter(Boolean).length>=12)history.push({board:[...board],player});
  }
  return {seed,target,board,player,history,moves};
 }
 const openings=[];let attempt=0;
 for(let family=0;family<264;family++) {
  const target=16+family%4;
  while(true) {
   if(attempt>=200000)throw Error('Admission attempts exceeded');const tr=generate(target,attempt++);
   if(!tr||legalMoves(tr.board,tr.player).length<2){attempts.push({attempt:attempt-1,rejected:'terminal/mobility'});continue;}
   const keys=tr.history.flatMap(s=>keysFor(s.board));
   if(keys.some(k=>exclusions.has(k)||forbidden.has(k)||admitted.has(k))){attempts.push({attempt:attempt-1,rejected:'historical/ancestry'});continue;}
   for(const k of keys)admitted.add(k);
   openings.push({id:`native-${family<8?'pilot':'scored'}-${family<8?family:family-8}`,family:family<8?null:family-8,attempt:attempt-1,...tr});break;
  }
 }
 const pilot=openings.slice(0,8),scored=openings.slice(8),games=[];const engine=new NativeEngine({receipt});
 try {
  await engine.ready();for(const p of engineeringPositions().slice(0,8))for(const backend of ['javascript','native'])await choose(engine,p.board,p.player,{backend,model:'P',depth:3});
  for(const [i,opening] of pilot.entries()) {
   const timeMs=i<4?80:300,start=performance.now();const game=await playGame(engine,opening,{timeMs,nativeColor:i%2?1:-1});
   games.push({opening,game,wallMs:performance.now()-start});atomic(resolve(output,'engineering-game-costs.json'),{games});
   console.log(JSON.stringify({stage:'engineering-game-cost',completed:i+1,total:8,timeMs,wallMs:games.at(-1).wallMs}));
  }
 }finally{engine.close();}
 // High-side: greater of slowest observed complete game and the full number of
 // possible placements all spending their budget, plus measured transport.
 const estimates={};let gameMs=0;
 for(const ms of [80,300]) {const observed=Math.max(...games.filter(g=>g.game.timeMs===ms).map(g=>g.wallMs));const allPlacements=48*(ms+1);const perGame=Math.max(observed,allPlacements);estimates[ms]={observedMaxGameMs:observed,allPlacementBoundMs:allPlacements,perGameMs:perGame};gameMs+=perGame*(ms===80?512:256);}
 const preparationSoFar=Date.now()-budget.active.start;
 const forecast={gameMs,estimates,measurementSpentBeforeMs:budget.spentMs,preparationSoFarMs:preparationSoFar,contingency:1.35,auditAllowanceMs:PROTOCOL.auditAllowanceMs,reportingReserveMs:PROTOCOL.reportingReserveMs,totalMs:budget.spentMs+preparationSoFar+1.35*(gameMs+PROTOCOL.auditAllowanceMs)+PROTOCOL.reportingReserveMs,capMs:budget.capMs};
 atomic(resolve(output,'feasibility.json'),forecast);if(forecast.totalMs>forecast.capMs)throw Error('Full 768-game schedule infeasible; no scored games started.');
 const sourcePaths=[];function visit(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=`${dir}/${e.name}`;if(e.isDirectory())visit(p);else if(/\.(mjs|js|cpp|hpp|py|json)$/.test(p))sourcePaths.push(p);}}
 visit('native');visit('scripts/native');visit('src');
 sourcePaths.push('scripts/frozen-player/models.mjs','scripts/next-residual/model.mjs','scripts/next-residual/linear.mjs','scripts/next-residual/protocol.mjs','scripts/strong/model.mjs','scripts/research/core.mjs','scripts/residual/data.mjs','scripts/residual/index.mjs','scripts/frozen-player/statistics.mjs','scripts/p-confirmation/statistics.mjs','scripts/teacher/qualification-core.mjs','docs/data/next-residual-coefficients-20261029.json','tests/oracle.mjs');
 const sources=Object.fromEntries([...new Set(sourcePaths)].sort().map(p=>[p,sha(readFileSync(p))]));
 for(const [p,digest] of Object.entries(sources)){const dst=resolve(output,'snapshot',p);mkdirSync(dirname(dst),{recursive:true});copyFileSync(p,dst);assert.equal(sha(readFileSync(dst)),digest);}
 mkdirSync(resolve(output,'snapshot/build'),{recursive:true});const executable=resolve(output,'snapshot/build/reversi-native');copyFileSync(receipt.executable,executable);const frozenReceipt={...receipt,executable};
 const body={format:'native-strength-registration-v1',at:new Date().toISOString(),protocol:PROTOCOL,sources,receipt:frozenReceipt,node:process.version,gitHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),openings:scored,pilotOpeningIds:pilot.map(p=>p.id),schedule:schedule(),historical:{baseDigest:exclusions.h.baseDigest,engineeringDigest:exclusions.h.engineeringDigest,addedDigest:exclusions.h.addedDigest,previousConfirmationPlayedAndReservedKeys:forbidden.size,rejectedAttempts:attempts.length},forecast,statistics:PROTOCOL.statistics};
 const registration={...body,checksum:hash(body)};atomic(path,registration);atomic(resolve(output,'admission-attempts.json'),attempts);
 console.log(JSON.stringify({registered:true,checksum:registration.checksum,games:registration.schedule.length,forecastMinutes:forecast.totalMs/60000}));
});
