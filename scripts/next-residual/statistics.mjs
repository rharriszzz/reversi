import { seededRandom } from '../../src/learning.js';
import { mean,quantile } from '../teacher/qualification-core.mjs';
import { PROTOCOL } from './protocol.mjs';
// All selector and model contrasts use exactly the same trajectory resamples.
export function jointBootstrap(rows,keys,{reps=10000,seed=2026102907}={}) {
  const cells=[...new Set(rows.map(r=>`${r.phase}/${r.policy}/${r.depth}`))].map(k=>rows.filter(r=>`${r.phase}/${r.policy}/${r.depth}`===k));
  const random=seededRandom(seed),samples=Object.fromEntries(keys.map(k=>[k,[]]));
  for(let r=0;r<reps;r++){
    const sums=Object.fromEntries(keys.map(k=>[k,{sum:0,n:0}]));
    for(const cell of cells)for(let i=0;i<cell.length;i++){
      const row=cell[Math.floor(random()*cell.length)];
      for(const k of keys)if(row[k]!==null&&Number.isFinite(row[k])){sums[k].sum+=row[k];sums[k].n++;}
    }
    for(const k of keys)samples[k].push(sums[k].n?sums[k].sum/sums[k].n:null);
  }
  return Object.fromEntries(keys.map(k=>{const xs=samples[k].filter(v=>v!==null);return [k,{n:rows.filter(r=>r[k]!==null&&Number.isFinite(r[k])).length,
    mean:mean(rows.map(r=>r[k]).filter(v=>v!==null&&Number.isFinite(v))),lower975:quantile(xs,.025),interval95:[quantile(xs,.025),quantile(xs,.975)],
    method:'10000 whole-source stratified paired resamples, shared across panels/model contrasts; conditional on source admission and teacher'}];}));
}
export function positionalGate(panels,rootRows,design,candidate='L',reference='B',independence=true) {
  const six=rootRows.filter(r=>r.searchDepth===6),complete=six.length===design.transfer&&rootRows.length===design.transfer*2&&Object.values(panels).every(p=>p.sources===design.sources);
  const preferences=Object.fromEntries(['B','L'].map(selector=>{
    const p=panels[selector],relative=(p.loss[reference]-p.loss[candidate])/p.loss[reference];
    const interval=p.intervals[`${candidate}-${reference}`];return [selector,{relative,lowerImprovement:interval.lower975,pass:relative>=.05&&interval.lower975>0}];
  }));
  const rootChange=mean(six.map(r=>r.regret[candidate]-r.regret[reference]));
  const againstB=mean(six.map(r=>r.regret[candidate]-r.regret.B));
  const root=six.length===design.transfer&&rootChange<=0&&(candidate!=='P'||againstB<=0);
  return {complete,independence,preferences,rootChange,rootChangeAgainstB:againstB,root,pass:complete&&independence&&root&&Object.values(preferences).every(p=>p.pass)};
}
