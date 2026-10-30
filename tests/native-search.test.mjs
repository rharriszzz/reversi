import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../scripts/native/build.mjs';
import { NativeEngine, decodeBoard } from '../scripts/native/client.mjs';
import { frozenModels } from '../scripts/frozen-player/models.mjs';
import { compile } from '../scripts/next-residual/model.mjs';
import { initialBoard, legalMoves, play, isTerminal, flipsFor } from '../src/rules.js';
import { extractFeatures } from '../src/features.js';
import { randomOpening, seededRandom } from '../src/learning.js';
import { findBestMove, terminalScore } from '../src/search.js';
import { oracleChildren, oracleScore } from './oracle.mjs';
import { MAPS } from '../scripts/research/core.mjs';
const receipt=build(process.env.NATIVE_SANITIZE?{sanitize:true,directory:'.local-research/native-sanitize'}:{}),models=frozenModels(),evaluators=Object.fromEntries(Object.entries(models).map(([k,v])=>[k,compile(v).evaluate]));
const near=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const fixtures=[{board:initialBoard(),player:1},
 {board:Int8Array.from(('.WBBBBBB'+'BBBBBBBB'.repeat(6)+'BBBBBBB.').split('').map(v=>v==='B'?1:v==='W'?-1:0)),player:-1},
 {board:Int8Array.from({length:64},(_,i)=>i===0?1:0),player:1},
 {board:new Int8Array(64),player:-1},
 {board:Int8Array.from({length:64},(_,i)=>i<32?1:-1),player:1}];
const positions=Array.from({length:96},(_,i)=>randomOpening(seededRandom(0x4e415400+i),[0,8,16,23,24,25,36,47,48,49,54,58][i%12])).filter(p=>p.player);

test('native frozen B/L/P identities, features, rules and every flip agree with independent and JS paths',async()=>{
 const engine=new NativeEngine({receipt});try {
  assert.deepEqual((await engine.ready()).models,Object.values(receipt.models));
  assert.equal(receipt.models.L,models.L.checksum);assert.equal(receipt.models.P,models.P.checksum);
  let checked=0;
  for(const p of [...fixtures,...positions])for(const model of ['B','L','P']) {
   const row=await engine.inspect(p.board,p.player,model),expected=oracleChildren([...p.board],p.player);
   assert.deepEqual(row.children.map(c=>c.move),legalMoves(p.board,p.player));
   assert.deepEqual(row.children.map(c=>({move:c.move,board:decodeBoard(c)})),expected);
   for(const c of row.children) {assert.deepEqual(decodeBoard(c),[...play(p.board,p.player,c.move)]);const next=decodeBoard(c);const changed=next.map((v,q)=>v!==p.board[q]&&q!==c.move?q:-1).filter(q=>q>=0);assert.deepEqual(changed,flipsFor(p.board,p.player,c.move).sort((a,b)=>a-b));}
   assert.deepEqual(row.features,Object.values(extractFeatures(p.board,p.player)));
   near(row.evaluation,evaluators[model](p.board,p.player));
   assert.equal(row.terminal,isTerminal(p.board));assert.equal(row.terminalScore,terminalScore(p.board,p.player));
   assert.equal(row.margin,p.board.reduce((n,v)=>n+v*p.player,0));checked++;
  }
  assert.ok(checked>270);
  // Perft counts, including resulting boards, are independently anchored.
  async function perft(board,player,depth) {if(!depth)return 1;const r=await engine.inspect(board,player,'B');if(!r.children.length)return r.terminal?1:perft(board,-player,depth);let n=0;for(const c of r.children)n+=await perft(decodeBoard(c),-player,depth-1);return n;}
  assert.equal(await perft(initialBoard(),1,4),244);assert.equal(await perft(initialBoard(),1,5),1396);
 }finally{engine.close();}
});

test('native full-window minimax and legal optimal choices match B/L/P reference across all phases',async()=>{
 const engine=new NativeEngine({receipt});try {
  for(const p of [...fixtures,...positions.filter((_,i)=>i%3===0)])for(const model of ['B','L','P']) {
   const depth=3,expected=findBestMove(p.board,p.player,depth,undefined,{evaluate:evaluators[model]});
   for(const options of [{},{tt:false},{hints:false}]) {
    const r=await engine.search(p.board,p.player,{model,depth,...options});near(r.score,expected.score);assert.equal(r.depth,depth);assert.equal(r.exact,expected.exact);
    if(r.move!==null)near(-oracleScore([...play(p.board,p.player,r.move)],-p.player,depth-1,evaluators[model]),expected.score);
    else assert.equal(legalMoves(p.board,p.player).length,0);
   }
  }
  // Deeper branching production comparisons, not only horizon-one tests.
  for(const p of positions.filter((_,i)=>i%12===4).slice(0,4))for(const model of ['B','L','P']) {
   const expected=findBestMove(p.board,p.player,5,undefined,{evaluate:evaluators[model]});
   const r=await engine.search(p.board,p.player,{model,depth:5});near(r.score,expected.score);
  }
 }finally{engine.close();}
});

