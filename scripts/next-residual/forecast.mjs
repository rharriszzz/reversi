import { PROTOCOL } from './protocol.mjs';
export function forecast(design,pilot,oldCost,fitMs,actualWorkers,speedup=1,{elapsedMs=0,reservedAssessment=0,reservedGames=0,labeledSources=0,completedRoots=0,completedPairs={}}={}) {
  const cells=oldCost.cellMaxima,rejection=Math.max(oldCost.admissionAttemptFactor,pilot.admissionFactor??0),n=design.sources/16,t=design.transfer/16;
  let generation=0,collectors=0,labels=0,rootLabels=0,rootSearches=0;
  for(const [key,c] of Object.entries(cells)) {
    const rows=pilot.roots.filter(r=>`${r.phase}/${r.policy}/${r.depth}`===key);if(!rows.length)throw Error('Missing pilot cost cell');
    const max=field=>Math.max(...rows.map(r=>r[field]));
    generation+=n*c.generation*rejection;
    collectors+=n*Math.max(c.frontier*3,max('frontierMs'));
    labels+=n*Math.max(c.labels*2,max('labelMs'));
    rootLabels+=t*Math.max(c.rootLabels,max('rootLabelMs'));
    rootSearches+=t*Math.max((c.root4+c.root6)*3*2,...rows.map(r=>r.searches.reduce((s,x)=>s+x.wallMs,0)*2));
  }
  const openings=design.primaryPairs+design.shadowPairs;
  generation*=Math.max(0,design.sources-reservedAssessment)/design.sources;
  generation+=(openings-reservedGames)*Math.max(...Object.entries(cells).filter(([key])=>key.startsWith('0/')).map(([,c])=>c.generation))*rejection;
  collectors*=Math.max(0,design.sources-reservedAssessment)/design.sources;
  labels*=Math.max(0,design.sources-labeledSources)/design.sources;
  rootLabels*=Math.max(0,design.transfer-completedRoots)/design.transfer;
  rootSearches*=Math.max(0,design.transfer-completedRoots)/design.transfer;
  const pair80=Math.max(oldCost.pair80MaxMs,104*80,...pilot.gameCosts.filter(x=>x.timeMs===80).map(x=>x.wallMs));
  const pair300=Math.max(oldCost.pair300MaxMs,104*300,...pilot.gameCosts.filter(x=>x.timeMs===300).map(x=>x.wallMs));
  const games80=(design.primaryPairs-(completedPairs.L80??0))*pair80,
    games300=(design.primaryPairs-(completedPairs.L300??0))*pair300,shadow=(design.shadowPairs-(completedPairs.P80??0))*pair80;
  const parallel={generation,collectors,labels,rootLabels,rootSearches};
  const serial={fitting:fitMs,games80,games300,shadow,statisticsAudit:5*60000};
  const measuredSpeedup=Math.min(actualWorkers,Math.max(1,speedup));
  const rawMs=Object.values(parallel).reduce((a,b)=>a+b,0)/measuredSpeedup+Object.values(serial).reduce((a,b)=>a+b,0);
  const totalMs=elapsedMs+rawMs*1.35+PROTOCOL.reportingReserveMs;
  return {design,actualWorkers,measuredSpeedup,parallel,serial,pair80,pair300,rejection,rawMs,elapsedMs,allowance:1.35,
    reportingReserveMs:PROTOCOL.reportingReserveMs,totalMs,feasible:totalMs<=PROTOCOL.experimentCapMs,
    comfortable:totalMs<=PROTOCOL.experimentCapMs-30*60000,
    method:'Max historical cell tails and measured complete changed-model pilot costs; measured actual-pool speedup only; all eligible games reserved; 35% allowance on all raw cost plus separate 20-minute reporting and 30-minute feasibility headroom.'};
}
