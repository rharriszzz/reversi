import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../src/features.js';
import { evaluateFast } from '../src/fast-features.js';
import { makeEvaluator, makeFastStableEvaluator } from '../src/evaluation.js';
import { randomOpening, seededRandom } from '../src/learning.js';
import { pairedMatch } from '../scripts/experiment-lib.mjs';

test('fast stable-edge candidates preserve their reference values at each grid weight', () => {
  for(let seed=31029001;seed<31029031;seed++) {
    const {board,player}=randomOpening(seededRandom(seed),seed%55);
    if(player===null) continue;
    for(const weight of [15,30,60,90]) {
      assert.equal(makeFastStableEvaluator(weight)(board,player),makeEvaluator({stableEdgeWeight:weight})(board,player));
    }
    assert.equal(evaluateFast(board,player),evaluate(board,player));
  }
  assert.throws(()=>makeFastStableEvaluator(NaN));
});

test('checkpointed one-pair matches preserve alternating color order using a global pair offset', () => {
  const opening=randomOpening(seededRandom(31029037),8);
  const engine={name:'test',evaluate:evaluateFast};
  const result=pairedMatch(engine,engine,[opening],{depth:1},1,1);
  assert.deepEqual(result.games.map(game=>game.candidateColor),[-1,1]);
  assert.equal(result.scoreRate,0.5);
});
