import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {build} from '../scripts/native/build.mjs';
import {NativeEngine,decodeBoard} from '../scripts/native/client.mjs';
import {positions} from '../scripts/native-v2/positions.mjs';
import {oracleChildren} from './oracle.mjs';
import {seededRandom,randomOpening} from '../src/learning.js';
import {solveExact} from '../scripts/teacher/exact.mjs';
import {frozenModels} from '../scripts/frozen-player/models.mjs';
import {compile} from '../scripts/next-residual/model.mjs';
const receipt=build({sanitize:!!process.env.NATIVE_SANITIZE,directory:resolve(process.env.NATIVE_SANITIZE?'.local-research/native-v2-test-sanitize':'.local-research/native-v2-test')});
const utility=v=>v?Math.sign(v)*10000+v:0;
test('v2 arbitrary occupancies and long directional configurations match independent rules',async()=>{
 const e=new NativeEngine({receipt}),rng=seededRandom(0x56325255);try{
  const boards=Array.from({length:768},()=>Array.from({length:64},()=>Math.floor(rng()*3)-1));
  const dirs=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
  for(let q=0;q<64;q++)for(const [dr,dc] of dirs)for(let n=1;n<=6;n++){
   const row=q>>3,col=q&7,endR=row+(n+1)*dr,endC=col+(n+1)*dc;
   if(endR<0||endR>7||endC<0||endC>7)continue;
   const b=Array(64).fill(0);for(let k=1;k<=n;k++)b[(row+k*dr)*8+col+k*dc]=-1;b[endR*8+endC]=1;boards.push(b);
  }
  for(const b of boards)for(const p of [1,-1]){
   const r=await e.inspect(b,p,'P');assert.deepEqual(r.children.map(c=>({move:c.move,board:decodeBoard(c)})),oracleChildren(b,p));
  }
 }finally{e.close();}
});
test('v2 fixed depths 15..64, all exact alternatives and zero-horizon forced passes',async()=>{
 const e=new NativeEngine({receipt});try{
  for(const [i,plies] of [[0,49],[1,50],[2,52]]){
   const p=randomOpening(seededRandom(0x56325800+i),plies),ref=solveExact(p.board,p.player,false,performance.now()+20000);
   for(const model of ['B','L','P']){
    for(const depth of [15,16,64]){const r=await e.search(p.board,p.player,{model,depth});assert.equal(r.score||0,utility(ref.value));assert.equal(r.depth,depth);assert.equal(r.exact,true);}
    for(const row of ref.rows){const c=oracleChildren([...p.board],p.player).find(c=>c.move===row.move);const r=await e.search(c.board,-p.player,{model,depth:15});assert.equal((-r.score)||0,utility(row.value));}
   }
  }
  const pass=positions().find(p=>p.id==='forced-pass'),ev=compile(frozenModels().P).evaluate;
  for(const depth of [0,1,15,64]){
   const child=await e.windows(pass.board,-pass.player,'P',depth,[[-1e9,1e9]]);
   const r=await e.windows(pass.board,pass.player,'P',depth,[[-1e9,1e9]]);assert.equal(r.values[0],-child.values[0]);
  }
  assert.ok(Number.isFinite(ev(pass.board,pass.player)));
  await assert.rejects(e.search(pass.board,pass.player,{depth:65}),/Invalid/);
  await assert.rejects(e.request('search 0 0 1 0 0 0 1 1 0 0'),/Invalid/);
 }finally{e.close();}
});
test('v2 natural timed maximum exceeds 14 and interrupted iteration retains a completed result',async()=>{
 const e=new NativeEngine({receipt});try{
  const p=randomOpening(seededRandom(0x56320005),45);
  await e.ready();const fixed=await e.search(p.board,p.player,{model:'B',depth:15});
  const r=await e.search(p.board,p.player,{model:'B',timeMs:3000});assert.ok(r.depth>14);assert.equal(r.exact,true);assert.equal(r.score,fixed.score);
  const q=positions()[2],one=await e.search(q.board,q.player,{depth:1});
  const interrupted=await e.search(q.board,q.player,{timeMs:60000,nodeLimit:one.nodes+1});
  assert.equal(interrupted.depth,1);assert.equal(interrupted.score,one.score);assert.equal(interrupted.timedOut,true);
  const leaves=await e.search(q.board,q.player,{depth:1});assert.equal(leaves.ttProbes,0);
 }finally{e.close();}
});
test('v2 generation rollover, depth storage and independent fixed node budget in standalone core',()=>{
 const dir=resolve(receipt.executable,'..'),executable=resolve(dir,'internals-test');
 execFileSync(process.env.CXX??'c++',[...receipt.flags,'-I','native','-I',dir,'native/engine.cpp','tests/native-internals.cpp','-o',executable]);
 execFileSync(executable,[],{timeout:30000});
});
