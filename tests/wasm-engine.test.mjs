import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {WasmEngine,manifest} from '../src/wasm-engine.js';
import {NativeEngine,decodeBoard} from '../scripts/native/client.mjs';
import {initialBoard,legalMoves,play,parseCoord} from '../src/rules.js';
import {extractFeatures} from '../src/features.js';
import {seededRandom,randomOpening} from '../src/learning.js';
import {findBestMove} from '../src/search.js';
import {compile} from '../scripts/next-residual/model.mjs';
import {frozenModels} from '../scripts/frozen-player/models.mjs';
import {oracleScore,oracleChildren} from './oracle.mjs';
import {positions} from '../scripts/native-v2/positions.mjs';
const binary=readFileSync(new URL(`../src/wasm/${manifest.module.replace('.mjs','.wasm')}`,import.meta.url));
const create=options=>WasmEngine.create({...options,moduleOptions:{wasmBinary:binary}});
const models=frozenModels(),ev=Object.fromEntries(Object.entries(models).map(([k,m])=>[k,compile(m).evaluate]));
let maxAbsError=0,comparisons=0;
const near=(a,b)=>{maxAbsError=Math.max(maxAbsError,Math.abs(a-b));comparisons++;assert.ok(Math.abs(a-b)<=1e-10,`${a} != ${b}`);};
const roots=positions();

test('actual Wasm B/L/P identities, static features and independent legal children match native and JS',async()=>{
 const e=await create(),native=new NativeEngine();try {
  await native.ready();assert.deepEqual(manifest.models,native.receipt.models);
  const rng=seededRandom(0x5741534d);
  const boards=[...roots,...Array.from({length:64},()=>({board:Array.from({length:64},()=>Math.floor(rng()*3)-1),player:1}))];
  for(const p of boards)for(const player of [1,-1])for(const model of ['B','L','P']) {
   const r=e.inspect(p.board,player,model),n=await native.inspect(p.board,player,model);
   assert.deepEqual(r.features,Object.values(extractFeatures(p.board,player)));near(r.evaluation,n.evaluation);near(r.evaluation,ev[model](p.board,player));
   assert.deepEqual(r.children,n.children);assert.deepEqual(r.children.map(c=>({move:c.move,board:decodeBoard(c)})),oracleChildren(p.board,player));
  }
 }finally{e.close();native.close();}
});

test('Wasm full root windows and every PV step agree with independent minimax at the declared horizon',async()=>{
 const e=await create(),native=new NativeEngine();try {
  for(const p of roots.filter((_,i)=>i%3===0))for(const model of ['B','L','P']) {
   const depth=3,a=e.analyze(p.board,p.player,depth,model);
   assert.deepEqual(a.results.map(r=>r.move).sort((a,b)=>a-b),legalMoves(p.board,p.player).sort((a,b)=>a-b));
   near(e.search(p.board,p.player,{model,depth}).score,(await native.search(p.board,p.player,{model,depth})).score);
   for(const row of a.results) {
    near(row.score,-oracleScore([...play(p.board,p.player,row.move)],-p.player,depth-1,ev[model]));
    let b=p.board,turn=p.player,remaining=depth;
    for(const [pvIndex,q] of row.pv.entries()) {
     if(q==='pass'){assert.equal(legalMoves(b,turn).length,0);assert.ok(legalMoves(b,-turn).length);turn=-turn;continue;}
     const move=parseCoord(q);assert.ok(remaining>0);assert.ok(legalMoves(b,turn).includes(move));
     const target=oracleScore([...b],turn,remaining,ev[model]);b=play(b,turn,move);turn=-turn;remaining--;
     if(pvIndex>0)near(-oracleScore([...b],turn,remaining,ev[model]),target);
    }
    assert.ok(remaining===0||(!legalMoves(b,turn).length&&!legalMoves(b,-turn).length));
   }
  }
 }finally{e.close();native.close();}
});

test('Wasm exact alternatives, forced passes, terminal empties and depths beyond fourteen',async()=>{
 const e=await create();try {
  const samples=[...roots.slice(-2),...Array.from({length:4},(_,i)=>randomOpening(seededRandom(0x57414c00+i),54))];
  for(const p of samples)for(const model of ['B','L','P']) {
   const target=oracleScore([...p.board],p.player);
   for(const depth of [15,16,64]){const r=e.search(p.board,p.player,{depth,model});assert.equal(r.score||0,target||0);assert.equal(r.exact,true);}
   for(const row of e.analyze(p.board,p.player,15,model).results){assert.equal(row.score||0,-oracleScore([...play(p.board,p.player,row.move)],-p.player)||0);assert.equal(row.exact,true);}
   near(e.windows(p.board,p.player,model,0,-1e9,1e9)[1],oracleScore([...p.board],p.player,0,ev[model]));
  }
 }finally{e.close();}
});

