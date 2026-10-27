import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_WEIGHTS, validWeights } from '../src/features.js';
import { trainLinearTD } from '../src/td.js';
import { benchmark, canonicalOpening, openingSet } from '../scripts/evaluate.mjs';

test('training and holdout openings are disjoint including board symmetries', () => {
  const used = new Set(), training = openingSet(20261026, 8, used), holdout = openingSet(734917, 8, used);
  const keys = training.map(canonicalOpening);
  assert.equal(used.size, 16);
  for (const opening of holdout) assert.ok(!keys.includes(canonicalOpening(opening)));
  assert.deepEqual(training, openingSet(20261026, 8));
});

test('TD is deterministic, finite, versioned, and does not alter the original weights', () => {
  const original = JSON.stringify(DEFAULT_WEIGHTS), openings = openingSet(19, 2);
  const a = trainLinearTD(DEFAULT_WEIGHTS, openings), b = trainLinearTD(DEFAULT_WEIGHTS, openings);
  assert.deepEqual(a, b);
  assert.equal(validWeights(a.weights), true);
  assert.notDeepEqual(a.weights, DEFAULT_WEIGHTS);
  assert.equal(JSON.stringify(DEFAULT_WEIGHTS), original);
  assert.ok(a.transitions > 0);
  assert.equal(a.format, 'reversi-linear-td-v1');
  assert.throws(() => trainLinearTD(DEFAULT_WEIGHTS, openings, { rate: NaN }));
});

test('identical models tie a paired-color benchmark; uncertainty uses opening pairs', () => {
  const result = benchmark(DEFAULT_WEIGHTS, DEFAULT_WEIGHTS, openingSet(2, 2), 1);
  assert.equal(result.scoreRate, 0.5);
  assert.equal(result.games, 4);
  assert.deepEqual(result.pairs, [0.5, 0.5]);
  assert.ok(result.interval95[0] <= 0.5 && result.interval95[1] >= 0.5);
});
