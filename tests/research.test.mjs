import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { legalMoves, play, counts, initialBoard } from '../src/rules.js';
import { legalMovesFast, evaluateFast } from '../src/fast-features.js';
import { findBestMove, scoreAllMoves } from '../src/search.js';
import { seededRandom, randomOpening } from '../src/learning.js';
import { oracleChildren, oracleScore } from './oracle.mjs';
import { MAPS, canonical, vector, dot, makeModel, candidates, fit, predictionLoss, generateGame,
  exactReference, exactLine, engine, pairInterval, shortlist, extras, EXTRA, FEATURES, calibratePrediction } from '../scripts/research/core.mjs';
import { atomic, sourceDigest } from '../scripts/research/io.mjs';
import { summarizePairs } from '../scripts/research/report.mjs';
import { parseArgs } from '../scripts/research.mjs';

test('allocation-light move list agrees with both rule oracles throughout games',()=>{
  let passes=0;
  for(let seed=9801;seed<9831;seed++) {
    const rng=seededRandom(seed);let board=initialBoard(),player=1;
    for(let n=0;n<128;n++) {
      for(const side of [1,-1]) assert.deepEqual(legalMovesFast(board,side),oracleChildren(board,side).map(c=>c.move));
      const moves=legalMovesFast(board,player);
      if(!moves.length) {if(!legalMoves(board,-player).length) break;player=-player;passes++;continue;}
      board=play(board,player,moves[Math.floor(rng()*moves.length)]);player=-player;
    }
  }
  assert.ok(passes>0);
});

test('research move generation and cross-iteration hints preserve minimax and exact endings',()=>{
  for(const plies of [8,28,54]) for(let seed=4401;seed<4405;seed++) {
    const p=randomOpening(seededRandom(seed),plies);if(!p.player) continue;
    const depth=plies===54?6:3,baseline=findBestMove(p.board,p.player,depth);
    for(const orderingHints of [false,true]) {
      const result=findBestMove(p.board,p.player,depth,undefined,{legalMoves:legalMovesFast,orderingHints,timeMs:1,now:()=>0});
      assert.equal(result.score,baseline.score);
      const child=play(p.board,p.player,result.move);
      assert.equal(-oracleScore(child,-p.player,depth-1,evaluateFast),baseline.score);
    }
  }
});

test('ternary pattern sharing and handcrafted features obey D4 and color reversal',()=>{
  const models=candidates();const rng=seededRandom(98135);
  for(const model of models) model.weights=model.weights.map(()=>rng()*20-10);
  for(const plies of [14,36,54]) {
    const {board,player}=randomOpening(seededRandom(8092+plies),plies);
    const key=canonical(board,player);
    for(const map of MAPS) {
      const transformed=Int8Array.from(map.map(i=>board[i]));
      assert.equal(canonical(transformed,player),key);
      const reverse=Int8Array.from(transformed,v=>-v);
      assert.equal(canonical(reverse,-player),key);
      extras(board).forEach((value,i)=>assert.ok(Math.abs(value-extras(transformed)[i])<1e-12));
      for(const model of models) {
        const original=dot(model.weights,vector(board,model)),mapped=dot(model.weights,vector(transformed,model)),reversed=dot(model.weights,vector(reverse,model));
        assert.ok(Math.abs(original-mapped)<1e-9,`${model.id} symmetry`);
        assert.ok(Math.abs(original+reversed)<1e-9,`${model.id} reversal`);
      }
    }
    EXTRA.forEach((name,i)=>assert.ok(Math.abs(extras(board,[name])[i]-extras(board)[i])<1e-12));
  }
});

test('linear model starts at B; supervised coordinate and SGD improve a measured objective',()=>{
  const model=makeModel('linear'),game=generateGame({seed:54009,split:'train',index:3});
  for(const s of game.states) assert.equal(engine(model).evaluate(s.board,s.player),evaluateFast(s.board,s.player));
  const dev=[game],initial=predictionLoss(model,dev).mse;
  const calibrated=calibratePrediction(makeModel('B'),dev);
  assert.ok(predictionLoss(calibrated,dev).mse<=initial);
  assert.equal(engine(calibrated).evaluate(game.states[0].board,1),evaluateFast(game.states[0].board,1));
  for(const method of ['sgd','coordinate']) {
    const trained=fit({...model,method},dev,dev,{epochs:4,seed:310});
    assert.ok(predictionLoss(trained.model,dev).mse<initial,method);
    assert.deepEqual(trained,fit({...model,method},dev,dev,{epochs:4,seed:310}));
  }
});