test('native TT lower/upper/exact bounds, one-slot collisions, model and horizon changes preserve values',async()=>{
 for(const ttMiB of [0,1,16]) {
  const engine=new NativeEngine({receipt,ttMiB});try {
   for(const p of positions.filter((_,i)=>i%12===3).slice(0,5))for(const model of ['P','B','L']) {
    const score=findBestMove(p.board,p.player,4,undefined,{evaluate:evaluators[model]}).score;
    const ranges=[[score+1,score+2],[-1e9,1e9],[score-2,score-1],[-1e9,1e9],[score-.0001,score+.0001],[-1e9,1e9]];
    const r=await engine.windows(p.board,p.player,model,4,ranges);
    for(let i=0;i<ranges.length;i++){const [a,b]=ranges[i],v=r.values[i];if(score<=a)assert.ok(v<=a+1e-10&&v>=score-1e-10);else if(score>=b)assert.ok(v>=b-1e-10&&v<=score+1e-10);else near(v,score);}
    for(const depth of [2,4,3])near((await engine.search(p.board,p.player,{model,depth})).score,findBestMove(p.board,p.player,depth,undefined,{evaluate:evaluators[model]}).score);
   }
   if(ttMiB===0){const r=await engine.search(positions[4].board,positions[4].player,{depth:5});assert.ok(r.ttCollisions>100);assert.equal(r.tableBytes,40);}
  }finally{engine.close();}
 }
});

test('native passes do not consume depth; independently solved endgames, terminal empties and utility',async()=>{
 const engine=new NativeEngine({receipt});try {
  for(const p of [...fixtures.slice(1),...positions.filter((_,i)=>i%12===11).slice(0,7),...Array.from({length:4},(_,i)=>randomOpening(seededRandom(0x4e4154aa+i),52))]) {
   const expected=oracleScore([...p.board],p.player);
   for(const model of ['B','L','P']) {const r=await engine.search(p.board,p.player,{model,depth:8});assert.equal(r.score,expected);assert.equal(r.exact,true);}
  }
  const p=fixtures[1],r=await engine.search(p.board,p.player,{depth:1});assert.equal(r.move,null);assert.equal(r.score,oracleScore([...p.board],p.player));assert.equal(r.exact,true);
 }finally{engine.close();}
});

test('native D4, perspective and simultaneous color/turn transforms retain evaluator and minimax',async()=>{
 const engine=new NativeEngine({receipt});try {
  for(const p of positions.filter((_,i)=>i%12===4).slice(0,3))for(const model of ['B','L','P']) {
   const original=await engine.search(p.board,p.player,{model,depth:3});const staticValue=evaluators[model](p.board,p.player);
   for(const map of MAPS) {
    const board=map.map(i=>p.board[i]);near((await engine.inspect(board,p.player,model)).evaluation,staticValue);
    near((await engine.inspect(board,-p.player,model)).evaluation,-staticValue);
    near((await engine.search(board,p.player,{model,depth:3})).score,original.score);
    near((await engine.search(board.map(v=>-v),-p.player,{model,depth:3})).score,original.score);
   }
  }
 }finally{engine.close();}
});

test('native iterative deepening publishes only completed iterations and supports cancellation/recovery/errors',async()=>{
 const engine=new NativeEngine({receipt});try {
  const p=positions[4];
  const one=await engine.search(p.board,p.player,{model:'P',depth:1});
  const interrupted=await engine.search(p.board,p.player,{model:'P',depth:14,timeMs:60000,nodeLimit:one.nodes+1});
  assert.equal(interrupted.depth,1);near(interrupted.score,one.score);assert.equal(interrupted.move,one.move);assert.equal(interrupted.timedOut,true);
  const fallback=await engine.search(p.board,p.player,{model:'P',depth:14,timeMs:.000001});
  assert.equal(fallback.depth,0);assert.equal(fallback.score,null);assert.equal(fallback.exact,false);assert.ok(legalMoves(p.board,p.player).includes(fallback.move));
  for(const timeMs of [1,10,40]) {const r=await engine.search(p.board,p.player,{model:'P',timeMs});assert.ok(r.elapsedMs<timeMs+50);assert.ok(r.depth>0);near(r.score,(await engine.search(p.board,p.player,{model:'P',depth:r.depth})).score);}
  const abort=new AbortController(),search=engine.search(p.board,p.player,{timeMs:10000,signal:abort.signal});setTimeout(()=>abort.abort(Error('test cancel')),10);await assert.rejects(search,/test cancel/);
  assert.equal((await engine.ready()).protocol,1);await assert.rejects(engine.request('search invalid'),/Expected/);await engine.ready();
  await assert.rejects(engine.search(p.board,p.player,{timeMs:NaN}),/Invalid/);await assert.rejects(engine.request('search 1 1 1 2 3 0 1 1 0 0'),/Invalid/);
 }finally{engine.close();}
});

