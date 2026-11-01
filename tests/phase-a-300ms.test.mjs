import assert from 'node:assert/strict';
import test from 'node:test';
import {TOURNAMENT,slots,schedule,requireRegistration} from '../scripts/phase-a-300ms/prospective-protocol.mjs';
import {TOURNAMENT as OLD,schedule as oldSchedule} from '../scripts/phase-a-mac/prospective-protocol.mjs';
import {summarize} from '../scripts/phase-a-300ms/tournament-statistics.mjs';
test('300ms prospective protocol preserves old experiment and balanced whole families',()=>{
 assert.equal(OLD.timeMs,80);assert.equal(OLD.capMinutes,180);assert.ok(oldSchedule().every(x=>x.timeMs===80));
 assert.notEqual(TOURNAMENT.namespace,OLD.namespace);assert.notEqual(TOURNAMENT.orderSeed,OLD.orderSeed);assert.notEqual(TOURNAMENT.bootstrapSeed,OLD.bootstrapSeed);
 assert.equal(TOURNAMENT.capMinutes,240);assert.throws(()=>requireRegistration(TOURNAMENT));
 assert.equal(schedule().length,512);const cells=new Map();
 for(const s of slots()){const k=[s.policy,s.parity,s.reverse?-s.player:s.player,s.firstColor].join(':');cells.set(k,(cells.get(k)??0)+1);}
 assert.equal(cells.size,16);assert.ok([...cells.values()].every(n=>n===16));
 for(let i=0;i<512;i+=2){const [a,b]=schedule().slice(i,i+2);assert.equal(a.family,b.family);assert.equal(a.color,-b.color);assert.equal(a.timeMs,300);assert.equal(b.timeMs,300);}
});
test('300ms statistics retain exact bounded threshold, full-family sensitivity and unfavorable samples',()=>{
 const rows=slots().map(s=>({family:s.family,cell:s.cell,score:.5,margin:0})),a=summarize(rows,TOURNAMENT.bootstrapSeed);
 assert.equal(a.mean,.5);assert.equal(a.studentOneSided95Lower,.5);assert.ok(Math.abs(.5-a.hoeffdingOneSided95Lower-.07649208846)<1e-9);
 assert.deepEqual(a.scoreBootstrap95,[.5,.5]);assert.ok(summarize(rows.map(r=>({...r,score:0}))).hoeffdingOneSided95Lower<0);
 assert.throws(()=>summarize(rows.slice(1)));
});
