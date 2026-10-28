// Development screening only. Accuracy tolerances are guard bands, not CIs.
export function shortlist(metrics,{limit=4,accuracySlack=.02,regretSlack=.5,speedRatio=1.15}={}) {
  const candidates=metrics.filter(m=>m.id!=='B'&&Number.isFinite(m.speed?.microseconds)&&Number.isFinite(m.ranking?.exact?.regret));
  const quality=m=>[m.ranking.exact.pairAccuracy??0,m.ranking.search.pairAccuracy??0];
  const dominates=(a,b)=>a.speed.microseconds<=b.speed.microseconds/speedRatio&&a.ranking.exact.regret<=b.ranking.exact.regret&&quality(a).every((v,i)=>v>=quality(b)[i])&&(a.ranking.exact.regret<b.ranking.exact.regret-regretSlack||quality(a).some((v,i)=>v>quality(b)[i]+accuracySlack)||a.speed.microseconds<b.speed.microseconds/2);
  const frontier=candidates.filter(b=>!candidates.some(a=>a!==b&&dominates(a,b)));
  const retained=[...frontier];
  // Always protect the fastest member and the best decision model per family.
  const families=[...new Set(candidates.map(m=>m.id.split('-')[0]))];
  for(const family of families) {
    const rows=candidates.filter(m=>m.id.startsWith(family+'-')).sort((a,b)=>a.ranking.exact.regret-b.ranking.exact.regret||a.speed.microseconds-b.speed.microseconds);
    if(rows[0]&&!retained.includes(rows[0])) retained.push(rows[0]);
  }
  retained.sort((a,b)=>a.speed.microseconds-b.speed.microseconds||a.id.localeCompare(b.id));
  const selected=[];
  const add=m=>{if(m&&!selected.includes(m)&&selected.length<limit) selected.push(m);};
  add(retained[0]);
  add([...retained].sort((a,b)=>a.ranking.exact.regret-b.ranking.exact.regret)[0]);
  for(const family of families) add(retained.find(m=>m.id.startsWith(family+'-')));
  for(const m of retained) add(m);
  return {ids:selected.map(m=>m.id),frontier:frontier.map(m=>m.id),retained:retained.map(m=>m.id),unplayed:retained.filter(m=>!selected.includes(m)).map(m=>m.id),rule:{accuracySlack,regretSlack,speedRatio,limit}};
}

// Based on slower pilot repetitions, including rejection allowance. No outcomes.
export function budgetPlan(budgetMs,elapsedMs,pairSamples,{targets={80:64,300:32,20:8},overhead=1.35,safetyMs=900000}={}) {
  const slower=Object.fromEntries(Object.entries(pairSamples).map(([k,v])=>[k,Math.max(...v)]));
  const fixed=Object.entries(targets).reduce((sum,[k,n])=>sum+n*slower[k],0);
  if(!Number.isFinite(fixed)||fixed<=0) throw new Error('Missing repeated pair measurements');
  const confirmationMs=fixed*overhead,selectionMs=8*((slower[80]??0)+(slower[300]??0)),auditMs=180000;
  const learningEnd=budgetMs-confirmationMs-selectionMs-auditMs-safetyMs;
  if(learningEnd<elapsedMs+60000) throw new Error('Fixed targets infeasible: reduce targets before confirmation or increase declared budget');
  return {targets,slower,overhead,confirmationMs,selectionMs,auditMs,safetyMs,learningEnd};
}
