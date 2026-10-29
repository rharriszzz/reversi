// A new experiment. No training and no positional eligibility gate.
import { hash } from '../next-residual/protocol.mjs';
export { hash };
function freeze(x) { for (const v of Object.values(x)) if (v && typeof v === 'object') freeze(v); return Object.freeze(x); }
export const PROTOCOL = freeze({
  version: 1, namespace: 'frozen-player-screen-v1-20261029',
  models: { B: 'original-production', L: 'ecf3fd376c680ced77d0b002ea2efb9fa4385737c4fffff734b901ab2968d97f',
    P: 'de4b84745589b0384ea3639f879e3c98990e802d176298ff8ef54f681520067f' },
  assessment: { sources: 128, strata: [[12,19],[20,35],[36,47],[48,55]],
    policies: ['B1-12%','B4-2%'], sourceDepths: [4,6], perCell: 8,
    teacherDepths: [10,12], fixedDepths: [4,5,6], timedMs: [80,300],
    frontierSources: 32, frontierSelectors: ['B','L','P'],
    frontierSubset: 'first two admitted IDs per cell; never selected by labels',
    exactSources: 32, exactEmpties: 10, exactPerPolicy: 16 },
  games: { families: 96, pairs80: 64, pairs300: 32, games: 384, depthLimit: 14,
    candidates: ['L','P'], controlsMs: [80,300], startOccupied: [12,13],
    order: 'family index ascending, alternate candidate order and first color by family; each budget uses disjoint families',
    warmup: 'identical disclosed roots and fixed-depth calls for each evaluator before each comparison pair',
    competingScientificWorkers: 0, positionalGate: null },
  independence: { boundary: 12, identity: 'SHA256(canonical(board,actualTurn)); D4 and simultaneous color/turn exchange',
    directAdmission: 'check both turns conservatively; prohibit historical roots, scored nonterminal children and frontier decision states',
    family: 'shared ancestry at or beyond occupied 12 merges families; require 96 independent game families',
    pv: 'seal labels until full returned PV legality and role-aware overlap audit; internal overlap reported',
    terminal: 'report convergence; do not claim universal state novelty',
    forbiddenLeak: 'retain source/outcome; block affected independent claim; no replacement',
    missingInventory: 'block independent launch', unusedHistoricalReservations: 'excluded' },
  statistics: { bootstrapReps: 10000, seed: 2026102917, gameUnit: 'complete color-swapped family pair',
    rootUnit: 'whole source, stratified over the original 16 cells',
    primary: ['L-B/80','P-B/80'], oneSidedAlphaEach: .025,
    approximate: 'paired mean Student t intervals; one-sided .025 each at 80ms; two-sided 95% descriptive intervals',
    bootstrap: 'joint family resamples across candidates; sensitivity only; source resamples shared across contrasts',
    conservative: 'mean - sqrt(log(1/.025)/(2*n)); bounded pair scores [0,1]',
    nomination: { min80: .55, min300: .50, tie: 'larger 80ms mean, exact tie favors L', production: 'B' },
    otherContrasts: 'descriptive; no additional unadjusted superiority claims' },
  resources: { scientificCapMs: 4*3600000, allowance: 1.35, reportingReserveMs: 15*60000,
    maxWorkers: 6, reserveGiB: 1.5, queryCapMs: 180000,
    forecast: 'complete stages, measured cell tails, rejection costs and game overhead; no automatic sample reduction' },
  stopping: ['correctness','provenance','resource','execution-integrity'],
  training: false, promotion: false,
});
export function assessmentSlots() {
  return Array.from({length:128}, (_,i) => {
    const cell=i%16, cycle=Math.floor(i/16), parity=(cycle+cell)%2;
    return { role:'assessment', slot:i, cell, phase:Math.floor(cell/4),
      policy:PROTOCOL.assessment.policies[Math.floor(cell/2)%2], depth:[4,6][cell%2], parity, player:parity?-1:1,
      diagnostic:cycle<2 };
  });
}
export function gameSchedule() {
  const rows=[];
  for(let family=0;family<96;family++) {
    const timeMs=family<64?80:300, candidates=family%2?['P','L']:['L','P'];
    for(const candidate of candidates) for(const color of (family%2?[-1,1]:[1,-1]))
      rows.push({family,candidate,color,timeMs,occupied:12+family%2,
        policy:PROTOCOL.assessment.policies[Math.floor(family/2)%2]});
  }
  return rows;
}
