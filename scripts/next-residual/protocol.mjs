import { hash } from '../teacher/qualification-core.mjs';
export { hash };
export const PROTOCOL=Object.freeze({
  version:1,namespace:'residual-constraint-pattern-screen-v1-20261029',
  phases:{opening:[4,27],middle:[28,51],endgame:[52,64]},
  strata:[[12,19],[20,35],[36,47],[48,55]],policies:['B1-12%','B4-2%'],depths:[4,6],
  commonPrefixBoundary:12,temperature:10,correctionBound:100,lambdas:[0],patternLambdas:[0,1e-6,1e-5],patternBound:25,
  optimization:{maxIterations:20000,gradientTolerance:1e-8,armijo:1e-4,initialStep:1,backtracking:.5,minStep:1e-14,momentFloor:.01},
  patternOptimization:{maxIterations:20000,gradientTolerance:1e-8,history:12,armijo:1e-4,minStep:1e-14},
  pattern:{templates:[{name:'corner6',squares:[0,1,2,8,9,16]},{name:'edge8',squares:[0,1,2,3,4,5,6,7]}],
    normalization:1/8,color:'independent reverse-color pairs; complement center fixed zero',symmetry:'all eight D4 transforms including repetitions',
    initialization:'zero',penalty:'lambda times sum of squares of independent color-pair coefficients'},
  learningCurve:[400,800,1600],patternQualificationMs:600000,
  admission:{relativeLossOverL:.05,maxRegretIncrease:0,minZeroSearchThroughputRatio:.90},
  assessment:{teacherDepths:[10,12],selectors:['B','L'],searchDepths:[4,6],bootstrap:10000,lowerQuantile:.025,
    preferenceGate:.05,rootRegretIncrease:0,sourceNormalization:'unit preference mass per informative trajectory in each selector panel',
    independence:'joint whole-source stratified resamples across panels; exclude all historical roles and audit newly revealed PVs'},
  designs:{expanded:{sources:256,transfer:128,primaryPairs:256,shadowPairs:128},fallback:{sources:192,transfer:96,primaryPairs:128,shadowPairs:64}},
  games:{timeMs:[80,300],depthLimit:14,bootstrap:10000,lowerQuantile:.025,
    claim:'one-sided 97.5 percent paired-opening lower score bound above .5 at BOTH primary controls',
    order:'by opening; alternate control order and first color; optional shadow after both primary conditions',
    collisions:'retain outcomes, block strength claim; never replace openings'},
  maxAttempts:100000,queryCapMs:180000,workerTaskCapMs:180000,
  experimentCapMs:8*3600000,allowance:1.35,reportingReserveMs:20*60000,sessionDrainReserveMs:5*60000,
});
export function slots(role,n) {
  if(role==='games')return Array.from({length:n},(_,i)=>({role,slot:i,phase:0,policy:PROTOCOL.policies[i%2],depth:4,occupied:12+i%2,parity:i%2,player:i%2?-1:1}));
  if(n%16)throw Error('Unbalanced source target');
  return Array.from({length:n},(_,i)=>{const cell=i%16,cycle=Math.floor(i/16),parity=(cycle+cell)%2;
    return {role,slot:i,phase:Math.floor(cell/4),policy:PROTOCOL.policies[Math.floor(cell/2)%2],depth:PROTOCOL.depths[cell%2],parity,player:parity?-1:1};});
}
export function transferIds(roots,n) {
  if(n%16)throw Error('Unbalanced transfer target');
  const ids=[];
  for(let phase=0;phase<4;phase++)for(const policy of PROTOCOL.policies)for(const depth of PROTOCOL.depths)
    ids.push(...roots.filter(r=>r.phase===phase&&r.policy===policy&&r.depth===depth).slice(0,n/16).map(r=>r.id));
  if(ids.length!==n)throw Error('Incomplete transfer subset');return ids;
}