test('Wasm tiny TT collisions, full/narrow bounds, model/horizon changes and interrupted iterations',async()=>{
 for(const ttMiB of [0,1,16]) {
  const e=await create({ttMiB});try {
   const p=roots[5];
   for(const model of ['P','B','L'])for(const depth of [4,2,3]) {
    const expected=findBestMove(p.board,p.player,depth,undefined,{evaluate:ev[model]}).score;
    for(const [alpha,beta] of [[expected+1,expected+2],[expected-2,expected-1]]) {
     const [bound,full]=e.windows(p.board,p.player,model,depth,alpha,beta);near(full,expected);
     assert.ok(expected<=alpha?bound<=alpha&&bound>=expected-1e-10:bound>=beta&&bound<=expected+1e-10);
    }
    near(e.search(p.board,p.player,{model,depth,tt:false}).score,expected);
   }
   const one=e.search(p.board,p.player,{model:'P',depth:1});
   const r=e.search(p.board,p.player,{model:'P',timeMs:60000,nodeLimit:one.nodes+1});assert.equal(r.depth,1);near(r.score,one.score);assert.equal(r.timedOut,true);
   const fallback=e.search(p.board,p.player,{timeMs:.000001});assert.equal(fallback.depth,0);assert.equal(fallback.score,null);assert.equal(fallback.exact,false);
   const timed=e.search(p.board,p.player,{model:'P',timeMs:10});assert.ok(timed.elapsedMs<70);near(timed.score,e.search(p.board,p.player,{model:'P',depth:timed.depth}).score);
   assert.throws(()=>e.search(p.board,p.player,{depth:65}),/Invalid/);assert.throws(()=>e.search(p.board,0),/Invalid/);
  }finally{e.close();}
 }
});

test('Wasm lifetime, bounded linear memory and fail-closed ABI/model identity checks',async()=>{
 const e=await create(),b=initialBoard(),bytes=e.memoryBytes;
 const decode=e.module.UTF8ToString;
 e.module.UTF8ToString=()=>JSON.stringify({modelIdentity:manifest.models.B});
 assert.throws(()=>e.search(b,1,{model:'P'}),/response model identity mismatch/);
 e.module.UTF8ToString=decode;
 for(let i=0;i<80;i++){e.search(b,1,{depth:4,model:i%2?'P':'B'});e.analyze(b,1,3,'P');}
 assert.equal(e.memoryBytes,bytes);e.close();e.close();assert.throws(()=>e.inspect(b,1),/closed/);
 await assert.rejects(create({expected:{...manifest,abi:999}}),/version mismatch/);
 await assert.rejects(create({expected:{...manifest,models:{...manifest.models,P:'wrong'}}}),/identity mismatch/);
});

after(()=>{mkdirSync('.local-research/wasm-build',{recursive:true});writeFileSync('.local-research/wasm-build/qualification.json',JSON.stringify({fingerprint:manifest.fingerprint,tolerance:1e-10,maxAbsError,comparisons,staticQueries:600},null,2));});

test('actual Wasm long directional rays and edge masks match independent legal children',async()=>{
 const e=await create();try {
  const directions=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
  for(let q=0;q<64;q++)for(const [dr,dc] of directions)for(let n=1;n<=6;n++) {
   const row=q>>3,col=q&7,endR=row+(n+1)*dr,endC=col+(n+1)*dc;
   if(endR<0||endR>7||endC<0||endC>7)continue;
   const b=Array(64).fill(0);for(let k=1;k<=n;k++)b[(row+k*dr)*8+col+k*dc]=-1;b[endR*8+endC]=1;
   for(const p of [1,-1])assert.deepEqual(e.inspect(b,p,'P').children.map(c=>({move:c.move,board:decodeBoard(c)})),oracleChildren(b,p));
  }
 }finally{e.close();}
});

test('actual Wasm traverses independently solved 15/16-empty horizons and timed deepening exceeds fourteen',async()=>{
 // Read the preserved independent oracle evidence; do not regenerate or edit it.
 const reference=JSON.parse(readFileSync(new URL('../docs/data/native-v2-deep-qualification-20261030.json',import.meta.url)));
 const e=await create(),utility=v=>v?Math.sign(v)*10000+v:0;
 try {
  for(const p of reference.rows) {
   assert.ok(p.depth>14);
   for(const model of ['B','L','P']) {
    const r=e.search(p.board,p.player,{model,depth:p.depth});near(r.score,utility(p.independent.value));assert.equal(r.exact,true);
    for(const row of p.independent.rows) {
     const child=oracleChildren(p.board,p.player).find(c=>c.move===row.move);
     const r=e.search(child.board,-p.player,{model,depth:p.depth-1});near(-r.score,utility(row.value));assert.equal(r.exact,true);
    }
   }
   if(p.depth===15){const r=e.search(p.board,p.player,{model:'P',timeMs:3000});assert.ok(r.depth>14);assert.equal(r.exact,true);near(r.score,utility(p.independent.value));}
  }
 }finally{e.close();}
});
