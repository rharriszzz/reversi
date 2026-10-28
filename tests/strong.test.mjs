import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createModel, sparse, dot, compile, pack, unpack, patternIndices, FEATURE_KEYS, phaseOf } from '../scripts/strong/model.mjs';
import { generate, policyPool, solveIndependent, exactContinuation, searchLabel } from '../scripts/strong/data.mjs';
import { fit, ranking } from '../scripts/strong/train.mjs';
import { interval } from '../scripts/strong/report.mjs';
import { historicalKeys } from '../scripts/strong/run.mjs';
import { MAPS, canonical, decodeTerminal, makeModel, engine } from '../scripts/research/core.mjs';
import { compileLegacy } from '../scripts/strong/diagnose-previous.mjs';
import { fillFeaturesFast, extractFeaturesFast, legalMovesFast } from '../src/fast-features.js';
import { initialBoard, play, legalMoves, counts } from '../src/rules.js';
import { findBestMove } from '../src/search.js';
import { seededRandom, randomOpening } from '../src/learning.js';
import { oracleScore, oracleChildren } from './oracle.mjs';

test('caller-owned feature scan preserves all seven features and known mobility',()=>{
  for(let seed=8901;seed<8920;seed++) {
    const p=randomOpening(seededRandom(seed),seed%50+8),scratch=new Float64Array(7);
    for(const side of [1,-1]) {
      assert.equal(fillFeaturesFast(p.board,side,scratch,legalMovesFast(p.board,side).length),64-counts(p.board).empty);
      const f=extractFeaturesFast(p.board,side);FEATURE_KEYS.forEach((key,i)=>assert.equal(scratch[i],f[key]));
    }
  }
});
test('compiled typed tuples match sparse math, serialization, D4, color reversal and quantization',()=>{
  const rng=seededRandom(7771);
  for(const family of ['linear','short','long','hybrid']) {
    const m=createModel(family,'rank');for(let i=0;i<m.weights.length;i++) {m.weights[i]=rng()*20-10;m.counts[i]=Math.floor(rng()*100);}
    const restored=unpack(pack(m));assert.deepEqual(restored.weights,m.weights);assert.deepEqual(restored.spec,m.spec);
    const fast=compile(restored),integer=compile(restored,{integer:true});
    for(const plies of [12,28,44,55]) {
      const p=randomOpening(seededRandom(10000+plies),plies),v=fast.evaluate(p.board,1),reference=dot(m,sparse(p.board,m));
      assert.ok(Math.abs(v-reference)<1e-4,`${family} sparse mismatch ${v} ${reference}`);
      assert.ok(Math.abs(v-integer.evaluate(p.board,1))<fast.records.length/512+1e-4);
      assert.ok(Math.abs(v+fast.evaluate(Int8Array.from(p.board,x=>-x),1))<1e-9);
      for(const map of MAPS) assert.ok(Math.abs(v-fast.evaluate(map.map(i=>p.board[i]),1))<1e-9,`${family} D4`);
      assert.equal(fast.evaluate(p.board,-1),-v);
      if(m.spec.linear) assert.ok(Math.abs(v-fast.evaluate(p.board,1,undefined,legalMovesFast(p.board,1).length))<1e-9);
    }
  }
});
test('incremental indices match EVERY changed-square code through complete games and undo',()=>{
  for(const family of ['short','long','hybrid']) {
    const spec=createModel(family).spec,rng=seededRandom(9181);let board=initialBoard(),p=1,passes=0;
    const inc=patternIndices(board,spec);
    while(passes<2) {
      const legal=legalMoves(board,p);if(!legal.length){passes++;p=-p;continue;}passes=0;
      const b=play(board,p,legal[Math.floor(rng()*legal.length)]),changes=[];
      for(let square=0;square<64;square++) if(board[square]!==b[square]) changes.push({square,before:board[square],after:b[square]});
      const old=Int32Array.from(inc.codes);inc.update(changes);assert.deepEqual(inc.codes,patternIndices(b,spec).codes);
      inc.update(changes.map(c=>({...c,before:c.after,after:c.before})));assert.deepEqual(inc.codes,old);
      inc.update(changes);board=b;p=-p;
    }
  }
});
test('complete generation replays with independent rules, explicit passes, policy and identities',()=>{
  for(const seed of [99123,99124,99125]) {
    const game=generate({seed,index:seed,split:'test',depth:1});assert.deepEqual(game,generate({seed,index:seed,split:'test',depth:1}));
    assert.deepEqual(game,generate({seed,index:seed,split:'test',depth:1,compiledPolicies:policyPool()}));
    let board=[...initialBoard()];for(const step of game.moves) {
      if(step.move===null) assert.equal(oracleChildren(board,step.player).length,0);
      else board=oracleChildren(board,step.player).find(c=>c.move===step.move).board;
    }
    assert.deepEqual(board,game.terminal);assert.equal(board.reduce((s,v)=>s+v,0),game.margin);
    for(const s of game.states){assert.ok(s.placements>=16);assert.equal(s.key,canonical(s.board,s.player));}
  }
});
test('every configured phase has actual post-randomization training coverage',()=>{
  const game=generate({seed:77191,index:2,split:'train'});
  for(const phases of [4,6]) {
    const m=createModel('short','margin',phases),hits=Array(phases).fill(0);
    for(const s of game.states) hits[phaseOf(64-counts(s.board).empty,m.spec)]++;
    assert.ok(hits.every(n=>n>0),`untrained phase: ${hits}`);
    assert.equal(phaseOf(12,m.spec),0);assert.equal(phaseOf(20,m.spec),0);
  }
});
test('independent exact values, all alternative moves and witness lines agree including passes',()=>{
  let seenPass=false;
  for(let seed=20278;seed<20288;seed++) {
    const p=randomOpening(seededRandom(seed),54);if(!p.player)continue;
    const ref=solveIndependent(p.board,p.player);assert.equal(ref.value,decodeTerminal(oracleScore(p.board,p.player)));
    assert.equal(ref.value,decodeTerminal(findBestMove(p.board,p.player,6).score));
    for(const row of ref.rows) {assert.equal(row.margin,decodeTerminal(-oracleScore(play(p.board,p.player,row.move),-p.player))||0);const c=exactContinuation(ref,row.move);assert.equal(c.margin,row.margin);seenPass ||= c.line.includes('pass');}
  }
  assert.ok(seenPass);assert.throws(()=>solveIndependent(initialBoard(),1,{maxNodes:10}),/cap/);
});
test('search labels retain common depth and actual opponent replies; preference fitting reduces independent labeled ordering loss',()=>{
  const game=generate({seed:76511,index:3,split:'train'}),state=game.states[12],ref=searchLabel(state,3);
  for(const row of ref.rows) {
    const b=play(state.board,state.player,row.move),r=findBestMove(b,-state.player,2);
    assert.equal(row.estimate,-r.score);assert.equal(row.reply,r.move);assert.equal(row.depth,3);
  }
  // An independent exact set is used for the training-direction regression.
  const refs=game.states.filter(s=>counts(s.board).empty===6).map(s=>({...s,...solveIndependent(s.board,s.player)}));
  const m=createModel('short','rank'),before=ranking(m,refs).exact.pairAccuracy;
  const trained=fit(m,[],refs,[],{epochs:80,seed:42,rate:0.3,l2:0});
  assert.ok(trained.preferencePairs>0);assert.ok(ranking(m,refs).exact.pairAccuracy>before);
  const countsBefore=Uint32Array.from(m.counts);fit(m,[],refs,[],{epochs:1,countGames:[],countLabels:[]});assert.deepEqual(m.counts,countsBefore);
});
test('historical disclosed positions excluded and fixed paired uncertainty only adjusts the two actual controls',()=>{
  const h=historicalKeys();assert.ok(h.keys.size>3823);
  assert.ok(interval(Array(256).fill(.7)).interval[0]>.5);assert.equal(interval([0,1]).mean,.5);assert.deepEqual(interval([]).interval,[0,1]);
});
test('historical exclusion carries labeled alternatives across independent campaigns',()=>{
  const folder=mkdtempSync(join(tmpdir(),'reversi-label-exclusions-'));
  try {
    const p=randomOpening(seededRandom(112091),24),move=legalMovesFast(p.board,p.player)[0],child=play(p.board,p.player,move);
    writeFileSync(join(folder,'labels.json'),JSON.stringify({labels:[{board:[...p.board],player:p.player,rows:[{move}]}]}));
    writeFileSync(join(folder,'manifest.json'),JSON.stringify({labels:{train:[join(folder,'labels.json')]}}));
    const h=historicalKeys(folder,[folder]);assert.ok(h.keys.has(canonical(child,-p.player)));
    mkdirSync(join(folder,'docs/data'),{recursive:true});
    writeFileSync(join(folder,'docs/data/strong-evaluator-20261028.json'),JSON.stringify({publishedKeys:[canonical(child,-p.player)]}));
    assert.ok(historicalKeys(folder).keys.has(canonical(child,-p.player)));
  } finally {rmSync(folder,{recursive:true,force:true});}
});
test('historical allocation-free linear/stable compilation preserves values and minimax',()=>{
  const m=makeModel('test','linear','sgd',{extra:['stable']}),rng=seededRandom(811);
  m.weights=m.weights.map(()=>rng()*100-50);const a=engine(m).evaluate,b=compileLegacy(m);
  for(const plies of [12,24,40,52]) {const p=randomOpening(seededRandom(71000+plies),plies);for(const side of [1,-1]) assert.ok(Math.abs(a(p.board,side)-b(p.board,side))<1e-10);
    const x=findBestMove(p.board,p.player,3,undefined,{evaluate:a}),y=findBestMove(p.board,p.player,3,undefined,{evaluate:b});assert.equal(x.move,y.move);assert.ok(Math.abs(x.score-y.score)<1e-9);}
});