test('TD(lambda) applies fixed-Black eligibility updates and terminal targets at the correct scale',()=>{
  const model=makeModel('td','linear','td',{lambda:0.5,rate:0.1,l2:0});model.weights.fill(0);
  const a=randomOpening(seededRandom(71),10).board,b=play(a,1,legalMoves(a,1)[0]);
  const game={states:[{board:[...a]},{board:[...b]}],margin:16};
  const x=vector(a,model),y=vector(b,model),elig=new Map(x.map(([i,v])=>[i,v*0.5]));
  for(const [i,v] of y) elig.set(i,(elig.get(i)??0)+v);
  const norm=Math.max(1,[...elig.values()].reduce((s,v)=>s+v*v,0));
  const result=fit(model,[game],[game],{epochs:1}).model;
  for(const [i,v] of elig) assert.ok(Math.abs(result.weights[i]-0.1*25*v/norm)<1e-12);
  const td0=fit({...model,lambda:0},[game],[game],{epochs:1}).model;
  assert.notDeepEqual(result.weights,td0.weights);
});

test('independent exact labels, constrained continuations, and pass endings agree',()=>{
  for(const seed of [850001,850003,850006,850011]) {
    const p=randomOpening(seededRandom(seed),seed===850011?52:54);if(!p.player) continue;
    const ref=exactReference({board:[...p.board],player:p.player});
    for(const row of ref.rows) {
      const line=exactLine(ref,row.move);assert.equal(line.margin,row.margin);
      let b=ref.board,side=ref.player;
      for(const step of line.line) {
        assert.equal(step.player,side);
        if(step.move===null) {assert.equal(legalMoves(b,side).length,0);assert.ok(legalMoves(b,-side).length);}
        else b=oracleChildren(b,side).find(c=>c.move===step.move).board;
        side=-side;
      }
      assert.equal(legalMoves(b,1).length+legalMoves(b,-1).length,0);
    }
  }
});

test('pair-level uncertainty, summary tails and selection target scales are explicit',()=>{
  assert.deepEqual(pairInterval([]).interval,[0,1]);
  assert.ok(pairInterval(Array(128).fill(0.70),{comparisons:512,maxPairs:128}).interval[0]<0.5);
  assert.ok(pairInterval(Array(128).fill(1),{comparisons:48,maxPairs:128}).interval[0]>0.5);
  const row={depth:3,nodes:7,evaluations:4,wallMs:10,cpuMs:9,overrunMs:2,fallback:false};
  const pair={point:0.75,games:[{candidateColor:1,outcome:1,margin:2,stats:{black:[row],white:[row]}},{candidateColor:-1,outcome:0,margin:0,stats:{black:[row],white:[row]}}]};
  const s=summarizePairs([pair]);assert.equal(s.pairs,1);assert.equal(s.games,2);assert.equal(s.wins,1);assert.equal(s.draws,1);
  assert.equal(s.metrics.candidate.evaluationsPerSecond,400);assert.equal(s.metrics.candidate.cpuMs,18);
  const models=[makeModel('x'),makeModel('p','pattern'),makeModel('h','hybrid')];
  assert.deepEqual(shortlist([{id:'x',relativeMse:0.4},{id:'p',relativeMse:0.6},{id:'h',relativeMse:0.5}],models,2),['x','h']);
});

test('atomic checkpoints and argument validation reject unsafe ambiguity',()=>{
  const directory=mkdtempSync(join(tmpdir(),'reversi-atomic-'));
  try {const path=join(directory,'state.json');atomic(path,{a:1});atomic(path,{a:2});assert.equal(JSON.parse(readFileSync(path)).a,2);}
  finally {rmSync(directory,{recursive:true,force:true});}
  assert.throws(()=>parseArgs(['--hours','1','--seconds','2']));assert.throws(()=>parseArgs(['--workers','2.5']));assert.throws(()=>parseArgs(['--seed','NaN']));
  assert.throws(()=>parseArgs(['--mode','invalid']));assert.throws(()=>parseArgs(['--output']));
});
