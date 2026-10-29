import test from 'node:test';
import assert from 'node:assert/strict';
import { initialBoard,legalMoves,play,counts } from '../src/rules.js';
import { evaluateFast } from '../src/fast-features.js';
import { findBestMove,terminalScore } from '../src/search.js';
import { seededRandom } from '../src/learning.js';
import { MAPS } from '../scripts/research/core.mjs';
import { oracleChildren,oracleScore } from './oracle.mjs';
import { zero,makeModel,verifyModel,fit as linearFit,objective as linearObjective,normalizePairs } from '../scripts/next-residual/linear.mjs';
import { PROTOCOL,slots,transferIds,hash } from '../scripts/next-residual/protocol.mjs';
import { makePattern,verifyPattern,compile,DIMENSION,patternSparse,patternEncoding,sparseScore,objective,csr,encodePairs } from '../scripts/next-residual/model.mjs';
import { fit,projectedGradient } from '../scripts/next-residual/optimize.mjs';
import { fullWindow,collectFrontier,staticAtCutoff } from '../scripts/next-residual/frontier.mjs';
function trajectory(seed=9302811){const rng=seededRandom(seed),states=[];let board=[...initialBoard()],player=1,passes=0;
  while(passes<2){states.push({board,player});const children=oracleChildren(board,player);if(!children.length){passes++;player=-player;continue;}passes=0;board=children[Math.floor(rng()*children.length)].board;player=-player;}return states;}
