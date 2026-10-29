// Descriptive TRAINING data only. Never an assessment or selection criterion.
import { existsSync } from 'node:fs';
import { read } from '../research/io.mjs';
import { mean } from '../teacher/qualification-core.mjs';
export function trainingSummary(output) {
  const reservation=read(`${output}/reservations.json`),rows=[];
  for(const root of reservation.roles.training) {
    const path=`${output}/preferences/${root.id}.json`;if(!existsSync(path))continue;
    const frontier=read(`${output}/frontiers/${root.id}.json`).result;
    for(const [index,parent] of frontier.parents.entries()) {
      const h=read(`${output}/tasks/label-${root.id}-p${index}-d10.json`).result.rows,
        r=read(`${output}/tasks/label-${root.id}-p${index}-d12.json`).result.rows;
      const value=(xs,move)=>xs.find(row=>row.move===move).value;
      const chosen=[...h].sort((a,b)=>b.value-a.value||a.move-b.move)[0].move,
        best=Math.max(...r.map(row=>row.value)),b=parent.bChoice;
      const exactPath=`${output}/tasks/exact-${root.id}-p${index}.json`,exact=existsSync(exactPath)?read(exactPath).result:null;
      rows.push({source:root.id,stratum:root.phase,phase:parent.children[0].phase,policy:root.policy,depth:root.depth,
        regret:best-value(r,b),useful:value(h,chosen)-value(h,b)>=2&&value(r,chosen)-value(r,b)>=2&&best-value(r,chosen)<=2,
        exact:exact?{rawRegret:exact.raw.value-value(exact.raw.rows,b),awardedRegret:exact.awarded.value-value(exact.awarded.rows,b),
          rawWdlError:Math.sign(value(exact.raw.rows,b))<Math.sign(exact.raw.value),awardedWdlError:Math.sign(value(exact.awarded.rows,b))<Math.sign(exact.awarded.value)}:null});
    }
  }
  const summary=xs=>{
    const sources=[...new Set(xs.map(row=>row.source))],exact=xs.filter(row=>row.exact);
    return {parents:xs.length,sources:sources.length,
      sourceMeanD12Regret:mean(sources.map(source=>mean(xs.filter(row=>row.source===source).map(row=>row.regret)))),
      optimalChoices:xs.filter(row=>row.regret===0).length,regretAtLeast4:xs.filter(row=>row.regret>=4).length,
      usefulParents:xs.filter(row=>row.useful).length,usefulSources:new Set(xs.filter(row=>row.useful).map(row=>row.source)).size,
      exactParents:exact.length,exactSources:new Set(exact.map(row=>row.source)).size,
      exactRawWdlErrors:exact.filter(row=>row.exact.rawWdlError).length,exactAwardedWdlErrors:exact.filter(row=>row.exact.awardedWdlError).length};
  };
  const groupBy=key=>Object.fromEntries([...new Set(rows.map(row=>row[key]))].map(value=>[value,summary(rows.filter(row=>row[key]===value))]));
  return {...summary(rows),byChildPhase:groupBy('phase'),byStratum:groupBy('stratum'),byPolicy:groupBy('policy'),bySearchDepth:groupBy('depth'),
    interpretation:'Descriptive training frontier choices only; D12 regret is estimated discs except independently solved parents. These are not fresh root-choice transfer results or evidence of learned playing strength.'};
}
