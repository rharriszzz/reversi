import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {build} from '../scripts/native/build.mjs';
import {NativeEngine} from '../scripts/native/client.mjs';
import {WasmEngine,manifest} from '../src/wasm-engine.js';
import {oracleScore,oracleChildren} from './oracle.mjs';
import {seededRandom,randomOpening} from '../src/learning.js';
import {frozenModels} from '../scripts/frozen-player/models.mjs';
import {compile} from '../scripts/next-residual/model.mjs';

test('last one/two empties preserve shallow horizons, passes, raw terminal margins and every alternative in native and actual Wasm',async()=>{
 const receipt=process.env.NATIVE_SANITIZE?build({sanitize:true,directory:resolve('.local-research/mac-endgame-sanitize')}):null;
 const native=new NativeEngine({receipt}),wasm=await WasmEngine.create({moduleOptions:{wasmBinary:readFileSync(new URL(`../src/wasm/${manifest.module.replace('.mjs','.wasm')}`,import.meta.url))}});
 const rng=seededRandom(0x4d344c45),boards=[];
 // Every possible final empty square, both turns, arbitrary long rays and
 // terminal/pass occupancies. Two-empty shallow D1 must remain heuristic.
 for(let q=0;q<64;q++)for(const empties of [1,2]) {
  const b=Array.from({length:64},()=>rng()<.5?1:-1);b[q]=0;
  if(empties===2)b[(q+1+Math.floor(rng()*63))%64]=0;boards.push(b);
 }
 for(let i=0;i<12;i++)boards.push([...randomOpening(seededRandom(0x4d344c80+i),54+i%6).board]);
 boards.push(Array.from({length:64},(_,i)=>i<48?1:0),Array(64).fill(0),Array(64).fill(1),Array.from({length:64},(_,q)=>q%2?1:-1));
 const evaluators=Object.fromEntries(Object.entries(frozenModels()).map(([m,v])=>[m,compile(v).evaluate]));
 try {
  await native.ready();
  for(const board of boards)for(const player of [1,-1])for(const model of ['B','L','P']) {
   const zero=oracleScore(board,player,0,evaluators[model]);
   assert.equal((await native.windows(board,player,model,0,[[-1e9,1e9]])).values[0]||0,zero||0);
   assert.equal(wasm.windows(board,player,model,0,-1e9,1e9).at(-1)||0,zero||0);
   for(const depth of [1,2,64]) {
    const expected=oracleScore(board,player,depth,evaluators[model]);
    const n=await native.search(board,player,{model,depth}),w=wasm.search(board,player,{model,depth});
    assert.equal(n.score||0,expected||0);assert.equal(w.score||0,expected||0);
    assert.equal(n.exact,w.exact);if(depth===64)assert.equal(w.exact,true);
   }
   for(const child of oracleChildren(board,player)) {
    const expected=-oracleScore(child.board,-player);
    const n=await native.search(child.board,-player,{model,depth:64}),w=wasm.search(child.board,-player,{model,depth:64});
    assert.equal(-n.score||0,expected||0);assert.equal(-w.score||0,expected||0);
   }
  }
 }finally{native.close();wasm.close();}
});
