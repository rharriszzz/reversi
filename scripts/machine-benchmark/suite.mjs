// Disclosed engineering work only. Never read a research run or promote a model.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialBoard, legalMoves, play, counts } from '../../src/rules.js';
import { seededRandom } from '../../src/learning.js';
import { evaluateFast } from '../../src/fast-features.js';
import { findBestMove } from '../../src/search.js';
import { oracleScore } from '../../tests/oracle.mjs';
import { solveBoth } from '../teacher/exact.mjs';
import { solveReference } from '../teacher/reference-exact.mjs';
import { alternatives, identity } from '../teacher/edax.mjs';
import { preflight } from '../teacher/bound-preflight.mjs';
import { childEncoding, zero, makeModel, fit as fitLinear, normalizePairs } from '../next-residual/linear.mjs';
import { patternEncoding, csr, makePattern, DIMENSION } from '../next-residual/model.mjs';
import { fit as fitPattern } from '../next-residual/optimize.mjs';
import { hash } from '../next-residual/protocol.mjs';
export { hash };
export const KINDS = ['edax10', 'edax12', 'B', 'exact', 'linear', 'pattern'];
export function load(path) { return JSON.parse(readFileSync(path, 'utf8')); }
export function pinFor(buildFile, evalFile) {
  return identity(load(buildFile).binary, evalFile, { buildFile });
}
export function trajectory(seed) {
  const rng = seededRandom(seed), states = []; let board = [...initialBoard()], player = 1, passes = 0;
  while (passes < 2) {
    states.push({ board, player }); const moves = legalMoves(board, player);
    if (!moves.length) { passes++; player = -player; continue; }
    passes = 0; board = [...play(board, player, moves[Math.floor(rng() * moves.length)])]; player = -player;
  }
  return states;
}
export function positions() {
  const roots = [], exact = [];
  // Public seeds and complete boards are engineering fixtures, never holdouts.
  for (const seed of [74102901, 74102902, 74102903, 74102904]) {
    const states = trajectory(seed);
    for (const occupied of [16, 30, 44, 52]) {
      const s = states.find(s => 64 - counts(s.board).empty === occupied);
      assert.ok(s && legalMoves(s.board, s.player).length);
      roots.push({ id: `seed-${seed}-occupied-${occupied}`, seed, occupied, ...s });
    }
    for (const empty of [10, 12]) {
      const s = states.find(s => counts(s.board).empty === empty);
      assert.ok(s); exact.push({ id: `seed-${seed}-empty-${empty}`, seed, ...s });
    }
  }
  return { roots, exact };
}
// JSON has one numeric zero; Edax negation can produce JS -0. No score changes.
const values = rows => rows.map(({ move, value }) => ({ move, value: value || 0 }));
export function bSearch(s) {
  return [4, 6].map(depth => {
    const r = findBestMove(s.board, s.player, depth);
    return Object.fromEntries(['move', 'score', 'nodes', 'evaluations', 'exact'].map(k => [k, r[k]]).concat([['depth', depth]]));
  });
}
export function trainingGroups(fixture) {
  const groups = fixture.roots.map((s, i) => {
    const labels = fixture.expected.edax12[i], children = new Map();
    for (const row of labels) {
      const board = [...play(s.board, s.player, row.move)];
      children.set(row.move, { ...childEncoding(board, s.player), sparse: patternEncoding(board, s.player) });
    }
    const pairs = [];
    for (const a of labels) for (const b of labels) if (a.value > b.value) {
      const ca = children.get(a.move), cb = children.get(b.move);
      if (ca.terminal || cb.terminal) continue;
      const map = new Map(ca.sparse);
      for (const [k, v] of cb.sparse) map.set(k, (map.get(k) ?? 0) - v);
      pairs.push({ base: ca.base - cb.base, x: ca.x.map((v, j) => v - cb.x[j]), rawWeight: 1,
        sparse: [...map].filter(([, v]) => v).sort((a, b) => a[0] - b[0]) });
    }
    return { id: s.id, pairs };
  });
  // Fixed replicated encoding load, explicitly not independent observations.
  return Array.from({ length: fixture.fittingReplicas }, (_, replica) => groups.map(g => ({ ...g, id: `${g.id}/engineering-replica-${replica}` }))).flat();
}
export function fitting(fixture, kind) {
  const groups = trainingGroups(fixture), checkpoints = [];
  // Save compact real optimizer checkpoints; serialization/write is in the task.
  const checkpoint = s => checkpoints.push({ iteration: s.iteration, loss: s.loss, converged: s.converged ?? false });
  if (kind === 'linear') {
    const fit = fitLinear(normalizePairs(groups), 0, { checkpoint });
    return { model: makeModel(fit.delta, { purpose: 'public hardware engineering control' }),
      numerical: { coefficients: fit.delta, loss: fit.loss, iteration: fit.iteration }, checkpoints, converged: fit.converged };
  }
  // Frozen engineering L, identical on both computers. New table fit starts at zero.
  const L = fixture.linearModel;
  const data = csr(groups.map(g => ({ ...g, pairs: g.pairs.map(p => ({ ...p,
    base: p.base + p.x.reduce((n, x, j) => n + x * L.correction[j], 0) })) })));
  const fit = fitPattern(data, 1e-5, { checkpoint });
  return { model: makePattern(L, fit.coefficients, { purpose: 'public hardware engineering control', data: data.identity }),
    numerical: { coefficients: fit.coefficients, loss: fit.loss, iteration: fit.iteration }, checkpoints, converged: fit.converged };
}
export async function makeFixture(pin) {
  const fixture = { version: 1, fittingReplicas: 16, purpose: 'Disclosed engineering positions; exclude from future research holdouts',
    ...positions(), expected: { edax10: [], edax12: [], B: [], exact: [] } };
  for (const s of fixture.roots) {
    for (const depth of [10, 12]) fixture.expected[`edax${depth}`].push(values((await alternatives(pin, s, depth)).rows));
    fixture.expected.B.push(bSearch(s));
  }
  for (const s of fixture.exact) {
    const r = solveBoth(s.board, s.player, { capMs: 120000 });
    fixture.expected.exact.push({ awarded: { value: r.awarded.value, rows: values(r.awarded.rows) },
      raw: { value: r.raw.value, rows: values(r.raw.rows) } });
  }
  const linear = fitting(fixture, 'linear'); fixture.linearModel = linear.model;
  fixture.expected.linear = linear.numerical; fixture.expected.pattern = fitting(fixture, 'pattern').numerical;
  fixture.corpusHash = hash(trainingGroups(fixture));
  fixture.identity = hash(fixture); return fixture;
}
export function verifyFixture(fixture) {
  const { identity: digest, ...body } = fixture;
  assert.equal(hash(body), digest, 'Fixture changed');
  assert.deepEqual({ roots: fixture.roots, exact: fixture.exact }, positions());
  assert.equal(hash(trainingGroups(fixture)), fixture.corpusHash);
}
export function numericalDifference(actual, expected, tolerance = 0) {
  assert.equal(actual.coefficients.length, expected.coefficients.length);
  const maxAbs = Math.max(Math.abs(actual.loss - expected.loss), ...actual.coefficients.map((x, i) => Math.abs(x - expected.coefficients[i])));
  assert.ok(Number.isFinite(maxAbs) && maxAbs <= tolerance, `Numerical difference ${maxAbs} exceeds ${tolerance}`);
  assert.equal(actual.iteration, expected.iteration, 'Optimizer iteration count changed');
  return { exactHashMatch: hash(actual) === hash(expected), maxAbs, tolerance, actualHash: hash(actual), expectedHash: hash(expected) };
}
export async function validateSuite(fixture, pin, output) {
  verifyFixture(fixture);
  const adapter = await preflight(pin, output), checks = [];
  for (let i = 0; i < fixture.roots.length; i++) {
    const s = fixture.roots[i];
    for (const depth of [10, 12]) assert.deepEqual(values((await alternatives(pin, s, depth)).rows), fixture.expected[`edax${depth}`][i]);
    assert.deepEqual(bSearch(s), fixture.expected.B[i]);
    assert.equal(findBestMove(s.board, s.player, 3).score, oracleScore(s.board, s.player, 3, evaluateFast));
  }
  for (let i = 0; i < fixture.exact.length; i++) {
    const s = fixture.exact[i], expected = fixture.expected.exact[i];
    for (const awarded of [true, false]) {
      const key = awarded ? 'awarded' : 'raw', ref = solveReference(s.board, s.player, awarded, performance.now() + 120000);
      assert.deepEqual({ value: ref.value, rows: values(ref.rows) }, expected[key]);
      assert.deepEqual(values((await alternatives(pin, s, counts(s.board).empty)).rows), expected.awarded.rows);
    }
  }
  for (const kind of ['linear', 'pattern']) {
    const fit = fitting(fixture, kind); assert.ok(fit.converged);
    checks.push({ kind, ...numericalDifference(fit.numerical, fixture.expected[kind], 1e-7) });
  }
  return { passed: true, fixtureIdentity: fixture.identity, teacherRoots: 32, bRoots: 16, independentExactRoots: 8,
    adapterFixtures: adapter.validation.fixtures, extremeFixtures: adapter.exact.length, fitting: checks,
    note: 'Native macOS is validated only if this command actually runs there. Search integers must match exactly; fitting differences are recorded.' };
}
export async function task(fixture, pin, kind, index) {
  let result, numerical;
  if (kind.startsWith('edax')) {
    const i = index % fixture.roots.length, r = await alternatives(pin, fixture.roots[i], Number(kind.slice(4)), { measureNative: true });
    numerical = values(r.rows); assert.deepEqual(numerical, fixture.expected[kind][i]);
    result = { numerical, nodes: r.rows.reduce((s, x) => s + x.nodes, 0), alternatives: r.rows.length, native: r.native };
  } else if (kind === 'B') {
    const i = index % fixture.roots.length; numerical = bSearch(fixture.roots[i]); assert.deepEqual(numerical, fixture.expected.B[i]);
    result = { numerical, nodes: numerical.reduce((s, x) => s + x.nodes, 0) };
  } else if (kind === 'exact') {
    const i = index % fixture.exact.length, s = fixture.exact[i], r = solveBoth(s.board, s.player, { capMs: 120000 });
    numerical = Object.fromEntries(['awarded', 'raw'].map(k => [k, { value: r[k].value, rows: values(r[k].rows) }]));
    assert.deepEqual(numerical, fixture.expected.exact[i]); result = { numerical, nodes: r.awarded.nodes + r.raw.nodes };
  } else {
    result = fitting(fixture, kind); assert.ok(result.converged);
    result.difference = numericalDifference(result.numerical, fixture.expected[kind], 1e-7); numerical = result.numerical;
  }
  return { ...result, numericalHash: hash(numerical) };
}
