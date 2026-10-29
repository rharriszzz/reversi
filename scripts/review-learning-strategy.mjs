// Read-only analysis of already published evidence. No fitting, teacher query,
// fresh sampling, or access to private/locked research directories.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { collectFrontier } from './residual/frontier.mjs';
import { solveBoth } from './teacher/exact.mjs';
import { terminalScore } from '../src/search.js';
import { legalMoves, counts } from '../src/rules.js';
import assert from 'node:assert/strict';

const path = new URL('../docs/data/next-residual-results-20261029.json', import.meta.url);
const bytes = readFileSync(path), evidence = JSON.parse(bytes);
const source = evidence.reservedRootIdentities.find(r => r.id === 'assessment-174');
assert.ok(source);
const frontier = collectFrontier(source);
const parent = frontier.parents.find(p => p.occupied === 55 && p.children.some(c => c.move === 9 && c.terminal));
assert.ok(parent, 'Reconstructed disclosed B frontier contains the reported terminal comparison');
const solved = solveBoth(parent.board, parent.player, { capMs: 10000 });
const immediate = parent.children.find(c => c.move === 9);
assert.equal(terminalScore(immediate.board, parent.player), 10054);
assert.equal(solved.raw.rows.find(r => r.move === 9).value, 54);
assert.equal(solved.awarded.rows.find(r => r.move === 9).value, 62);
const examples = evidence.postOutcomeDiagnostics.examples.filter(e => e.selector === 'B');
for (const e of examples) {
  assert.equal(e.source, source.id);
  assert.equal(e.parent, frontier.parents.indexOf(parent));
  assert.equal(solved.awarded.rows.find(r => r.move === e.preferred).value, 64);
  assert.ok(solved.raw.rows.find(r => r.move === e.preferred).value > 54);
}
const exactCounts = Object.fromEntries(['B', 'L'].map(selector => {
  const rows = evidence.frontierRows.filter(r => r.selector === selector && r.exact.raw);
  return [selector, {
    parents: rows.length, sources: new Set(rows.map(r => r.source)).size,
    errorParents: Object.fromEntries(['B', 'L', 'P'].map(m => [m, rows.filter(r => r.exact.raw[m].wdlError).length])),
    sourcesWithErrors: Object.fromEntries(['B', 'L', 'P'].map(m => [m,
      new Set(rows.filter(r => r.exact.raw[m].wdlError).map(r => r.source)).size])),
  }];
}));
const result = {
  kind: 'disclosed-evidence-review-no-training-v1',
  input: 'docs/data/next-residual-results-20261029.json',
  inputSha256: createHash('sha256').update(bytes).digest('hex'),
  historicalRunIdentity: evidence.runIdentity,
  note: 'Reconstructs one published B frontier and independently solves it; historical raw receipts unavailable. Does not change old gates or independence status.',
  terminalExample: {
    source: source.id, sourceDepth: source.depth, parentBoard: parent.board,
    parentPlayer: parent.player, parentOccupied: parent.occupied, parentEmpties: counts(parent.board).empty,
    teacherDepthsReachTerminal: [10, 12].every(d => d >= counts(parent.board).empty),
    immediateMove: 9, immediateRaw: 54, immediateAwarded: 62, immediateProduction: 10054,
    preferredMoves: examples.map(e => e.preferred),
    alternatives: solved.raw.rows.map(r => ({move: r.move, raw: r.value,
      awarded: solved.awarded.rows.find(q => q.move === r.move).value,
      terminalChild: !legalMoves(parent.children.find(c => c.move === r.move).board, 1).length
        && !legalMoves(parent.children.find(c => c.move === r.move).board, -1).length})),
    firstPair: {...examples[0], logisticLoss: Math.log1p(Math.exp(-Math.abs(examples[0].baseMargin / 10)))
      + Math.max(0, -examples[0].baseMargin / 10)},
  },
  exactCounts,
  planning: {
    pairs80PerCandidate: 64, pairs300PerCandidate: 32, candidates: 2,
    nominalGameSeconds: 2 * (64 * 104 * .08 + 32 * 104 * .3),
    oneSidedHoeffdingRadius64Alpha025: Math.sqrt(Math.log(40) / (2 * 64)),
    approximatePairsForFivePointGain80PercentPowerSd05: Math.ceil(((1.96 + .842) * .5 / .05) ** 2),
  },
};
console.log(JSON.stringify(result, null, 2));
