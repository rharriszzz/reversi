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

test('reservation import replays source moves, pass/terminal history, seed, board and canonical identity',async()=>{
 const {verifyTrajectory}=await import('../scripts/teacher/qualification-import.mjs');const {seedFor}=await import('../scripts/research/io.mjs');const {canonical}=await import('../scripts/research/core.mjs');const {seededRandom}=await import('../src/learning.js');const {initialBoard,legalMoves,play}=await import('../src/rules.js');
 const namespace='import-test',seed=seedFor(namespace,'assessment',0),target=12+Math.floor(seededRandom(seed)()*8),rng=seededRandom(seed);let board=[...initialBoard()],player=1,passes=0,root;const moves=[],history=[];
 while(passes<2){const legal=legalMoves(board,player),occupied=board.filter(Boolean).length;if(occupied>=12)history.push({board:[...board],player});if(occupied===target&&!root)root={board:[...board],player,id:'assessment-0',role:'assessment',phase:0,policy:'B1-12%',seed,index:0,occupied,key:canonical(board,player)};
 if(!legal.length){passes++;moves.push({player,move:null});player=-player;continue;}passes=0;const move=legal[Math.floor(rng()*legal.length)];moves.push({player,move});board=[...play(board,player,move)];player=-player;}
 const tr={...root,moves,history,terminal:board};assert.ok(verifyTrajectory(root,tr,namespace).size>0);
 for(const [changed,trajectory] of [[{...root,player:0},tr],[{...root,key:'wrong'},tr],[{...root,seed:seed+1},{...tr,seed:seed+1}],[root,{...tr,moves:tr.moves.slice(1)}],[root,{...tr,history:tr.history.slice(1)}],[root,{...tr,terminal:Array(64).fill(0)}]])assert.throws(()=>verifyTrajectory(changed,trajectory,namespace));
 const {importReservations}=await import('../scripts/teacher/qualification-import.mjs');const {atomic}=await import('../scripts/research/io.mjs');const dir=mkdtempSync(join(tmpdir(),'import-leakage-'));try{
 atomic(`${dir}/trajectories/${root.id}.json`,tr);const inspection={dir,old:{protocol:{namespace}},reservation:{roles:{assessment:Array(256).fill(root),'exact-assessment':Array(64).fill(root)}}};
 assert.throws(()=>importReservations('',dir,{keys:new Set(),seeds:new Set([seed])},()=>{},inspection),/seed/);
 assert.throws(()=>importReservations('',dir,{keys:verifyTrajectory(root,tr,namespace),seeds:new Set()},()=>{},inspection),/leakage/);
 assert.throws(()=>importReservations('',dir,{keys:new Set(),seeds:new Set()},()=>{},inspection),/seed|policy/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('reservation import rejects changed original reservation bytes',async()=>{
 const {inspectOriginal,ORIGINAL_RESERVATION}=await import('../scripts/teacher/qualification-import.mjs');const {atomic}=await import('../scripts/research/io.mjs');const dir=mkdtempSync(join(tmpdir(),'import-digest-'));try{const old=`${dir}/.local-research/${ORIGINAL_RESERVATION.directory}`;atomic(`${old}/tasks/reservation.json`,{result:{roles:{}}});atomic(`${old}/results.json`,{});atomic(`${old}/manifest.json`,{});assert.throws(()=>inspectOriginal(dir),/digest mismatch/);}finally{rmSync(dir,{recursive:true,force:true});}
});


test('partial publication retains only fully completed predetermined roots and requires fixed odd checks',async()=>{
 const {assessmentRecords}=await import('../scripts/teacher/qualification-publish.mjs');const reservation={roles:{assessment:[{id:'assessment-0',phase:0,policy:'B1-12%'},{id:'assessment-1',phase:0,policy:'B4-2%'}]},import:{oddIds:['assessment-0']}};
 const tasks={'assessment-0-d10':result([4,0]),'assessment-0-d12':result([4,0]),'assessment-0-b6':{move:1},'assessment-1-d10':result([1,2])};
 let x=assessmentRecords(reservation,tasks,{h:10,r:12});assert.equal(x.records.length,0);assert.deepEqual(x.missing[0].tasks,['assessment-0-d11']);
 tasks['assessment-0-d11']=result([2,4]);x=assessmentRecords(reservation,tasks,{h:10,r:12});assert.equal(x.records.length,1);assert.equal(x.records[0].oddRegret,2);assert.equal(x.records[0].useful,true);assert.equal(x.missing[0].id,'assessment-1');
});
test('published qualification boards enter historical exclusions without local run files',async()=>{
 const {historicalKeys}=await import('../scripts/strong/run.mjs');const {canonical}=await import('../scripts/research/core.mjs');const {atomic}=await import('../scripts/research/io.mjs');const dir=mkdtempSync(join(tmpdir(),'v3-published-history-'));try{const board=trajectory(91407)[20].board;atomic(`${dir}/docs/data/teacher-depth-qualification-v3-20261028.json`,{example:{board}});assert.ok(historicalKeys(dir,[]).keys.has(canonical(board,1)));}finally{rmSync(dir,{recursive:true,force:true});}
});
