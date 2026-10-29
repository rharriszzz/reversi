#!/usr/bin/env node
// Entirely disclosed engineering admission pilot; never assessed for strength.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {atomic,read} from '../research/io.mjs';
import {trajectory} from '../machine-benchmark/suite.mjs';
import {keysFor} from '../residual/data.mjs';
import {legalMoves,play} from '../../src/rules.js';
import {generate,verifyTrajectory} from '../residual/data.mjs';
import {KeyIndex} from '../residual/index.mjs';
import {collectFrontier} from '../next-residual/frontier.mjs';
import {compile} from '../next-residual/model.mjs';
import {Pool} from './pool.mjs';
import {PROTOCOL,hash,assessmentSlots} from './protocol.mjs';
import {frozenModels} from './models.mjs';
import {resource,inventory,sha,admissionKeys} from './execution.mjs';
const [qualificationArg,historyArg,outArg]=process.argv.slice(2),output=resolve(outArg),q=read(`${qualificationArg}/qualification.json`),h=read(`${historyArg}/manifest.json`);
const {checksum:qc,...qb}=q;assert.equal(hash(qb),qc);const {checksum:hc,...hb}=h;assert.equal(hash(hb),hc);
const preservedInventory=resolve(historyArg,'../pc-inventory-qualified.json');assert.equal(sha(preservedInventory),h.inventorySha256,'Archive before/after inventory differs');
const models=frozenModels(),index=KeyIndex.load(`${historyArg}/membership.bin`);assert.equal(index.digest(),h.digest);
const start=performance.now(),before=resource();assert.ok(before.safeCap>=1);assert.ok(q.validation.passed&&q.native.passed);
const rows=[],owners=new Set(),pilotAll=new Set(),pilotSeeds=new Set([74102901,74102902,74102903,74102904]),specs=[...assessmentSlots().slice(0,16),...Array.from({length:4},(_,i)=>({role:'engineering-game',slot:i,phase:0,policy:PROTOCOL.assessment.policies[Math.floor(i/2)],depth:4,occupied:12+i%2,parity:i%2,player:i%2?-1:1})),...Array.from({length:2},(_,i)=>({role:'engineering-exact',slot:i,phase:3,policy:PROTOCOL.assessment.policies[i],depth:6,occupied:54,parity:0,player:1}))];
const protocol={namespace:'frozen-player-disclosed-admission-pilot-20261029',strata:PROTOCOL.assessment.strata,commonPrefixBoundary:12};let attempt=0;
const addEngineering=board=>{if(board.filter(Boolean).length>=12&&(legalMoves(board,1).length||legalMoves(board,-1).length))for(const k of keysFor(board))owners.add(k);};
for(const seed of [74102901,74102902,74102903,74102904])for(const state of trajectory(seed))addEngineering(state.board);
for(const game of q.games){let board=game.opening.board,player=game.opening.player;addEngineering(board);for(const step of game.moves){if(step.move!==null)board=[...play(board,player,step.move)];player=-player;addEngineering(board);}}
for(const spec of specs){const started=performance.now(),rejections={},attemptStart=attempt;
 while(true){assert.ok(attempt<10000,'Engineering admission exhausted');const tr=generate({...spec,role:`engineering-${spec.role}`},attempt++,protocol);pilotSeeds.add(tr.seed);atomic(`${output}/attempts/${attempt-1}.json`,tr);for(const state of tr.history)if(legalMoves(state.board,1).length||legalMoves(state.board,-1).length)for(const k of keysFor(state.board))pilotAll.add(k);if(!tr.root){rejections.noRoot=(rejections.noRoot??0)+1;continue;}verifyTrajectory(tr);pilotSeeds.add(tr.seed);
  let ks=admissionKeys(tr);if([...ks.all].some(k=>index.has(k)||owners.has(k))){rejections.history=(rejections.history??0)+1;continue;}
  const root={...tr.root,...spec,id:`public-admission-${rows.length}`},frontiers=spec.role==='assessment'?['B','L','P'].map(n=>collectFrontier(root,{evaluate:compile(models[n]).evaluate})):[];
  ks=admissionKeys(tr,frontiers);if([...ks.all].some(k=>index.has(k)||owners.has(k))){rejections.frontier=(rejections.frontier??0)+1;continue;}
  for(const k of ks.all)owners.add(k);atomic(`${output}/trajectories/${root.id}.json`,tr);atomic(`${output}/frontiers/${root.id}.json`,frontiers);
  rows.push({spec,root,attempts:attempt-attemptStart,rejections,wallMs:performance.now()-started});console.log(JSON.stringify(rows.at(-1)));break;
 }
}
// Every successful pilot trajectory is historical before scientific reservation.
for(const k of pilotAll)owners.add(k);const keys=KeyIndex.from(owners);keys.save(`${output}/engineering-keys.bin`);
const pool=new Pool(1,output,hash({engineeringQualification:qc,history:hc})),fixture=read('scripts/machine-benchmark/positions.json'),exactCosts=[];
for(const state of fixture.exact){const started=performance.now();const result=await pool.task(`engineering-exact-${state.id}`,{type:'exact',state});exactCosts.push({id:state.id,wallMs:performance.now()-started,solverMs:result.raw.wallMs+result.awarded.wallMs});}await pool.close();
const rootMaximum=Math.max(...q.search.map(r=>r.wallMs)),fullSearchPerRoot=Math.max(...q.search.map(r=>q.search.filter(s=>s.id===r.id).reduce((s,x)=>s+x.wallMs,0)));
const gameMs=256*(52*81+1000)+128*(52*301+1000);
const components={games:gameMs,warmup:192*16*3*10,admission:256*Math.max(...rows.map(r=>r.wallMs))*2,
 fixedRoots:160*fullSearchPerRoot*2,timedRoots:160*3*382,
 rootLabels:128*Math.max(...q.nativeQueries.map(r=>r.wallMs))*2*3,
 frontierLabels:32*Math.max(...q.frontierQueries.map(r=>r.wallMs))*3,
 exact:128*Math.max(...exactCosts.map(r=>r.wallMs))*3,
 finalAuditAnalysis:10*60000};
const forecast={components,rawMs:Object.values(components).reduce((a,b)=>a+b,0),allowance:1.35,reportingReserveMs:900000,serialAssumption:true};forecast.requiredMs=forecast.rawMs*1.35+900000;forecast.fits=forecast.requiredMs<PROTOCOL.resources.scientificCapMs;
const body={format:'frozen-player-complete-preflight-v1',qualificationSha:sha(`${qualificationArg}/qualification.json`),historyChecksum:hc,archivePreservedInventorySha256:sha(preservedInventory),
 source:hash(inventory()),inventory:inventory(),models:PROTOCOL.models,before,after:resource(),configuredWorkers:6,actualWorkers:1,
 rows,exactCosts,seeds:[...pilotSeeds],attempts:attempt,engineeringKeys:keys.size,engineeringDigest:keys.digest(),forecast,wallMs:performance.now()-start,
 maxRssBytes:process.resourceUsage().maxRSS*1024,qualified:forecast.fits};
atomic(`${output}/preflight.json`,{...body,checksum:hash(body)});assert.ok(forecast.fits,'Complete serial forecast exceeds safety ceiling');console.log(JSON.stringify({qualified:true,forecast}));
