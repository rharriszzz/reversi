import { seededRandom } from '../../src/learning.js';
import { mean,quantile } from '../teacher/qualification-core.mjs';
import { PROTOCOL } from './protocol.mjs';
// Integrate the Student density after t=sqrt(df)*tan(theta). Integer df
// permits a stable cos-power recurrence, without an external statistics package.
function cosIntegral(power,x) {
  let even=x,odd=Math.sin(x);
  if(power===0)return even;if(power===1)return odd;
  for(let n=2;n<=power;n++) {
    const value=Math.sin(x)*Math.cos(x)**(n-1)/n+(n-1)/n*(n%2?odd:even);
    if(n%2)odd=value;else even=value;
  }
  return power%2?odd:even;
}
export function studentCDF(t,df) {
  if(!Number.isInteger(df)||df<1)throw Error('Positive integer degrees of freedom required');
  if(t<0)return 1-studentCDF(-t,df);
  return .5+.5*cosIntegral(df-1,Math.atan(t/Math.sqrt(df)))/cosIntegral(df-1,Math.PI/2);
}
export function studentCritical(df,p=.975) {
  let lo=0,hi=1;while(studentCDF(hi,df)<p)hi*=2;
  for(let i=0;i<70;i++){const mid=(lo+hi)/2;if(studentCDF(mid,df)<p)lo=mid;else hi=mid;}
  return (lo+hi)/2;
}
export function pairSummary(xs) {
  if(xs.length<2||xs.some(x=>!Number.isFinite(x)||x<0||x>1))throw Error('Invalid bounded opening-pair scores');
  const n=xs.length,average=mean(xs),variance=xs.reduce((s,x)=>s+(x-average)**2,0)/(n-1),se=Math.sqrt(variance/n);
  const radius=studentCritical(n-1)*se,hoeffdingRadius=Math.sqrt(Math.log(1/.025)/(2*n));
  return {n,mean:average,sd:Math.sqrt(variance),standardError:se,
    approximate95:[Math.max(0,average-radius),Math.min(1,average+radius)],
    approximateOneSidedP:se?1-studentCDF((average-.5)/se,n-1):null,
    approximateOneSided975Lower:Math.max(0,average-radius),
    hoeffdingRadius,conservativeOneSided975Lower:Math.max(0,average-hoeffdingRadius),
    method:'Complete opening-pair means; approximate Student t; one-sided alpha .025 per primary comparison. Zero sample variance does not prove a constant population; see bounded inference.'};
}
export function jointGameBootstrap(rows,{reps=PROTOCOL.statistics.bootstrapReps,seed=PROTOCOL.statistics.seed}={}) {
  if(new Set(rows.map(r=>r.family)).size!==rows.length)throw Error('Related or duplicate families must be merged before analysis');
  pairSummary(rows.map(r=>r.L));pairSummary(rows.map(r=>r.P));
  const random=seededRandom(seed),samples={L:[],P:[],indirectPminusL:[]};
  for(let b=0;b<reps;b++) {
    let l=0,p=0;for(let i=0;i<rows.length;i++){const r=rows[Math.floor(random()*rows.length)];l+=r.L;p+=r.P;}
    samples.L.push(l/rows.length);samples.P.push(p/rows.length);samples.indirectPminusL.push((p-l)/rows.length);
  }
  return Object.fromEntries(Object.entries(samples).map(([key,x])=>[key,{interval95:[quantile(x,.025),quantile(x,.975)],
    distinctResampledMeans:new Set(x).size,reps,seed,method:'Shared whole-family percentile bootstrap sensitivity; indirect P-L is not a direct match'}]));
}
export function nomination(scores80,scores300) {
  if(['L','P'].some(c=>scores80[c].n!==64||scores300[c].n!==32))throw Error('Nomination requires complete fixed schedule');
  const candidates=['L','P'].filter(c=>scores80[c].mean>=.55&&scores300[c].mean>=.5);
  candidates.sort((a,b)=>scores80[b].mean-scores80[a].mean||a.localeCompare(b));
  return {candidate:candidates[0]??null,developmentDecisionOnly:true,production:'B'};
}