test('native playing pipeline resumes checkpoints, independently replays games and rejects corruption',async()=>{
 const {playGame,replay}=await import('../scripts/native/game.mjs');
 const engine=new NativeEngine({receipt});try {
  const opening={id:'engineering-test',board:[...positions.at(-1).board],player:positions.at(-1).player};
  let saved=null;
  await assert.rejects(playGame(engine,opening,{timeMs:1,checkpoint:s=>{saved=s;throw Error('checkpoint stop');}}),/checkpoint stop/);
  const result=await playGame(engine,opening,{timeMs:1,resume:saved});assert.deepEqual(replay(opening,result.moves,{complete:true}).board,result.board);
  assert.ok(result.moves.some(m=>m.backend==='native'));assert.ok(result.moves.some(m=>m.backend==='javascript'));
  assert.equal(result.margin,result.board.reduce((n,v)=>n+v,0));
  await assert.rejects(playGame(engine,opening,{timeMs:1,resume:{...saved,player:-saved.player}}));
 }finally{engine.close();}
});

test('native fixed engineering schedule and paired inference preserve both colors and matched subset',async()=>{
 const {schedule,PROTOCOL}=await import('../scripts/native/protocol.mjs');
 const {analyze}=await import('../scripts/native/statistics.mjs');
 const rows=schedule();assert.equal(rows.length,768);
 for(const ms of [80,300]){const xs=rows.filter(r=>r.timeMs===ms);assert.equal(new Set(xs.map(r=>r.family)).size,ms===80?256:128);for(const f of new Set(xs.map(r=>r.family)))assert.deepEqual(xs.filter(r=>r.family===f).map(r=>r.nativeColor).sort(),[-1,1]);}
 const games=rows.map(r=>({...r,points:r.family%3===0?.5:r.family%2,margin:r.family%3===0?0:r.family%2?8:-8,outcome:r.family%3===0?0:r.family%2?1:-1,moves:[]}));
 const result=analyze(games);assert.equal(result.matched.mean,0);assert.equal(result.conditions[80].n,256);assert.equal(result.conditions[300].n,128);assert.ok(result.conditions[80].bootstrap.score.distinct>1);
 assert.throws(()=>analyze(games.slice(1)),/Complete/);
});

// Keep native compilation in one test process even on a fresh checkout.
await import('./native-model-cells.mjs');


test('persistent-client deadline ignores a stale performance.timeOrigin after realtime clock adjustment',async()=>{
 const engine=new NativeEngine();const own=Object.getOwnPropertyDescriptor(performance,'timeOrigin');
 try {
  await engine.ready();const origin=performance.timeOrigin;
  Object.defineProperty(performance,'timeOrigin',{value:origin-1000,configurable:true});
  const p=positions[4];const r=await engine.search(p.board,p.player,{timeMs:30});
  assert.ok(r.depth>0);assert.equal(r.timedOut,true);
  assert.ok(r.elapsedMs>=25&&r.elapsedMs<60,`Unexpected corrected duration ${r.elapsedMs}`);
 }finally{if(own)Object.defineProperty(performance,'timeOrigin',own);else delete performance.timeOrigin;engine.close();}
});


test('positive Student survival quadrature retains tiny probabilities and analytic references',async()=>{
 const {studentTail}=await import('../scripts/native/statistics.mjs');
 near(studentTail(1,2),.5*(1-1/Math.sqrt(3)),1e-12);near(studentTail(1,1),.25,1e-14);near(studentTail(0,127),.5);
 const a=studentTail(15,255,16384),b=studentTail(15,255,32768);
 assert.ok(a>0&&b>0&&b<1e-30);assert.ok(Math.abs(a-b)/b<1e-8);near(studentTail(-1,2),1-studentTail(1,2),1e-12);
});
