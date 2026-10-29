import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { load, verifyFixture, numericalDifference, trainingGroups, positions, bSearch, task } from '../scripts/machine-benchmark/suite.mjs';
const path = fileURLToPath(new URL('../scripts/machine-benchmark/positions.json', import.meta.url));
test('public hardware fixtures reproduce seeds, hashes, B results and source-weighted fit inputs', () => {
  const fixture = load(path);
  verifyFixture(fixture);
  assert.equal(positions().roots.length, 16);
  assert.equal(positions().exact.length, 8);
  assert.ok(trainingGroups(fixture).reduce((n, g) => n + g.pairs.length, 0) > 100);
  fixture.roots.forEach((s, i) => assert.deepEqual(bSearch(s), fixture.expected.B[i]));
  const changed = structuredClone(fixture); changed.roots[0].board[0] = 1;
  assert.throws(() => verifyFixture(changed));
});
test('hardware checks disclose every tolerated fitting difference and reject changed search work', async () => {
  const expected = { coefficients: [1, 2], loss: .5, iteration: 10 };
  const actual = { ...expected, coefficients: [1 + 1e-9, 2] };
  assert.equal(numericalDifference(expected, expected).exactHashMatch, true);
  assert.equal(numericalDifference(actual, expected, 1e-7).exactHashMatch, false);
  assert.throws(() => numericalDifference(actual, expected));
  assert.throws(() => numericalDifference({ ...expected, iteration: 11 }, expected, 1e-7));
  const fixture = load(path); fixture.expected.B[0][0].score++;
  await assert.rejects(task(fixture, null, 'B', 0));
});
test('complete public engineering fits converge and reproduce their frozen numerical values', async () => {
  const fixture = load(path);
  for (const kind of ['linear', 'pattern']) {
    const r = await task(fixture, null, kind, 0);
    assert.ok(r.converged);
    assert.equal(r.difference.maxAbs, 0);
    assert.equal(r.difference.exactHashMatch, true);
  }
});
