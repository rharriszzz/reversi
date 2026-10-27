import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, extractFeatures, cloneWeights } from '../src/features.js';
import { evaluateFast, extractFeaturesFast, countLegalMovesFast } from '../src/fast-features.js';
import { initialBoard, legalMoves, boardFromRows } from '../src/rules.js';
import { seededRandom } from '../src/learning.js';
import { findBestMove, scoreAllMoves } from '../src/search.js';
import { oracleChildren, oracleScore } from './oracle.mjs';

test('fast extraction and weighted scores are exactly equal throughout 40 independent seeded games', () => {
  const rng=seededRandom(31020017), weights=cloneWeights();
  weights.middle.mobility=31.37; weights.endgame.frontier=-0.127; weights.opening.discs=12.345;
  let checked=0, passes=0;
  for(let game=0;game<40;game++) {
    let board=[...initialBoard()], player=1;
    while(true) {
      for(const side of [1,-1]) {
        const moves=oracleChildren(board,side), reference=extractFeatures(board,side);
        assert.equal(countLegalMovesFast(board,side),moves.length);
        assert.deepEqual(extractFeaturesFast(board,side),reference);
        assert.deepEqual(extractFeaturesFast(board,side,moves.length),reference);
        for(const model of [undefined,weights]) {
          assert.equal(evaluateFast(board,side,model),evaluate(board,side,model));
          assert.equal(evaluateFast(board,side,model,moves.length),evaluate(board,side,model));
        }
        checked++;
      }
      const children=oracleChildren(board,player);
      if(!children.length) {
        if(!oracleChildren(board,-player).length) break;
        passes++; player=-player; continue;
      }
      board=children[Math.floor(rng()*children.length)].board; player=-player;
    }
  }
  assert.ok(checked>4000 && passes>0);
});

test('fast evaluator retains fixed-depth moves, scores, node counts, pruning and solved results', () => {
  let board=initialBoard(), player=1;
  const rng=seededRandom(31020019);
  for(let ply=0;ply<60;ply++) {
    const moves=oracleChildren([...board],player);
    if(!moves.length) { player=-player; if(!oracleChildren([...board],player).length) break; continue; }
    if(ply%8===0) {
      const a=findBestMove(board,player,4,undefined,{evaluate});
      const b=findBestMove(board,player,4,undefined,{evaluate:evaluateFast});
      for(const key of ['move','score','nodes','evaluations','exact']) assert.equal(a[key],b[key],key);
      assert.equal(scoreAllMoves(board,player,4).results[0].score,b.score);
    }
    if(ply===54) {
      const result=findBestMove(board,player,6,undefined,{evaluate:evaluateFast});
      assert.equal(result.score,oracleScore([...board],player));
      assert.equal(result.exact,true);
    }
    board=Int8Array.from(moves[Math.floor(rng()*moves.length)].board); player=-player;
  }
  for(const rows of [Array(8).fill('BBBBBBBB'),['.WBBBBBB',...Array(6).fill('BBBBBBBB'),'BBBBBBB.']]) {
    const position=boardFromRows(rows);
    for(const side of [1,-1]) assert.equal(evaluateFast(position,side),evaluate(position,side));
  }
});
