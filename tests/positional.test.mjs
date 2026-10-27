import test from 'node:test';
import assert from 'node:assert/strict';
import { anchoredEdgeDiscs, stableEdgeFeature, smoothWeights, EVALUATORS } from '../src/evaluation.js';
import { DEFAULT_WEIGHTS, evaluate } from '../src/features.js';
import { boardFromRows, initialBoard, play } from '../src/rules.js';
import { randomOpening, seededRandom } from '../src/learning.js';
import { oracleChildren } from './oracle.mjs';
import { oracleScore } from './oracle.mjs';
import { findBestMove } from '../src/search.js';
import { readFileSync } from 'node:fs';

test('anchored edge runs exclude corners, gaps, interior discs and duplicate full edges', () => {
  const board = boardFromRows(['BBBBBBBB','B.......','B.B.....','........','........','........','........','........']);
  assert.deepEqual(anchoredEdgeDiscs(board).sort((a,b) => a-b), [1,2,3,4,5,6,8,16]);
  assert.equal(stableEdgeFeature(board, 1), 8/24);
  assert.equal(stableEdgeFeature(board, -1), -8/24);
  assert.equal(stableEdgeFeature(initialBoard(), 1), 0);
});

test('every claimed stable edge disc survives ALL independent six-empty continuations', () => {
  for (const seed of [1531, 4117, 7813]) {
    const { board } = randomOpening(seededRandom(seed), 54);
    const stable = anchoredEdgeDiscs(board);
    assert.ok(stable.length > 0);
    function visit(position, player, passed = false) {
      for (const square of stable) assert.equal(position[square], board[square]);
      const children = oracleChildren([...position], player);
      if (!children.length) { if (!passed) visit(position, -player, true); return; }
      for (const child of children) visit(child.board, -player);
    }
    visit(board, 1);
  }
});

test('smooth weights hit unchanged anchors and interpolate without phase-boundary jumps', () => {
  assert.deepEqual(smoothWeights(4), DEFAULT_WEIGHTS.opening);
  assert.deepEqual(smoothWeights(40), DEFAULT_WEIGHTS.middle);
  assert.deepEqual(smoothWeights(64), DEFAULT_WEIGHTS.endgame);
  for (const key of Object.keys(DEFAULT_WEIGHTS.opening)) {
    assert.equal(smoothWeights(22)[key], (DEFAULT_WEIGHTS.opening[key] + DEFAULT_WEIGHTS.middle[key])/2);
    assert.equal(smoothWeights(52)[key], (DEFAULT_WEIGHTS.middle[key] + DEFAULT_WEIGHTS.endgame[key])/2);
    assert.ok(Math.abs(smoothWeights(28.00001)[key] - smoothWeights(27.99999)[key]) < 0.001);
  }
});

test('experimental evaluators retain antisymmetry and all board symmetries', () => {
  const { board } = randomOpening(seededRandom(1009), 42);
  for (const evaluator of Object.values(EVALUATORS)) {
    assert.equal(evaluator(board, 1), -evaluator(board, -1));
    for (let mirror = 0; mirror < 2; mirror++) for (let rotation = 0; rotation < 4; rotation++) {
      const transformed = new Int8Array(64);
      board.forEach((value, i) => {
        let r = i >> 3, c = i & 7;
        if (mirror) c = 7-c;
        for (let n=0; n<rotation; n++) [r,c]=[c,7-r];
        transformed[r*8+c]=value;
      });
      assert.equal(evaluator(board, 1), evaluator(transformed, 1));
    }
  }
  assert.equal(EVALUATORS.baseline(board, 1), evaluate(board, 1));
});

test('corner capture receives an explicit stable-edge increment without changing original weights', () => {
  const board = boardFromRows(['.WWB....','WB......','W.B.....','B..B....','........','........','........','........']);
  const child = play(board, 1, 0);
  assert.equal(anchoredEdgeDiscs(child).length, 6);
  assert.equal(EVALUATORS.stableEdges(child, 1) - evaluate(child, 1), 15);
  assert.equal(DEFAULT_WEIGHTS.middle.corners, 120);
});

test('tactical fixtures independently establish greedy corner loss and a shallow edge correction', () => {
  const fixtures = JSON.parse(readFileSync(new URL('./fixtures/positional.json', import.meta.url)));
  assert.equal(fixtures.length, 2);
  for (const fixture of fixtures) {
    const board = boardFromRows(fixture.rows), player = fixture.player;
    const exact = oracleChildren([...board], player).map(child => ({ move:child.move, score:-oracleScore(child.board,-player) }));
    for (const row of fixture.exact) assert.equal(exact.find(r=>r.move===row.move).score,row.score);
    assert.equal(Math.max(...exact.map(row=>row.score)),fixture.bestScore);
    assert.equal(findBestMove(board,player,1).move,fixture.baselineDepth1);
    assert.equal(findBestMove(board,player,1,undefined,{evaluate:EVALUATORS.stableEdges}).move,fixture.stableDepth1);
    if (fixture.name === 'greedy-corner-concession') {
      assert.ok(fixture.bestScore > 9000);
      assert.ok(exact.find(row=>row.move===fixture.greedy).score < -9000);
      const cornerReplies = oracleChildren([...play(board,player,fixture.greedy)],-player)
        .map(child=>child.move).filter(move=>[0,7,56,63].includes(move));
      assert.deepEqual(cornerReplies,fixture.cornersAfterGreedy);
    } else {
      assert.equal(exact.find(row=>row.move===fixture.stableDepth1).score,fixture.bestScore);
      assert.ok(exact.find(row=>row.move===fixture.baselineDepth1).score < fixture.bestScore);
    }
  }
});
