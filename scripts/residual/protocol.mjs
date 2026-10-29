// Scientific choices are fixed before any residual labels or model outcomes.
import { hash } from '../teacher/qualification-core.mjs';
export { hash };
export const PROTOCOL = Object.freeze({
  version: 1, namespace: 'residual-frontier-v1-20261028',
  model: 'B plus 21 bounded original-weight corrections',
  phases: { opening: [4,27], middle: [28,51], endgame: [52,64] },
  strata: [[12,19],[20,35],[36,47],[48,55]],
  policies: ['B1-12%','B4-2%'], depths: [4,6],
  targets: { pilot:24, training:1600, development:400, assessment:400, games:256 },
  rootTransfer: { n:128, depths:[4,6], teacherDepths:[10,12] },
  teacherDepths: [10,12], teacherInterface:'edax-fixed-window-v2',
  temperature:10, lambdas:[.0001,.001,.01], correctionBound:25,
  optimization:{ maxIterations:20000, gradientTolerance:1e-8, armijo:1e-4,
    initialStep:1, backtracking:.5, minStep:1e-14, momentFloor:.01 },
  preference:{ minGap:2, nearBest:2, gapCap:4,
    competitive:'at least one endpoint within two of best at either horizon, or B choice',
    normalization:'unit total pair weight per informative independent trajectory; mean over informative trajectories',
    terminal:'terminal children fixed production utility; exact raw/awarded WDL reported separately' },
  selection:'minimum development unregularized trajectory-mean loss including zero B; ties within 1e-12 favor smaller correction norm',
  gates:{ relativePreferenceImprovement:.05, rootRegretIncrease:0 },
  games:{ openings:256, timeMs:[80,300], colors:2, bootstrap:10000,
    lowerQuantile:.025, simultaneous:'two one-sided 97.5% pair-bootstrap lower bounds above .5',
    order:'alternate candidate first color by opening; both budgets per opening',
    depthLimit:14 },
  learningCurve:[100,200,400,800,1600],
  diagnostics:{ featureAblations:'seven leave-one-feature-out corrections across all phases; no refit',
    rootAblationSubset:'every fourth member of fixed 128 transfer IDs; depth six',
    exact:'independent raw/awarded solver when at most ten empties; never infer exact early values',
    uncertainty:'10000 complete-source stratified bootstrap resamples by stratum/policy/search depth',
    rootGate:'no mean D12 regret increase at depth six; depth four reported separately' },
  commonPrefixBoundary:12, maxAttempts:100000,
  pilotSchedule:'one per 16 stratum/policy/depth cells plus eight complementary parity/turn cells; no assessment access',
  balance:'exact stratum/policy/depth totals; within each cell occupied parity and turn counts differ by at most one',
  trajectory:'random before occupied 12; thereafter B1/12% or B4/2%; complete to terminal',
  tie:'row-major for full-window research alternatives; unchanged production search ties in timed play',
  queryCapMs:180000, workerTaskCapMs:180000, experimentCapMs:8*3600000,
  allowance:1.35, reportingReserveMs:20*60000, sessionDrainReserveMs:5*60000,
  forecast:'sum cell-specific pilot maxima; no assumed parallel speedup above measured lower bound; full games use max measured pair cost per budget',
  locked:'first session never queries assessment root/frontier or plays confirmation games',
});

export function slots(role, protocol=PROTOCOL) {
  const n=protocol.targets[role]; if(!n) throw Error('Unknown role');
  if(role==='games') return Array.from({length:n},(_,i)=>({role,slot:i,phase:0,
    policy:protocol.policies[i%2],depth:4,occupied:12+(i%2),parity:i%2,player:i%2?-1:1}));
  const rows=[];
  // Cycles interleave cells, so every deterministic training-size prefix is balanced.
  for(let cycle=0;rows.length<n;cycle++) for(let phase=0;phase<4;phase++)
    for(let policy=0;policy<2;policy++) for(let d=0;d<2;d++) {
      if(rows.length>=n) break;
      const cell=phase*4+policy*2+d;
      rows.push({role,slot:rows.length,phase,policy:protocol.policies[policy],depth:protocol.depths[d],
        parity:(cycle+cell)%2,player:(cycle+cell)%2?-1:1});
    }
  return rows;
}

export function transferIds(roots) {
  const result=[];
  for(let phase=0;phase<4;phase++) for(const policy of PROTOCOL.policies)
    for(const depth of PROTOCOL.depths) result.push(...roots.filter(s=>s.phase===phase&&s.policy===policy&&s.depth===depth).slice(0,8).map(s=>s.id));
  if(result.length!==128) throw Error('Incomplete transfer reservation');
  return result;
}
