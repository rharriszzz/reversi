import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {compare,calibrationPass,assessGates,feasible,parallel,receipt,writerLock,PROTOCOL} from '../scripts/teacher/qualification-core.mjs';
import {identity,alternatives} from '../scripts/teacher/edax.mjs';
import {trajectory,solve} from '../scripts/teacher/validate.mjs';
import {counts} from '../src/rules.js';
const result=xs=>({rows:xs.map((value,move)=>({value,move,pv:[]}))});
test('qualification regret distinguishes ties, near ties, reversals and outcome signs',()=>{
 let r=compare(result([2,2]),result([1,2]),0);assert.equal(r.regret,1);assert.equal(r.choiceStable,false);assert.equal(r.worstTiedRegret,1);
 r=compare(result([6,0]),result([-2,2]),0);assert.equal(r.regret,4);assert.equal(r.reversal,true);assert.equal(r.signError,true);
 r=compare(result([2,0]),result([3,1]),1);assert.equal(r.useful,true);assert.equal(r.bRegret,2);
 assert.throws(()=>compare(result([1,2]),result([1])));
});
test('qualification gates retain fixed denominators and timing allowance',()=>{
 const good=compare(result([4,0]),result([4,0]),1),rows=Array.from({length:256},(_,i)=>({...good,phase:Math.floor(i/64)}));
 assert.ok(Object.values(assessGates(rows,Array(32).fill(0),true)).every(Boolean));
 assert.equal(assessGates(rows.slice(1),Array(32).fill(0),true).integrity,false);
 assert.equal(assessGates(rows,Array(32).fill(0),false).exactCalibration,false);
 assert.equal(calibrationPass(Array(24).fill(good)),true);assert.equal(calibrationPass(Array(23).fill(good)),false);
 assert.equal(feasible(1000,1000,PROTOCOL.reportReserveMs+2350),true);assert.equal(feasible(1000,1001,PROTOCOL.reportReserveMs+2350),false);
});
test('immutable tasks recover completed work and reject changed inputs; deterministic bounded workers',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'qualification-'));try{let calls=0;const f=()=>receipt(join(dir,'task.json'),{depth:12},'run',async()=>++calls);
 assert.equal(await f(),1);assert.equal(await f(),1);assert.equal(calls,1);await assert.rejects(receipt(join(dir,'task.json'),{depth:14},'run',async()=>0),/identity/);
 const inputs=[9,3,7,1];assert.deepEqual(await parallel(inputs,1,async x=>x*x),await parallel(inputs,2,async x=>x*x));
 let active=0,peak=0;await parallel(inputs,2,async()=>{peak=Math.max(peak,++active);await new Promise(ok=>setTimeout(ok,2));active--;});assert.equal(peak,2);
 const release=writerLock(join(dir,'lock'));assert.throws(()=>writerLock(join(dir,'lock')),/Active/);release();
 writeFileSync(join(dir,'lock'),JSON.stringify({pid:2147483647}));writerLock(join(dir,'lock'))();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('native wrapper validates full alternatives and measures actual child CPU/RSS',async()=>{
 if(!process.env.REVERSI_NATIVE_TEST)return;const pin=identity('.local-research/teacher/edax/bin/lEdax-x86-64-v3','.local-research/teacher/edax/bin/data/eval.dat');
 const state=trajectory(738015).find(s=>counts(s.board).empty===6),ref=solve(state.board,state.player);
 const r=await alternatives(pin,state,6,{measureNative:true});assert.ok(r.native.userSeconds>=0);assert.ok(r.native.maxRssBytes>0);assert.deepEqual(r.rows.map(x=>[x.move,x.value]),ref.rows.map(x=>[x.move,x.value]));
 await assert.rejects(alternatives(pin,state,6,{measureNative:true,timeoutMs:1}),/failure/);
});
test('exact calibration rejects worsening decisions despite improved depth agreement',async()=>{
 const {exactCalibration}=await import('../scripts/teacher/qualification-core.mjs');
 const rows=[10,12].map(empty=>({empty,measures:Object.fromEntries([6,8,10].map(d=>[d,{regret:d===6?2:1,wdlError:false,rawWdlError:false}]))}));
 assert.equal(exactCalibration(rows).pass,true);rows[1].measures[10].wdlError=true;assert.equal(exactCalibration(rows).pass,false);
});
test('a process crash preserves committed receipts and resume computes only unfinished work',async()=>{
 const {spawnSync}=await import('node:child_process');const {readFileSync}=await import('node:fs');
 const dir=mkdtempSync(join(tmpdir(),'qualification-crash-'));try{
  const module=new URL('../scripts/teacher/qualification-core.mjs',import.meta.url).href;
  const code=`import {receipt} from ${JSON.stringify(module)};import {appendFileSync} from 'node:fs';const [dir,mode]=process.argv.slice(1);await receipt(dir+'/a.json',{depth:12},'frozen',async()=>{appendFileSync(dir+'/calls','a');return 1;});if(mode==='crash')process.kill(process.pid,'SIGKILL');await receipt(dir+'/b.json',{depth:14},'frozen',async()=>{appendFileSync(dir+'/calls','b');return 2;});`;
  const a=spawnSync(process.execPath,['--input-type=module','-e',code,dir,'crash']);assert.equal(a.signal,'SIGKILL');const before=readFileSync(join(dir,'a.json'),'utf8');
  assert.equal(spawnSync(process.execPath,['--input-type=module','-e',code,dir,'resume']).status,0);assert.equal(readFileSync(join(dir,'a.json'),'utf8'),before);assert.equal(readFileSync(join(dir,'calls'),'utf8'),'ab');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('capped exact worker reports failure without admitting an approximate reference',async()=>{
 const {Worker}=await import('node:worker_threads');const state=trajectory(738015).find(s=>counts(s.board).empty===10);
 const r=await new Promise((ok,bad)=>{const w=new Worker(new URL('../scripts/teacher/qualification-exact.mjs',import.meta.url),{workerData:{state,capMs:0}});w.once('message',ok);w.once('error',bad);});
 assert.match(r.error,/cap/);assert.ok(r.cpuMs>=0);assert.equal(r.awarded,undefined);
});
test('future historical exclusion loads qualification trajectories and every root alternative',async()=>{
 const {mkdirSync}=await import('node:fs');const {historicalKeys}=await import('../scripts/strong/run.mjs');const {canonical}=await import('../scripts/research/core.mjs');const {initialBoard,legalMoves,play}=await import('../src/rules.js');
 const dir=mkdtempSync(join(tmpdir(),'qualification-history-'));try{mkdirSync(join(dir,'run/tasks'),{recursive:true});mkdirSync(join(dir,'run/trajectories'));const root={id:'cost-0',board:[...initialBoard()],player:1,seed:71};
 writeFileSync(join(dir,'run/manifest.json'),'{}');writeFileSync(join(dir,'run/tasks/reservation.json'),JSON.stringify({result:{roles:{cost:[root]}}}));writeFileSync(join(dir,'run/trajectories/cost-0.json'),JSON.stringify({history:[root]}));
 const h=historicalKeys(dir,[join(dir,'run')]);assert.equal(h.audit.localTrajectories,1);for(const m of legalMoves(root.board,1))assert.ok(h.keys.has(canonical(play(root.board,1,m),-1)));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('unclean recovery conservatively charges checkpoint gaps and changed boots',async()=>{
 const {recoveryCharge}=await import('../scripts/teacher/qualification-core.mjs');const state={status:'running',stage:'admission',bootId:'boot',heartbeatBootMs:1000};
 assert.equal(recoveryCharge(state,21000,'boot'),20000);assert.equal(recoveryCharge(state,2000,'boot'),5000);assert.equal(recoveryCharge(state,2000,'other'),PROTOCOL.stageCaps.admission);assert.equal(recoveryCharge({...state,status:'stopped'},2000,'other'),0);
});
