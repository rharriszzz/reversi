import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_WEIGHTS, validWeights } from '../src/features.js';
import { proposeWeights, runGeneration, seededRandom, randomOpening, playModelMatch } from '../src/learning.js';

test('seeded candidate proposals are deterministic and valid', () => {
  const a = proposeWeights(DEFAULT_WEIGHTS, seededRandom(400));
  const b = proposeWeights(DEFAULT_WEIGHTS, seededRandom(400));
  assert.deepEqual(a, b);
  assert.equal(validWeights(a), true);
  assert.notDeepEqual(a, DEFAULT_WEIGHTS);
});

test('self-play ends with a valid result and 64-or-fewer discs', () => {
  const opening = randomOpening(seededRandom(123));
  const match = playModelMatch(opening, DEFAULT_WEIGHTS, DEFAULT_WEIGHTS, 1);
  assert.ok([-1, 0, 1].includes(match.result));
  assert.equal(match.counts.black + match.counts.white + match.counts.empty, 64);
});

test('a tiny paired tournament returns a reproducible learning decision', () => {
  const a = runGeneration(DEFAULT_WEIGHTS, { seed: 321, depth: 1, openingPairs: 1 });
  const b = runGeneration(DEFAULT_WEIGHTS, { seed: 321, depth: 1, openingPairs: 1 });
  assert.deepEqual(a, b);
  assert.equal(a.total, 2);
  assert.equal(a.wins + a.losses + a.draws, 2);
});
