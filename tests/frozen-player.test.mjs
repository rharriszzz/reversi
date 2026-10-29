import test from 'node:test';
import {legalMoves,play} from '../src/rules.js';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PROTOCOL,assessmentSlots,gameSchedule,hash } from '../scripts/frozen-player/protocol.mjs';
import { frozenModels } from '../scripts/frozen-player/models.mjs';
import { playGame,replay } from '../scripts/frozen-player/game.mjs';
import { receipt,verifyReceipt } from '../scripts/frozen-player/receipts.mjs';
import { historyAvailability } from '../scripts/frozen-player/history.mjs';
import { studentCDF,studentCritical,pairSummary,jointGameBootstrap,nomination } from '../scripts/frozen-player/statistics.mjs';
import { read } from '../scripts/research/io.mjs';

test('exact published L/P reconstruct with checksum, metadata and unsupported-zero validation',()=>{
  const m=frozenModels();assert.equal(m.L.checksum,PROTOCOL.models.L);assert.equal(m.P.checksum,PROTOCOL.models.P);
  assert.equal(m.P.linearChecksum,m.L.checksum);assert.equal(m.P.coefficients.length,10932);
});
test('complete fixed design balances all cells, shared controls and independent budget families',()=>{
  const slots=assessmentSlots(),schedule=gameSchedule();assert.equal(slots.length,128);
  assert.equal(slots.filter(s=>s.diagnostic).length,32);
  for(let cell=0;cell<16;cell++) {
    const rows=slots.filter(s=>s.cell===cell);assert.equal(rows.length,8);
    assert.equal(rows.filter(r=>r.player===1).length,4);assert.equal(rows.filter(r=>r.parity===0).length,4);
    assert.equal(rows.filter(r=>r.diagnostic).length,2);
  }
  assert.equal(schedule.length,384);assert.equal(new Set(schedule.map(s=>s.family)).size,96);
  for(const candidate of ['L','P'])for(const timeMs of [80,300]) {
    const rows=schedule.filter(r=>r.candidate===candidate&&r.timeMs===timeMs);assert.equal(rows.length,timeMs===80?128:64);
    for(const family of new Set(rows.map(r=>r.family)))assert.deepEqual(new Set(rows.filter(r=>r.family===family).map(r=>r.color)),new Set([1,-1]));
  }
  assert.equal(PROTOCOL.games.positionalGate,null);assert.equal(PROTOCOL.training,false);assert.equal(PROTOCOL.promotion,false);
  assert.throws(()=>{PROTOCOL.models.L='changed';},TypeError);
});
test('real timed production game checkpoints replay passes, early terminals and reject identity/tampering',async()=>{
  const {L}=frozenModels(),opening={id:'disclosed-pass',board:[0,-1,...Array(62).fill(1)],player:-1};let checkpoint;
  const first=await playGame(opening,L,1,80,{checkpoint:s=>{checkpoint=structuredClone(s);}});
  assert.equal(first.moves[0].move,null);assert.equal(first.margin,64);assert.equal(first.points,1);assert.equal(first.replayed,true);
  assert.deepEqual(replay(opening,first.moves,{complete:true}).board,first.board);
  const resumed=await playGame(opening,L,1,80,{resume:checkpoint});assert.deepEqual(resumed,first);
  await assert.rejects(playGame(opening,L,-1,80,{resume:checkpoint}));
  const altered=structuredClone(checkpoint);altered.board[0]=-1;await assert.rejects(playGame(opening,L,1,80,{resume:altered}));
  const {checksum,...body}=altered;altered.checksum=hash(body);await assert.rejects(playGame(opening,L,1,80,{resume:altered}));
  assert.throws(()=>replay(opening,[{player:-1,move:0}]),/illegal/);
});
test('immutable completed receipts reuse work, but reject changed inputs and numerical tampering',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'frozen-player-'));
  try {
    const path=join(dir,'task.json');let calls=0;
    assert.deepEqual(await receipt(path,'input',async()=>{calls++;return {value:17};}),{value:17});
    await receipt(path,'input',async()=>{calls++;});assert.equal(calls,1);
    await assert.rejects(receipt(path,'different',async()=>0),/identity/);
    const r=read(path);r.result.value++;assert.throws(()=>verifyReceipt(r,'input'),/digest/);
    assert.equal(historyAvailability(dir).independentLaunchPermitted,false);
    assert.equal(historyAvailability(dir).verifiedRoleIndexAvailable,false);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('pair-level Student and bounded inference agree with reference constants, RNG bootstrap is nondegenerate',()=>{
  assert.ok(Math.abs(studentCritical(31)-2.0395134464)<1e-9);
  assert.ok(Math.abs(studentCritical(63)-1.9983405425)<1e-9);
  assert.ok(Math.abs(studentCDF(1,1)-.75)<1e-12);
  const rows=Array.from({length:64},(_,family)=>({family,L:(family%5)/4,P:1-(family%5)/4}));
  const joint=jointGameBootstrap(rows),l=pairSummary(rows.map(r=>r.L));
  assert.ok(Math.abs(l.hoeffdingRadius-.1697626895)<1e-8);
  assert.ok(joint.L.distinctResampledMeans>20);assert.deepEqual(joint,jointGameBootstrap(rows));
  assert.ok(joint.indirectPminusL.interval95[0]<joint.indirectPminusL.interval95[1]);
  assert.throws(()=>jointGameBootstrap([...rows,rows[0]]),/families/);
  assert.throws(()=>pairSummary([0,2]));
  assert.deepEqual(nomination({L:{n:64,mean:.55},P:{n:64,mean:.55}},{L:{n:32,mean:.5},P:{n:32,mean:.5}}),
    {candidate:'L',developmentDecisionOnly:true,production:'B'});
  assert.throws(()=>nomination({L:{n:2},P:{n:64}},{L:{n:32},P:{n:32}}),/complete/);
});

test('independent sealed-label replay handles normalized root passes exactly once', async()=>{
  const {replayTeacher}=await import('../scripts/frozen-player/analyze.mjs');
  // A known forced-pass board is disclosed by the adapter extrema fixtures.
  const {extremeFixtures}=await import('../scripts/teacher/bound-preflight.mjs');
  const s=extremeFixtures().find(s=>!legalMoves(s.board,s.player).length&&legalMoves(s.board,-s.player).length);
  assert.ok(s);let visited=0;
  replayTeacher(s,{rows:[{move:null,pv:[null]}]},()=>visited++);
  assert.equal(visited,2);
  assert.throws(()=>replayTeacher(s,{rows:[{move:null,pv:[null,null]}]}));
});

test('admission exempts terminal convergence but retains nonterminal ancestry and direct children', async()=>{
  const {admissionKeys}=await import('../scripts/frozen-player/execution.mjs');
  const {trajectory}=await import('../scripts/machine-benchmark/suite.mjs');
  const {keysFor}=await import('../scripts/residual/data.mjs');
  const states=trajectory(74102901),root=states.find(s=>s.board.filter(Boolean).length===16);
  const finished=Array(64).fill(1),tr={root,history:[root,{board:finished,player:1}]};
  const keys=admissionKeys(tr);
  for(const k of keysFor(root.board))assert.ok(keys.all.has(k));
  for(const k of keysFor(finished))assert.ok(!keys.all.has(k));
  for(const move of legalMoves(root.board,root.player))for(const k of keysFor(play(root.board,root.player,move)))assert.ok(keys.all.has(k));
});

test('scientific worker receipts survive a new pool and reject changed inputs',async()=>{
  const {Pool}=await import('../scripts/frozen-player/pool.mjs');
  const {trajectory}=await import('../scripts/machine-benchmark/suite.mjs');
  const directory=mkdtempSync(join(tmpdir(),'reversi frozen scientific ')),state=trajectory(74102901).find(s=>s.board.filter(Boolean).length===16);
  const job={type:'search',state,depth:4,model:'B'};let first=new Pool(1,directory,'engineering-identity');
  try{
    const expected=await first.task('disclosed-search',job);await first.close();
    const second=new Pool(1,directory,'engineering-identity');
    assert.deepEqual(await second.task('disclosed-search',job),expected);
    await assert.rejects(second.task('disclosed-search',{...job,depth:5}),/mismatch/);
    assert.equal(second.slots[0].worker,null,'reused completed work creates no worker');
    await second.close();
  }finally{await first.close();rmSync(directory,{recursive:true,force:true});}
});
