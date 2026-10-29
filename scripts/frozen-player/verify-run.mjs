#!/usr/bin/env node
// Separate-process read-only audit. Produces a small immutable certificate.
import assert from 'node:assert/strict';
import {readdirSync,existsSync} from 'node:fs';
import {read,atomic} from '../research/io.mjs';
import {hash,PROTOCOL,gameSchedule,assessmentSlots} from './protocol.mjs';
import {inventory,sha,admissionKeys} from './execution.mjs';
import {frozenModels} from './models.mjs';
import {verifyTrajectory} from '../residual/data.mjs';
import {KeyIndex} from '../residual/index.mjs';
import {replay} from './game.mjs';
import {replayTeacher} from './analyze.mjs';
import {pairSummary,jointGameBootstrap,nomination} from './statistics.mjs';
const [output,history,preflight]=process.argv.slice(2),state=read(`${output}/state.json`),launch=read(`${output}/launch.json`),reservation=read(`${output}/reservations.json`),summary=read(`${output}/summary.json`),p=read(`${preflight}/preflight.json`),h=read(`${history}/manifest.json`);
assert.equal(state.status,'complete');frozenModels();assert.equal(hash(inventory()),p.source);
for(const r of [launch,reservation,summary,p,h]){const {checksum,...body}=r;assert.equal(hash(body),checksum);}
assert.equal(launch.reservationChecksum,reservation.checksum);assert.deepEqual(reservation.schedule,gameSchedule());assert.equal(summary.launch,launch.checksum);assert.equal(summary.counts.games,384);
const index=KeyIndex.load(`${history}/membership.bin`),eng=KeyIndex.load(`${preflight}/engineering-keys.bin`),owners=new Map();assert.equal(index.digest(),h.digest);assert.equal(eng.digest(),p.engineeringDigest);
for(const root of reservation.roots){const tr=read(`${output}/trajectories/${root.id}.json`);verifyTrajectory(tr);assert.equal(hash(tr),root.trajectoryHash);const frontiers=root.diagnostic?read(`${output}/frontiers/${root.id}.json`):[];
 for(const k of admissionKeys(tr,frontiers).all){assert.ok(!index.has(k)&&!eng.has(k));assert.ok(!owners.has(k));owners.set(k,root.id);}
}
for(const spec of assessmentSlots()){const root=reservation.roots.find(r=>r.id===`assessment-${spec.slot}`);for(const [k,v] of Object.entries(spec))assert.equal(root[k],v);}
const games=[];
for(const [i,condition] of reservation.schedule.entries()){
 const r=read(`${output}/games/game-${i}.json`),{checksum,...body}=r;assert.equal(hash(body),checksum);assert.equal(r.launch,launch.checksum);assert.deepEqual(r.condition,condition);assert.equal(hash(r.result),r.resultHash);assert.ok(r.committed>launch.at);
 const opening=reservation.roots.find(s=>s.id===`games-${condition.family}`),g=r.result;assert.equal(r.identity,hash({launch:launch.checksum,condition,opening}));assert.deepEqual(replay(opening,g.moves,{complete:true}).board,g.board);assert.equal(g.margin,g.board.reduce((a,b)=>a+b,0));assert.equal(g.outcome,condition.color*Math.sign(g.margin));assert.equal(g.points,(1+g.outcome)/2);games.push({...condition,...g});
}
const scores={};
for(const timeMs of [80,300]){
 const families=[...new Set(games.filter(g=>g.timeMs===timeMs).map(g=>g.family))],joint=[];scores[timeMs]={};
 for(const family of families){const row={family};for(const candidate of ['L','P']){const pair=games.filter(g=>g.family===family&&g.candidate===candidate);assert.equal(pair.length,2);assert.deepEqual(new Set(pair.map(g=>g.color)),new Set([-1,1]));row[candidate]=(pair[0].points+pair[1].points)/2;}joint.push(row);}
 for(const candidate of ['L','P']){scores[timeMs][candidate]=pairSummary(joint.map(r=>r[candidate]));for(const [k,v] of Object.entries(scores[timeMs][candidate]))assert.deepEqual(summary.gameSummary[timeMs][candidate][k],v);}
 assert.deepEqual(summary.gameBootstrap[timeMs],jointGameBootstrap(joint));
}
assert.deepEqual(summary.nomination,nomination(scores[80],scores[300]));
const tasks=new Map(),taskInventory=[];let queries=0,terminalChecks=0;
for(const file of readdirSync(`${output}/tasks`).filter(f=>f.endsWith('.json')).sort()){
 const r=read(`${output}/tasks/${file}`);assert.equal(r.runIdentity,launch.checksum);assert.equal(r.inputHash,hash({job:r.job,runIdentity:launch.checksum}));assert.equal(hash(r.result),r.resultHash);tasks.set(file.slice(0,-5),r);taskInventory.push([file,sha(`${output}/tasks/${file}`)]);
 if(r.job.type==='label'){replayTeacher(r.job.state,r.result);queries++;}
}
for(const [id,r] of tasks){if(r.job.type!=='exact')continue;
 const labelPrefix=id.startsWith('frontier-exact-')?`frontier-${id.slice('frontier-exact-'.length)}`:id.startsWith('exact-assessment-')?`root-${id.slice('exact-'.length)}`:null;if(!labelPrefix)continue;
 for(const depth of [10,12]){const teacher=tasks.get(`${labelPrefix}-d${depth}`);if(!teacher||64-r.job.state.board.filter(Boolean).length>depth)continue;
  for(const row of teacher.result.rows){assert.equal(row.value,r.result.awarded.rows.find(x=>x.move===row.move).value,'Independent exact/Edax awarded agreement');terminalChecks++;}
 }
}
assert.equal(hash(taskInventory),summary.taskInventoryHash);
const certificate={format:'frozen-player-separate-process-audit-v1',passed:true,source:p.source,launch:launch.checksum,reservations:reservation.checksum,models:PROTOCOL.models,
 trajectories:256,games:384,taskReceipts:tasks.size,queries,terminalAlternativeChecks:terminalChecks,taskInventoryHash:hash(taskInventory),summarySha256:sha(`${output}/summary.json`),independence:summary.independence,
 note:'Independent mailbox game/PV replay, complete family balance and historical admission, receipt input/result hashes, terminal teacher agreement and recomputed pair t/bounded/joint-bootstrap/nomination. Original historical experiment failures unchanged.'};
const saved={...certificate,checksum:hash(certificate)},path=`${output}/verification.json`;if(existsSync(path))assert.deepEqual(read(path),saved);else atomic(path,saved);console.log(JSON.stringify({...certificate,independence:{...certificate.independence,playedPathRestrictedOrUnknown:certificate.independence.playedPathRestrictedOrUnknown.length}}));
