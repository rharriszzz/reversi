import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {WasmEngine} from '../../src/wasm-engine.js';
import {NativeEngine,decodeBoard} from '../native/client.mjs';
import {seededRandom,randomOpening} from '../../src/learning.js';
import {parseCoord} from '../../src/rules.js';
import {oracleChildren,oracleScore} from '../../tests/oracle.mjs';
import {compile} from '../next-residual/model.mjs';
import {frozenModels} from '../frozen-player/models.mjs';
const out=resolve(process.env.REVERSI_FLIP_RUN??'.local-research/fast-flips-m4-20261031');
const expected=JSON.parse(readFileSync(resolve(out,'wasm-selected/manifest.json')));
const binary=readFileSync(resolve('src/wasm',expected.module.replace('.mjs','.wasm')));
const e=await WasmEngine.create({expected,moduleOptions:{wasmBinary:binary}}),native=new NativeEngine({receipt:JSON.parse(readFileSync(resolve(out,'selected/build.json')))});
const ev=Object.fromEntries(Object.entries(frozenModels()).map(([m,v])=>[m,compile(v).evaluate]));
const rng=seededRandom(0x464c5751),boards=[];
for(let q=0;q<64;q++)for(const empty of [1,2,3]) {
  const board=Array.from({length:64},()=>rng()<.5?1:-1);board[q]=0;
  for(let i=1;i<empty;i++){let k;do{k=Math.floor(rng()*64);}while(!board[k]);board[k]=0;}
  boards.push(board);
}
for(let i=0;i<12;i++)boards.push([...randomOpening(seededRandom(0x464c5752+i),54+i%6).board]);
const positions=JSON.parse(readFileSync(resolve(out,'positions.json')));
boards.push(...positions.filter(p=>['forced-pass','terminal-empties'].includes(p.id)).map(p=>p.board));
let staticQueries=0,searches=0,children=0,coachingRows=0,pvSteps=0;
try {
  await native.ready();
  for(const board of boards)for(const player of [1,-1])for(const model of ['B','L','P']) {
    const w=e.inspect(board,player,model),n=await native.inspect(board,player,model);
    assert.equal(w.evaluation,n.evaluation);assert.equal(w.evaluation,ev[model](board,player));staticQueries++;
    assert.deepEqual(w.children.map(c=>({move:c.move,board:decodeBoard(c)})),oracleChildren(board,player));children+=w.children.length;
    for(const depth of [1,2,64]) {
      const w=e.search(board,player,{model,depth,hints:false}),n=await native.search(board,player,{model,depth,hints:false});
      assert.equal(w.score||0,oracleScore(board,player,depth,ev[model])||0);
      for(const key of ['score','move','depth','exact','nodes','evaluations','ttProbes','ttHits','ttBoundHits','ttCollisions','ttReplacements','cutoffs','ttCutoffs','ttStores','ttRejectedStores','firstMoveCutoffs'])assert.equal(w[key],n[key],key);
      searches++;
    }
  }
  for(const p of [...positions.slice(0,10),...positions.slice(34,36)])for(const model of ['B','L','P']) {
    const a=e.analyze(p.board,p.player,3,model);
    for(const row of a.results) {
      const child=oracleChildren(p.board,p.player).find(c=>c.move===row.move);assert.ok(child);
      assert.equal(row.score||0,-oracleScore(child.board,-p.player,2,ev[model])||0);coachingRows++;
      let board=p.board,player=p.player,depth=3,first=true;
      for(const q of row.pv) {
        if(q==='pass'){assert.equal(oracleChildren(board,player).length,0);assert.ok(oracleChildren(board,-player).length);player=-player;continue;}
        const next=oracleChildren(board,player).find(c=>c.move===parseCoord(q));assert.ok(next);
        if(!first)assert.equal(oracleScore(board,player,depth,ev[model])||0,-oracleScore(next.board,-player,depth-1,ev[model])||0);
        first=false;board=next.board;player=-player;depth--;pvSteps++;
      }
    }
  }
  for(const budget of [80,300])for(const model of ['B','L','P']) {
    const p=positions[5],w=e.search(p.board,p.player,{model,timeMs:budget,hints:false});
    assert.ok(w.depth>0);assert.equal(w.score,e.search(p.board,p.player,{model,depth:w.depth,hints:false}).score);
  }
  const result={passed:true,fingerprint:expected.fingerprint,sourceCommit:expected.sourceCommit,boards:boards.length,staticQueries,searches,children,coachingRows,pvSteps,maxAbsError:0,method:'Actual compiled experimental Wasm against native plus independent mailbox and minimax; both players, B/L/P, tiny ends/passes/terminal/truncated horizons; native/Wasm counters identical at fixed work.'};
  writeFileSync(resolve(out,'wasm-qualification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{e.close();native.close();}
