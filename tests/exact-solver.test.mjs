import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {ExactSolver,ExactAbort,solveBoth,solveExact} from '../scripts/teacher/exact.mjs';
import {solveReference} from '../scripts/teacher/reference-exact.mjs';
import {trajectory} from '../scripts/teacher/validate.mjs';
import {oracleChildren,oracleScore} from './oracle.mjs';
const pairs=r=>r.rows.map(({move,value})=>[move,value||0]);
const state=(seed,empty=6)=>trajectory(seed).find(s=>s.board.filter(x=>!x).length===empty);
const rotate=b=>b.map((_,i)=>b[(7-(i&7))*8+(i>>3)]);
test('independent optimized search matches original and exhaustive minimax for every alternative',()=>{
 for(let i=0;i<80;i++){
  const s=state(890300+i,i<16?4:6),before=[...s.board];
  for(const awarded of [false,true]){
   const ref=solveReference(s.board,s.player,awarded),r=solveExact(s.board,s.player,awarded);
   assert.equal(r.value,ref.value||0);assert.deepEqual(pairs(r),pairs(ref));assert.equal(r.exact,true);
   if(!awarded&&i<16)for(const child of oracleChildren(s.board,s.player)){
    const score=oracleScore(child.board,-s.player),margin=score?score-Math.sign(score)*10000:0;
    assert.equal(r.rows.find(x=>x.move===child.move).value,-margin||0);
   }
  }
  assert.deepEqual(s.board,before);
 }
});
test('both conventions, passes, terminal empties, draws and color/turn transforms',()=>{
 for(const [b,p,raw,award] of [[Array(64).fill(0),1,0,0],[[0,...Array(63).fill(1)],1,63,64],[[0,...Array(63).fill(1)],-1,-63,-64],[Array.from({length:64},(_,i)=>i%2?1:-1),1,0,0]]){
  const r=solveBoth(b,p);assert.equal(r.raw.value,raw);assert.equal(r.awarded.value,award);assert.equal(r.raw.rows.length,0);
 }
 let pass=null;for(let i=0;i<100&&!pass;i++)pass=trajectory(840100+i).find(s=>s.board.filter(x=>!x).length<=6&&!oracleChildren(s.board,s.player).length&&oracleChildren(s.board,-s.player).length);
 assert.ok(pass);for(const awarded of [false,true])assert.equal(solveExact(pass.board,pass.player,awarded).value,solveReference(pass.board,pass.player,awarded).value);
 for(let i=0;i<12;i++){
  const s=state(890800+i),r=solveBoth(s.board,s.player),color=solveBoth(s.board.map(x=>-x),-s.player),rot=solveBoth(rotate(s.board),s.player);
  for(const k of ['raw','awarded']){assert.deepEqual(pairs(r[k]),pairs(color[k]));for(const row of r[k].rows){const mapped=(row.move&7)*8+7-(row.move>>3);assert.equal(rot[k].rows.find(x=>x.move===mapped).value,row.value);}}
 }
});
test('TT lower/upper bounds, collisions and compatible reuse preserve full-window alternatives',()=>{
 let lower=0,upper=0,hits=0;
 const solver=new ExactSolver({tableBits:12});
 for(let i=0;i<12;i++){
  const s=state(891100+i,8),ref=solveReference(s.board,s.player,true),r=solver.solve(s.board,s.player,true),cached=solver.solve(s.board,s.player,true);
  assert.deepEqual(pairs(r),pairs(ref));assert.deepEqual(pairs(cached),pairs(ref));lower+=r.stats.ttLowerHits;upper+=r.stats.ttUpperHits;hits+=cached.stats.ttExactHits;
  // Deliberately force every hash to the same slot; full-key comparison is mandatory.
  const collided=new ExactSolver({tableBits:0}).solve(s.board,s.player,true);assert.deepEqual(pairs(collided),pairs(ref));
  const raw=solver.solve(s.board,s.player,false);assert.deepEqual(pairs(raw),pairs(solveReference(s.board,s.player,false)));
 }
 assert.ok(lower>0&&upper>0&&hits>0);
 // Same board with another turn is another key and can have another exact value.
 const s=state(891500);for(const p of [-1,1])assert.deepEqual(pairs(solver.solve(s.board,p,true)),pairs(solveReference(s.board,p,true)));
});
test('expired combined deadlines and cancellation throw without publishing partial exact results',async()=>{
 const s=state(891900,10);assert.throws(()=>solveBoth(s.board,s.player,{capMs:0}),ExactAbort);
 const controller=new AbortController();let solver;
 solver=new ExactSolver({signal:controller.signal,onNode:n=>{if(n===300)controller.abort();}});
 assert.throws(()=>solver.solve(s.board,s.player),/cancelled/);solver.signal=null;assert.deepEqual(pairs(solver.solve(s.board,s.player)),pairs(solveReference(s.board,s.player)));
 assert.deepEqual(pairs(solveExact(s.board,s.player)),pairs(solveReference(s.board,s.player)));
 // Terminating an expensive worker never produces an exact result.
 const w=new Worker(new URL('../scripts/teacher/qualification-exact.mjs',import.meta.url),{workerData:{state:s,capMs:0}});
 const result=await new Promise((ok,bad)=>{w.once('message',ok);w.once('error',bad);});assert.match(result.error,/cap|deadline/);assert.equal(result.awarded,undefined);
 assert.throws(()=>new ExactSolver({tableBits:23}));assert.throws(()=>solveExact([0],1));
});
test('live alternatives retain distinct terminal conventions and independent continuation witnesses',()=>{
 const board=Array(64).fill(1);for(const m of [0,3,8,16])board[m]=0;for(const m of [1,17])board[m]=-1;
 const shared=new ExactSolver({tableBits:6});
 for(const awarded of [true,false,true,false]){
  const r=shared.solve(board,1,awarded),ref=solveReference(board,1,awarded);assert.deepEqual(pairs(r),pairs(ref));assert.ok(r.rows.length>=2);assert.equal(r.value,awarded?64:63);
 }
 const s=state(890300,6),r=solveBoth(s.board,s.player);assert.ok(new Set(r.raw.rows.map(x=>x.value)).size>1);
 for(const awarded of [false,true])for(const first of oracleChildren(s.board,s.player)){
  let board=first.board,p=-s.player,passes=0,placements=1;
  while(passes<2){const children=oracleChildren(board,p);if(!children.length){passes++;p=-p;continue;}passes=0;
   const ref=solveReference(board,p,awarded),move=ref.rows.find(x=>x.value===ref.value).move;board=children.find(x=>x.move===move).board;p=-p;placements++;
  }
  const raw=board.reduce((n,x)=>n+x*s.player,0),value=raw+(awarded?Math.sign(raw)*board.filter(x=>!x).length:0);
  assert.equal(r[awarded?'awarded':'raw'].rows.find(x=>x.move===first.move).value,value||0);assert.ok(placements<=6);
 }
});
test('all eight board symmetries preserve every exact alternative',()=>{
 const s=state(892300,8),r=solveBoth(s.board,s.player);
 for(let reflect=0;reflect<2;reflect++)for(let rotations=0;rotations<4;rotations++){
  const map=i=>{let row=i>>3,col=i&7;if(reflect)col=7-col;for(let k=0;k<rotations;k++)[row,col]=[col,7-row];return row*8+col;};
  const board=Array(64);for(let i=0;i<64;i++)board[map(i)]=s.board[i];const transformed=solveBoth(board,s.player);
  for(const k of ['raw','awarded'])for(const row of r[k].rows)assert.equal(transformed[k].rows.find(x=>x.move===map(row.move)).value,row.value);
 }
});
test('engineering benchmark trajectories enter future historical exclusions',async()=>{
 const {mkdtempSync,mkdirSync,writeFileSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {historicalKeys}=await import('../scripts/strong/run.mjs');const {canonical}=await import('../scripts/research/core.mjs');
 const dir=mkdtempSync(join(tmpdir(),'exact-history-'));try{
  const root={...state(892900),id:'fresh-6-0'},child=oracleChildren(root.board,root.player)[0];mkdirSync(join(dir,'run/trajectories'),{recursive:true});writeFileSync(join(dir,'run/results.json'),JSON.stringify({protocol:{namespace:'exact-engineering-test'},inputs:{states:[root]}}));writeFileSync(join(dir,'run/trajectories/fresh-6-0.json'),JSON.stringify({history:[root,child]}));
  const h=historicalKeys(dir,[join(dir,'run')]);assert.equal(h.audit.missingLocalInputs,0);assert.equal(h.audit.localTrajectories,1);assert.ok(h.keys.has(canonical(child.board,-root.player)));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('parent cancellation terminates a worker without a partial exact message',async()=>{
 const s=state(893200,30),worker=new Worker(new URL('../scripts/teacher/qualification-exact.mjs',import.meta.url),{workerData:{state:s,capMs:10000}});let published=false;worker.on('message',()=>{published=true;});
 await new Promise((ok,bad)=>{worker.once('online',()=>setTimeout(ok,1));worker.once('error',bad);});await worker.terminate();assert.equal(published,false);
});