const close=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('new relaxed model keeps exactly B phases, features and frozen bounds; zero paths preserve search work',()=>{
  const B=makeModel(zero()),L=makeModel(zero().map((_,i)=>(i-10)*5)),P0=makePattern(L,new Float64Array(DIMENSION));
  verifyModel(JSON.parse(JSON.stringify(L)));verifyPattern(JSON.parse(JSON.stringify(P0)));
  assert.equal(DIMENSION,10932);assert.equal(compile(P0).bytes-168,87480);
  for(const s of trajectory().filter((_,i)=>i%7===0)) {
    for(const [reference,candidate] of [[evaluateFast,compile(B).evaluate],[compile(L).evaluate,compile(P0).evaluate]]) {
      assert.equal(reference(s.board,s.player),candidate(s.board,s.player));
      const a=findBestMove(s.board,s.player,3,undefined,{evaluate:reference}),b=findBestMove(s.board,s.player,3,undefined,{evaluate:candidate});
      for(const key of ['score','move','nodes','evaluations','exact'])assert.equal(a[key],b[key]);
    }
  }
  assert.throws(()=>makeModel(Array(21).fill(100.01)));
  const changed=structuredClone(P0);changed.linear.correction[0]++;assert.throws(()=>verifyPattern(changed),/identity/i);
});
test('pattern sparse/Float32 compiled parity, exact boundaries, D4 and both color transforms',()=>{
  const L=makeModel(zero().map((_,i)=>(i-10)*3)),co=Float64Array.from({length:DIMENSION},(_,i)=>Math.sin(i)*24),P=makePattern(L,co),evaluate=compile(P).evaluate;
  const states=trajectory();for(const s of states.filter((s,i)=>i%5===0||[27,28,51,52].includes(64-counts(s.board).empty))) {
    if(!legalMoves(s.board,1).length&&!legalMoves(s.board,-1).length)continue;
    close(evaluate(s.board,s.player),sparseScore(s.board,s.player,L,co),3e-6);
    close(evaluate(s.board,-s.player),-evaluate(s.board,s.player));
    close(evaluate(s.board.map(v=>-v),-s.player),evaluate(s.board,s.player));
    for(const map of MAPS)close(evaluate(map.map(i=>s.board[i]),s.player),evaluate(s.board,s.player));
    const offset=(64-counts(s.board).empty)<28?0:(64-counts(s.board).empty)<52?1:2;
    for(const [i] of patternSparse(s.board,s.player))assert.equal(i<1092?Math.floor(i/364):Math.floor((i-1092)/3280),offset);
  }
  const terminal=[0,...Array(63).fill(1)];assert.deepEqual(patternEncoding(terminal,1),[]);
  assert.equal(staticAtCutoff(terminal,1,undefined,evaluate),10063);
  assert.equal(findBestMove(terminal,-1,6,undefined,{evaluate}).score,-10063);
});
test('changed evaluator full-window scores and verified frontier continuations agree with independent minimax, including passes',()=>{
  const L=makeModel(zero().map((_,i)=>(i-10)*5)),P=makePattern(L,Float64Array.from({length:DIMENSION},(_,i)=>i%11-5)),evaluate=compile(P).evaluate;
  for(const occupied of [16,28,43,59]) {
    const s=trajectory().find(s=>64-counts(s.board).empty===occupied),r=collectFrontier({...s,id:`s${occupied}`,depth:3},{evaluate});
    const oracle=oracleChildren(s.board,s.player).map(c=>({move:c.move,score:-oracleScore(c.board,-s.player,2,evaluate)})).sort((a,b)=>b.score-a.score||a.move-b.move);
    assert.deepEqual(r.rootScores,oracle);
    const production=findBestMove(s.board,s.player,3,undefined,{evaluate});close(production.score,fullWindow(s,3,undefined,()=>{},evaluate).score);
    for(const line of r.lines)assert.ok(line.terminal||line.rootLeafObserved);
  }
  const pass=Array.from({length:12},(_,i)=>trajectory(9302811+i)).flat().find(s=>!legalMoves(s.board,s.player).length&&legalMoves(s.board,-s.player).length);assert.ok(pass);
  for(const d of [0,1,3])close(fullWindow(pass,d,undefined,()=>{},evaluate).score,oracleScore(pass.board,pass.player,d,evaluate));
});
test('sparse analytical gradients are independently finite-differenced, including original coefficient penalty units',()=>{
  const groups=[{id:'one',pairs:[{base:-8,rawWeight:1,sparse:[[0,1],[2,-.25],[DIMENSION-1,.5]]}]},{id:'two',pairs:[{base:3,rawWeight:.5,sparse:[[1,.25],[2,1]]},{base:-2,rawWeight:1,sparse:[[0,-.5],[2,.5]]}]}],data=csr(groups),x=new Float64Array(DIMENSION);x[0]=2;x[1]=-4;x[2]=3;
  for(const lambda of PROTOCOL.patternLambdas){const result=objective(x,data,lambda);for(const j of [0,1,2,24,DIMENSION-1]) {
    const a=x.slice(),b=x.slice(),eps=1e-5;a[j]+=eps;b[j]-=eps;
    close((objective(a,data,lambda).loss-objective(b,data,lambda).loss)/(2*eps),result.gradient[j],1e-9);
  }}
  const pairs=normalizePairs([{id:'linear',pairs:[{base:-4,rawWeight:1,x:zero().map((_,i)=>i/21)}]}]),delta=zero().map((_,i)=>i-10),g=linearObjective(delta,pairs).gradient;
  for(let j=0;j<21;j++){const a=[...delta],b=[...delta];a[j]+=1e-5;b[j]-=1e-5;close((linearObjective(a,pairs).loss-linearObjective(b,pairs).loss)/2e-5,g[j],1e-9);}
});
test('all fits converge in original units, unobserved coordinates stay zero, checkpoints retain corpus/config identity',()=>{
  const data=csr([{id:'s',pairs:[{base:-5,rawWeight:1,sparse:[[0,1],[1,-.5]]},{base:8,rawWeight:1,sparse:[[1,1]]}]}]);
  for(const lambda of PROTOCOL.patternLambdas){let saved;
    const result=fit(data,lambda,{checkpoint:s=>saved=structuredClone(s)});assert.ok(result.converged);assert.ok(result.projectedGradient<1e-8);
    assert.equal(result.coefficients[2],0);assert.ok(result.coefficients.every(v=>Math.abs(v)<=25));
    assert.deepEqual(fit(data,lambda,{state:saved}).coefficients,result.coefficients);
    assert.throws(()=>fit({...data,identity:'different'},lambda,{state:saved}),/identity/);
    assert.throws(()=>fit(data,lambda,{state:{...saved,coefficients:result.coefficients.map((v,i)=>i===0?v+1:v)}}));
  }
  const linear=linearFit(normalizePairs([{id:'s',pairs:[{x:[1,...zero().slice(1)],base:-1e4,rawWeight:1}]}]),0);
  assert.equal(linear.delta[0],100);assert.ok(linear.converged);
});
test('expanded/fallback reservations retain complete cell balance, deterministic transfer subset and disjoint fixed opening roles',()=>{
  for(const design of Object.values(PROTOCOL.designs)) {
    const roots=slots('assessment',design.sources).map(s=>({...s,id:`assessment-${s.slot}`})),ids=transferIds(roots,design.transfer);
    assert.equal(new Set(ids).size,design.transfer);
    for(let cell=0;cell<16;cell++){const rows=roots.filter(r=>r.slot%16===cell);assert.equal(rows.length,design.sources/16);
      assert.equal(rows.filter(r=>r.player===1).length,rows.length/2);}
    assert.equal(slots('games',design.primaryPairs+design.shadowPairs).length,design.primaryPairs+design.shadowPairs);
  }
});
import { forecast } from '../scripts/next-residual/forecast.mjs';
import { positionalGate,jointBootstrap } from '../scripts/next-residual/statistics.mjs';
import { game,pairBootstrap } from '../scripts/next-residual/games.mjs';
import { Pool } from '../scripts/next-residual/pool.mjs';
import { mkdtempSync,rmSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
test('new worker receipts survive real process death and retain frozen linear/pattern identities',()=>{
  const dir=mkdtempSync(join(tmpdir(),'next-residual-recovery-'));try {
    const module=new URL('../scripts/next-residual/pool.mjs',import.meta.url).href,L=makeModel(Array(21).fill(75)),P=makePattern(L,new Float64Array(DIMENSION));
    const job={type:'root-search',state:{board:[...initialBoard()],player:1},depth:4,model:P};
    const code=`import {Pool} from ${JSON.stringify(module)};const [dir,mode]=process.argv.slice(1);const p=new Pool(1,dir,'frozen');await p.task('first',${JSON.stringify(job)});if(mode==='crash')process.kill(process.pid,'SIGKILL');await p.close();`;
    assert.equal(spawnSync(process.execPath,['--input-type=module','-e',code,dir,'crash']).signal,'SIGKILL');
    const before=readFileSync(join(dir,'tasks/first.json'),'utf8');
    assert.equal(spawnSync(process.execPath,['--input-type=module','-e',code,dir,'resume']).status,0);
    assert.equal(readFileSync(join(dir,'tasks/first.json'),'utf8'),before);
    assert.notEqual(spawnSync(process.execPath,['--input-type=module','-e',code.replace("'frozen'","'different'"),dir,'resume']).status,0);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('pattern support counts distinct sources once, with deterministic encoding across optimizer passes',()=>{
  const s=trajectory().find(s=>64-counts(s.board).empty===28),f=collectFrontier({...s,id:'one',depth:2});
  const p=f.parents[0],pairs=[{parent:0,preferred:p.children[0].move,other:p.children[1].move,base:p.children[0].base-p.children[1].base,x:zero(),rawWeight:1}];
  const groups=[{id:'one',pairs:[...pairs,...pairs]},{id:'two',pairs}],L=makeModel(zero()),a=encodePairs(groups,()=>f,L),b=encodePairs(groups,()=>f,L);
  assert.deepEqual(a.support,b.support);assert.ok(a.support.some(n=>n===2));assert.ok(a.support.every(n=>n===0||n===2));
  const data=csr(a.groups);fit(data,1e-6);assert.deepEqual(a.support,b.support);
});
test('expanded gates retain two simultaneous selector claims, exact source denominators, and separate P root gate',()=>{
  const design=PROTOCOL.designs.expanded,panels=Object.fromEntries(['B','L'].map(k=>[k,{sources:256,loss:{B:1,L:.8,P:.7},intervals:{'L-B':{lower975:.1},'P-L':{lower975:.02}}}]));
  const rows=Array.from({length:128},(_,i)=>[4,6].map(searchDepth=>({source:`s${i}`,searchDepth,regret:{B:3,L:2,P:1}}))).flat();
  assert.ok(positionalGate(panels,rows,design).pass);assert.ok(positionalGate(panels,rows,design,'P','L').pass);
  panels.L.intervals['L-B'].lower975=0;assert.equal(positionalGate(panels,rows,design).pass,false);panels.L.intervals['L-B'].lower975=.1;
  assert.equal(positionalGate(panels,rows.slice(1),design).complete,false);assert.equal(positionalGate(panels,rows,design,'L','B',false).pass,false);
  rows[1].regret.P=1000;assert.equal(positionalGate(panels,rows,design,'P','L').root,false);
  const bootstrap=jointBootstrap(Array.from({length:32},(_,i)=>({phase:i%4,policy:'B1-12%',depth:4,a:i/100,b:-i/100})),['a','b'],{reps:1000});
  close(bootstrap.a.lower975,-bootstrap.b.interval95[1]);
});
test('forecast counts all primary/shadow games, caps throughput at actual pool, preserves allowance and reserves',()=>{
  const cells=Object.fromEntries(slots('engineering',16).map(s=>[`${s.phase}/${s.policy}/${s.depth}`,{generation:100,frontier:100,labels:100,rootLabels:100,root4:100,root6:100}]));
  const pilot={roots:slots('engineering',16).map(s=>({...s,generationMs:100,frontierMs:100,labelMs:100,rootLabelMs:100,searches:[{wallMs:100}]})),gameCosts:[{timeMs:80,wallMs:7000},{timeMs:300,wallMs:25000}]};
  const old={cellMaxima:cells,admissionAttemptFactor:3,pair80MaxMs:7000,pair300MaxMs:25000},design=PROTOCOL.designs.expanded;
  const one=forecast(design,pilot,old,10000,1,1.9),two=forecast(design,pilot,old,10000,2,1.8);
  assert.equal(one.measuredSpeedup,1);assert.equal(two.measuredSpeedup,1.8);assert.ok(one.totalMs>two.totalMs);
  assert.equal(one.serial.games80,256*104*80);assert.equal(one.serial.games300,256*104*300);assert.equal(one.serial.shadow,128*104*80);
  assert.equal(one.totalMs,one.rawMs*1.35+20*60000);
  assert.equal(forecast(design,pilot,old,10000,1,1,{elapsedMs:7*3600000}).feasible,false);
});
test('nested timed game resumes without replaying completed searches; paired intervals keep opening units',async()=>{
  const opening={...trajectory().find(s=>counts(s.board).empty===5),id:'game'},L=makeModel(zero());let saved,paused=false;
  await assert.rejects(game(opening,L,'B',1,1,{check:()=>{if(paused)throw Error('pause');},checkpoint:s=>{saved=structuredClone(s);setImmediate(()=>paused=true);}}),/pause/);
  const prefix=structuredClone(saved.moves),result=await game(opening,L,'B',1,1,{resume:saved});assert.deepEqual(result.moves.slice(0,prefix.length),prefix);
  assert.equal(legalMoves(result.board,1).length+legalMoves(result.board,-1).length,0);
  await assert.rejects(game(opening,makeModel(Array(21).fill(1)),'B',1,1,{resume:saved}),/identity/);
  assert.equal(pairBootstrap(Array(256).fill(.5)).lower975,.5);assert.equal(pairBootstrap(Array(256).fill(1)).lower95,1);
});
import { analyzeSources } from '../scripts/next-residual/analyze.mjs';
test('complete analysis preserves source-level panel loss, terminal-aware scores and nested contrasts',()=>{
  const s=trajectory().find(s=>64-counts(s.board).empty===40),root={...s,id:'source',phase:2,policy:'B1-12%',depth:4},f=collectFrontier({...root,depth:2});
  const labels=f.parents.map(p=>Object.fromEntries([10,12].map(d=>[d,{rows:p.children.map((c,i)=>({move:c.move,value:2*i}))}])));
  const L=makeModel(zero()),P=makePattern(L,new Float64Array(DIMENSION));
  const records=[{root,panels:{B:f,L:f},labels:{B:labels,L:labels}}],rows=[4,6].map(searchDepth=>({source:root.id,phase:2,policy:root.policy,depth:4,searchDepth,choice:{B:1,L:1,P:1},regret:{B:0,L:0,P:0}}));
  const result=analyzeSources(records,{B:'B',L,P},{sources:1,transfer:1},rows);
  for(const selector of ['B','L']){const p=result.panels[selector];assert.equal(p.loss.B,p.loss.L);assert.equal(p.loss.L,p.loss.P);assert.equal(p.intervals['L-B'].mean,0);assert.equal(p.intervals['P-L'].lower975,0);assert.equal(p.byChildPhase.middle.loss.L,p.loss.L);}
  assert.equal(result.gates.L.pass,false);assert.equal(result.gates.P.pass,false);
});
import { MEMORY_PATCHES,executionIdentity } from '../scripts/next-residual/execution.mjs';
import { sourceDigest } from '../scripts/research/io.mjs';
import { mkdirSync,writeFileSync,cpSync } from 'node:fs';
test('memory-only source lineage retains science identity and rejects numerical or gate modifications',()=>{
  const out=mkdtempSync(join(tmpdir(),'next-residual-lineage-')),original=join(out,'source'),execution=join(out,'execution');
  try{
    for(const name of ['src','scripts/next-residual','tests','docs/data'])mkdirSync(join(original,name),{recursive:true});
    writeFileSync(join(original,'package.json'),'{}');writeFileSync(join(original,'src/engine.js'),'export const B=7;');
    const code=MEMORY_PATCHES.map(p=>p.before).join('\n');writeFileSync(join(original,'scripts/next-residual/run.mjs'),code);cpSync(original,execution,{recursive:true});
    let expected=code;for(const p of MEMORY_PATCHES)expected=expected.replace(p.before,p.after);writeFileSync(join(execution,'scripts/next-residual/run.mjs'),expected);
    const register=(patches=MEMORY_PATCHES)=>{const body={originalSource:sourceDigest(original),executionSource:sourceDigest(execution),patches};writeFileSync(join(out,'memory-repair.json'),JSON.stringify({...body,checksum:hash(body)}));};
    register();assert.equal(executionIdentity(execution,out),sourceDigest(original));
    writeFileSync(join(execution,'src/engine.js'),'export const B=8;');register();assert.throws(()=>executionIdentity(execution,out),/numerical source/);
    writeFileSync(join(execution,'src/engine.js'),'export const B=7;');writeFileSync(join(execution,'scripts/next-residual/run.mjs'),expected+'\nchangeGate();');register();assert.throws(()=>executionIdentity(execution,out),/beyond certified/);
    register([...MEMORY_PATCHES,{before:'gate',after:'changed'}]);assert.throws(()=>executionIdentity(execution,out),/certificate/);
  }finally{rmSync(out,{recursive:true,force:true});}
});
import { gameKeys } from '../scripts/next-residual/exclusions.mjs';
import { keysFor } from '../scripts/residual/data.mjs';
test('historical engineering-game exclusion includes the actual played continuation and both colors',async()=>{
  const opening={...trajectory().find(s=>counts(s.board).empty===5),id:'engineering'},result=await game(opening,makeModel(zero()),'B',1,1),keys=gameKeys(opening,result);
  let board=opening.board,player=opening.player;
  for(const step of result.moves){for(const key of keysFor(board))assert.ok(keys.has(key));
    if(step.move!==null)board=oracleChildren(board,player).find(c=>c.move===step.move).board;player=-player;}
  for(const key of keysFor(board))assert.ok(keys.has(key));
  assert.throws(()=>gameKeys(opening,{...result,moves:result.moves.slice(0,-1)}),/Incomplete/);
});
