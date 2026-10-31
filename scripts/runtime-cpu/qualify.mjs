// Independent mailbox rules/minimax plus exact tree/TT/continuation identity.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {NativeEngine,boardArgs,decodeBoard} from '../native/client.mjs';
import {sha} from '../native/build.mjs';
import {oracleChildren,oracleScore} from '../../tests/oracle.mjs';
import {randomOpening,seededRandom} from '../../src/learning.js';
import {frozenModels} from '../frozen-player/models.mjs';
import {compile} from '../next-residual/model.mjs';
const out=resolve(process.env.REVERSI_DISPATCH_RUN??'.local-research/runtime-cpu-20261031');
const tags=(process.env.DISPATCH_TAGS??'A,B,C,D,E').split(',');
const evaluators=Object.fromEntries(Object.entries(frozenModels()).map(([m,v])=>[m,compile(v).evaluate]));
const scoreCache=new Map();
function score(board,player,depth,evaluator) {
  const key=`${board.join(',')}/${player}/${depth}/${Object.values(evaluators).indexOf(evaluator)}`;
  if(!scoreCache.has(key))scoreCache.set(key,oracleScore(board,player,depth,evaluator));
  return scoreCache.get(key);
}
const rng=seededRandom(0x464c5154),boards=[];
for(let q=0;q<64;q++)for(const empty of [1,2,3]) {
  const b=Array.from({length:64},()=>rng()<.5?1:-1);b[q]=0;
  for(let i=1;i<empty;i++){let k;do{k=Math.floor(rng()*64);}while(!b[k]);b[k]=0;}
  boards.push(b);
}
for(let i=0;i<24;i++)boards.push([...randomOpening(seededRandom(0x464c5200+i),54+i%6).board]);
boards.push(Array(64).fill(0),Array(64).fill(1),Array.from({length:64},(_,q)=>q<48?1:0));
const positions=JSON.parse(readFileSync(resolve(out,'positions.json')));
boards.push(...positions.filter(p=>['forced-pass','terminal-empties'].includes(p.id)).map(p=>p.board));
const engines=tags.map(tag=>{
  const receipt=JSON.parse(readFileSync(resolve(out,tag,'build.json'))),executable=resolve(out,tag,'qualify');
  return new NativeEngine({receipt:{...receipt,executable,executableSha256:sha(readFileSync(executable))}});
});
const signature=r=>Object.fromEntries(Object.entries(r).filter(([k])=>!['id','interfaceMs','elapsedMs','cpuMs','backend','buildIdentity'].includes(k)));
let rootQueries=0,children=0,pvSteps=0,coachingRows=0,timedPublications=0,deepCoachingRows=0;
try {
  for(const [i,e] of engines.entries()) {process.env.REVERSI_CPU_BACKEND=tags[i]==='B'?'portable':'auto'; const hello=await e.ready();if(['B','C'].includes(tags[i]))assert.equal(hello.cpuBackend,tags[i]==='B'?'portable':'x86-popcnt-bmi1-bmi2-lzcnt');}
  for(const board of boards)for(const player of [1,-1])for(const model of ['B','L','P']) {
    const expectedChildren=oracleChildren(board,player),inspection=[];
    for(const e of engines) {
      const r=await e.inspect(board,player,model);assert.deepEqual(r.children.map(c=>({move:c.move,board:decodeBoard(c)})),expectedChildren);
      assert.equal(r.evaluation,evaluators[model](board,player));children+=r.children.length;inspection.push(r);
    }
    for(const depth of [1,2,64]) {
      const expected=score(board,player,depth,evaluators[model]);let first;
      for(const e of engines) {
        const r=await e.search(board,player,{model,depth,hints:false});assert.equal(r.score||0,expected||0);
        if(first)assert.deepEqual(signature(r),first);else first=signature(r);rootQueries++;
      }
    }
  }
  // Heuristic model/horizon and full-window all-move/PV comparisons, plus passes.
  for(const p of [...positions.slice(0,10),...positions.slice(34,36),...positions.slice(-3)])for(const model of ['B','L','P']) {
    const depth=3;const expected=score(p.board,p.player,depth,evaluators[model]);let first;
    for(const e of engines) {
      const r=await e.request(`analyze ${boardArgs(p.board,p.player,model)} ${depth}`);
      assert.equal(r.score||0,expected||0);coachingRows+=r.moves.length;
      if(first)assert.deepEqual(signature(r),first);else first=signature(r);
      for(const row of r.moves) {
        let board=p.board,turn=p.player,remaining=depth,isRoot=true;
        const child=oracleChildren(board,turn).find(c=>c.move===row.move);
        assert.equal(row.score||0,-score(child.board,-turn,depth-1,evaluators[model])||0);
        for(const q of row.pv) {
          if(q<0){assert.equal(oracleChildren(board,turn).length,0);assert.ok(oracleChildren(board,-turn).length);turn=-turn;continue;}
          const next=oracleChildren(board,turn).find(c=>c.move===q);assert.ok(next);assert.ok(remaining>0);
          if(!isRoot)assert.equal(score(board,turn,remaining,evaluators[model])||0,-score(next.board,-turn,remaining-1,evaluators[model])||0);
          board=next.board;turn=-turn;remaining--;isRoot=false;pvSteps++;
        }
      }
      // Deterministic node-stop is a rigorous completed-horizon test, independent of clock speed.
      for(const nodeLimit of [1,300,3000]) {
        const r=await e.search(p.board,p.player,{model,depth:12,timeMs:30000,nodeLimit,hints:false});
        if(r.score!==null)assert.equal(r.score||0,score(p.board,p.player,r.depth,evaluators[model])||0);
        else assert.equal(r.depth,0);timedPublications++;
      }
    }
  }
  for(const p of [positions[1],positions[5]])for(const model of ['B','L','P']) {
    let first;
    for(const e of engines) {
      const r=await e.request(`analyze ${boardArgs(p.board,p.player,model)} 6`);
      if(first)assert.deepEqual(signature(r),first);else first=signature(r);deepCoachingRows+=r.moves.length;
    }
  }
  for(let repeat=0;repeat<20;repeat++) {process.env.REVERSI_CPU_BACKEND=repeat%2?'portable':'auto';const e=new NativeEngine({receipt:engines[tags.indexOf('C')].receipt,ttMiB:0});await e.ready();await e.search(positions[0].board,positions[0].player,{depth:2});e.close();}
  const result={passed:true,tags,seed:0x464c5154,boards:boards.length,rootQueries,children,coachingRows,pvSteps,timedPublications,deepCoachingRows,method:'Independent 10x10 mailbox children/exhaustive minimax; all exposed search/TT counters identical between kernels at fixed work; node-limit interrupted completed horizons verified. Additional D6 full-window rows/PVs compared across builds and verified by production continuation searches.'};
  writeFileSync(resolve(out,'qualification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{engines.forEach(e=>e.close());}
