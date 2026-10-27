import test from 'node:test';
import assert from 'node:assert/strict';
import { pairedMatch, pairedSummary } from '../scripts/experiment-lib.mjs';
import { openingSet } from '../scripts/evaluate.mjs';
import { EVALUATORS } from '../src/evaluation.js';

test('paired experiments preserve colors, deterministic depth budgets, and pair-level uncertainty', () => {
  const engine={name:'baseline',evaluate:EVALUATORS.baseline}, openings=openingSet(93617,2);
  const a=pairedMatch(engine,engine,openings,{depth:1});
  assert.equal(a.scoreRate,0.5); assert.equal(a.games.length,4);
  assert.deepEqual(a.games.map(g=>g.candidateColor),[1,-1,-1,1]);
  for(const game of a.games) for(const stats of Object.values(game.stats)) {
    assert.ok(stats.every(move=>move.depth===1 && move.nodes>=move.evaluations));
  }
  const b=pairedMatch(engine,engine,openings,{depth:1});
  assert.deepEqual(a.pairPoints,b.pairPoints);
  assert.deepEqual(a.games.map(g=>g.counts),b.games.map(g=>g.counts));
  const interval=pairedSummary([0,1]);
  assert.equal(interval.openingPairs,2); assert.equal(interval.scoreRate,0.5);
  assert.deepEqual(interval.interval95,[0,1]);
});
