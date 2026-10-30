import {studentCDF,studentCritical,pairSummary} from '../frozen-player/statistics.mjs';
import {seededRandom} from '../../src/learning.js';
import {PROTOCOL} from './protocol.mjs';
export const mean=x=>x.reduce((s,v)=>s+v,0)/x.length;
export function quantile(x,p){const a=[...x].sort((a,b)=>a-b),q=(a.length-1)*p,l=Math.floor(q);return a[l]+(a[Math.ceil(q)]-a[l])*(q-l);}
export function moments(x){const n=x.length,m=mean(x),variance=x.reduce((s,v)=>s+(v-m)**2,0)/(n-1),se=Math.sqrt(variance/n),radius=studentCritical(n-1)*se;
 return {n,mean:m,variance,sd:Math.sqrt(variance),standardError:se,interval95:[m-radius,m+radius],standardizedEffect:variance?(m/Math.sqrt(variance)):null};}
export function bootstrap(rows,columns,{reps=PROTOCOL.bootstrapReps,seed=PROTOCOL.bootstrapSeed}={}){
 if(new Set(rows.map(r=>r.family)).size!==rows.length)throw Error('Duplicate families');
 if(rows.length<2||rows.some(r=>columns.some(c=>!Number.isFinite(r[c]))))throw Error('Invalid bootstrap panel');
 const rng=seededRandom(seed),draws=Object.fromEntries(columns.map(c=>[c,[]]));
 for(let b=0;b<reps;b++){const sums=columns.map(()=>0);for(let j=0;j<rows.length;j++){const row=rows[Math.floor(rng()*rows.length)];columns.forEach((c,k)=>sums[k]+=row[c]);}columns.forEach((c,k)=>draws[c].push(sums[k]/rows.length));}
 return Object.fromEntries(columns.map(c=>[c,{interval95:[quantile(draws[c],.025),quantile(draws[c],.975)],distinct:new Set(draws[c]).size,reps,seed}]));
}
export function inference(pairRows){const scores={},sensitivity={};
 for(const budget of [80,300]){const rows=pairRows.filter(r=>r.timeMs===budget);if(rows.length!==(budget===80?768:256))throw Error('Incomplete fixed sample');
  const x=rows.map(r=>r.score),s=pairSummary(x);scores[budget]={...s,variance:s.sd**2,effect:s.mean-.5,standardizedEffect:s.sd?(s.mean-.5)/s.sd:null,
   bonferroniP:s.approximateOneSidedP===null?null:Math.min(1,2*s.approximateOneSidedP)};
  sensitivity[budget]=bootstrap(rows,['score'],{seed:PROTOCOL.bootstrapSeed+budget}).score;
 }
 const matched=pairRows.filter(r=>r.timeMs===300).map(r=>{const a=pairRows.find(x=>x.timeMs===80&&x.family===r.family);return {family:r.family,short:a.score,long:r.score,difference:r.score-a.score};});
 const difference={...moments(matched.map(r=>r.difference)),bootstrap:bootstrap(matched,['short','long','difference']),rows:matched,method:'Descriptive paired 300-minus-80 on the fixed 256 families; budgets jointly resampled; no independent-budget variance formula'};
 const conventional=[80,300].every(b=>scores[b].approximateOneSided975Lower>.5),bootstrapSupport=[80,300].every(b=>sensitivity[b].interval95[0]>.5),bounded=[80,300].every(b=>scores[b].conservativeOneSided975Lower>.5);
 return {scores,sensitivity,difference,conventional,bootstrapSupport,bounded,alphaEach:.025,familywiseAlpha:.05};
}
