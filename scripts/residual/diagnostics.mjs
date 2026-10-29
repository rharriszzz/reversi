import { dot, objective, normalizePairs, zero, PHASES, FEATURES, weightsFor } from './model.mjs';
import { quantile, mean } from '../teacher/qualification-core.mjs';
import { PROTOCOL } from './protocol.mjs';
import { seededRandom } from '../../src/learning.js';
export function lossSummary(groups,delta) {
  const pairs=normalizePairs(groups);
  const summary=rows=>({sources:rows.length,informative:rows.filter(r=>r.pairs.length).length,
    preferences:rows.reduce((s,r)=>s+r.pairs.length,0),loss:rows.some(r=>r.pairs.length)?objective(delta,normalizePairs(rows)).loss:null});
  const groupBy=key=>Object.fromEntries([...new Set(groups.map(g=>g[key]))].map(k=>[k,summary(groups.filter(g=>g[key]===k))]));
  const byChildPhase=Object.fromEntries(PHASES.map(phase=>[phase,summary(groups.map(g=>({...g,pairs:g.pairs.filter(p=>{
    const occupied=g.parents.find(parent=>parent.index===p.parent).occupied+1;
    return (occupied<28?'opening':occupied<52?'middle':'endgame')===phase;
  })})).filter(g=>g.pairs.length))]));
  const incorrect=pairs.filter(p=>p.base+dot(p.x,delta)<=0).reduce((s,p)=>s+p.weight,0);
  return {...summary(groups),weightedIncorrect:incorrect,byPhase:groupBy('phase'),byChildPhase,byPolicy:groupBy('policy'),byDepth:groupBy('depth')};
}
export function frontierDecisions(root,frontier,labels,delta) {
  const result=[];
  for(const [i,p] of frontier.parents.entries()) {
    const scores=p.children.map(c=>({move:c.move,b:c.base,candidate:c.base+dot(c.x,delta),phase:c.phase,terminal:c.terminal}));
    const choose=key=>[...scores].sort((a,b)=>b[key]-a[key]||a.move-b.move)[0].move;
    const b=choose('b'),candidate=choose('candidate'),h=new Map(labels[i][10].rows.map(r=>[r.move,r.value])),r=new Map(labels[i][12].rows.map(r=>[r.move,r.value]));
    const best=Math.max(...r.values()),bg=best-r.get(b),cg=best-r.get(candidate);
    const independent=labels[i].independent;
    const exact=independent?Object.fromEntries(['raw','awarded'].map(convention=>{
      const reference=independent[convention],value=move=>reference.rows.find(r=>r.move===move).value;
      return [convention,{best:reference.value,bValue:value(b),candidateValue:value(candidate),
        bWdlError:Math.sign(value(b))<Math.sign(reference.value),candidateWdlError:Math.sign(value(candidate))<Math.sign(reference.value)}];
    })):null;
    result.push({source:root.id,sourcePhase:root.phase,childPhase:p.children[0]?.phase,policy:root.policy,depth:root.depth,parent:i,occupied:p.occupied,player:p.player,exact,
      b,candidate,disagreement:b!==candidate,bRegret:bg,candidateRegret:cg,improvement:bg-cg,
      reversal:h.get(candidate)-h.get(b)>=4&&r.get(candidate)-r.get(b)<=-4,
      significantChange:Math.abs(r.get(candidate)-r.get(b))>=4,
      estimatedSignChange:Math.sign(r.get(candidate))!==Math.sign(r.get(b)),scores});
  }
  return result;
}
export function summarizeDecisions(rows) {
  const summary=xs=>({parents:xs.length,sources:new Set(xs.map(x=>x.source)).size,
    // Average within a source first; sources with two parents have no extra mass.
    bRegret:sourceMean(xs,'bRegret'),candidateRegret:sourceMean(xs,'candidateRegret'),improvement:sourceMean(xs,'improvement'),
    disagreements:xs.filter(x=>x.disagreement).length,significantChanges:xs.filter(x=>x.significantChange).length,reversals:xs.filter(x=>x.reversal).length});
  const groupBy=key=>Object.fromEntries([...new Set(rows.map(g=>g[key]))].map(k=>[k,summary(rows.filter(g=>g[key]===k))]));
  return {...summary(rows),byPhase:groupBy('sourcePhase'),byChildPhase:groupBy('childPhase'),byPolicy:groupBy('policy'),byDepth:groupBy('depth'),
    exact:{parents:rows.filter(r=>r.exact).length,BWdlErrors:rows.filter(r=>r.exact?.awarded.bWdlError).length,candidateWdlErrors:rows.filter(r=>r.exact?.awarded.candidateWdlError).length}};
}
const sourceMean=(rows,key)=>mean([...new Set(rows.map(r=>r.source))].map(id=>mean(rows.filter(r=>r.source===id).map(r=>r[key]))));
export function corrections(delta) {
  const updated=weightsFor(delta),base=weightsFor(zero());
  return PHASES.flatMap((phase,i)=>FEATURES.map((feature,j)=>({phase,feature,original:base[phase][feature],correction:delta[i*7+j],new:updated[phase][feature]})));
}
export function forecast(pilot,resources,elapsedMs=0,{reserved=[],labeled=[],gamePairs={}}={}) {
  const cell=r=>`${r.phase}/${r.policy}/${r.depth}`,cells={};
  for(const row of pilot.costs) (cells[cell(row)]??=[]).push(row);
  const stages={generation:0,reconstruction:0,teacher10:0,teacher12:0,rootTransfer:0,optimization:0,games80:0,games300:0,auditCheckpointRecovery:0};
  const admissionFactor=pilot.attempts/(pilot.roots??pilot.costs.length);
  for(let phase=0;phase<4;phase++)for(const policy of PROTOCOL.policies)for(const depth of PROTOCOL.depths) {
    const rows=cells[`${phase}/${policy}/${depth}`];if(!rows?.length)throw Error('Pilot missing forecast cell');
    // Max of tiny per-cell pilot, inflated by measured rejection work. No mean-only forecast.
    const max=key=>Math.max(...rows.map(r=>r[key]));
    const n=100+25+25,belongs=r=>r.phase===phase&&r.policy===policy&&r.depth===depth&&['training','development','assessment'].includes(r.role);
    const remainingSources=n-reserved.filter(belongs).length,remainingLabels=n-labeled.filter(belongs).length;
    stages.generation+=remainingSources*max('generationMs')*admissionFactor;
    stages.reconstruction+=remainingSources*max('frontierMs');
    stages.teacher10+=remainingLabels*max('teacher10Ms');stages.teacher12+=remainingLabels*max('teacher12Ms');
  }
  stages.generation+=(256-reserved.filter(r=>r.role==='games').length)*Math.max(...pilot.costs.filter(r=>r.phase===0).map(r=>r.generationMs))*admissionFactor;
  const speedup=Math.max(1,Math.min(resources.effectiveWorkers??resources.workers??1,
    ...Object.values(pilot.scaling??{}).map(x=>x.safeSpeedup??1)));
  // Full root alternatives generally branch more than frontier parents: require actual pilot root labels.
  stages.rootTransfer=128*Math.max(...pilot.rootLabelCosts)+(128*4+32*7)*Math.max(...pilot.costs.map(r=>r.frontierMs));
  stages.optimization=Math.max(60000,pilot.fitWallMs*1600/12*8);
  stages.games80=(256-(gamePairs[80]??0))*Math.max(...pilot.gameCosts.filter(x=>x.timeMs===80).map(x=>x.wallMs));
  stages.games300=(256-(gamePairs[300]??0))*Math.max(...pilot.gameCosts.filter(x=>x.timeMs===300).map(x=>x.wallMs));
  stages.auditCheckpointRecovery=Math.max(5*60000,.1*Object.values(stages).reduce((a,b)=>a+b,0));
  const parallelizable=stages.generation+stages.reconstruction+stages.teacher10+stages.teacher12+stages.rootTransfer;
  const serial=Object.values(stages).reduce((a,b)=>a+b,0)-parallelizable;
  const rawMs=parallelizable/speedup+serial,conservativeMs=PROTOCOL.allowance*rawMs+PROTOCOL.reportingReserveMs;
  return {stages,speedup,rawMs,allowance:PROTOCOL.allowance,reportReserveMs:PROTOCOL.reportingReserveMs,conservativeMs,
    elapsedMs,totalProjectedMs:elapsedMs+conservativeMs,feasible:elapsedMs+conservativeMs<=PROTOCOL.experimentCapMs,
    resources,method:PROTOCOL.forecast,warning:'24-root pilot has sparse tails; cell maxima and rejection inflation are conservative measurements, not guaranteed bounds'};
}

export function bootstrapSources(rows,value,{seed=2026102847,reps=10000}={}) {
  const strata=[...new Set(rows.map(r=>`${r.phase}/${r.policy}/${r.depth}`))]
    .map(key=>rows.filter(r=>`${r.phase}/${r.policy}/${r.depth}`===key));
  const random=seededRandom(seed),samples=[];
  for(let i=0;i<reps;i++) {
    const sampled=strata.flatMap(group=>group.map(()=>group[Math.floor(random()*group.length)]));
    const xs=sampled.map(value).filter(x=>x!==null&&Number.isFinite(x));samples.push(mean(xs));
  }
  return {n:rows.length,mean:mean(rows.map(value).filter(x=>x!==null)),interval95:[quantile(samples,.025),quantile(samples,.975)],
    interpretation:'sampling uncertainty conditional on admitted source distribution; excludes systematic teacher bias'};
}
export function positionalGate(BLoss,candidateLoss,rootRows) {
  const rows=rootRows.filter(r=>r.depth===6);
  return {complete:rootRows.length===256&&rows.length===128,
    preference:BLoss>0&&(BLoss-candidateLoss)/BLoss>=PROTOCOL.gates.relativePreferenceImprovement,
    root:rows.length===128&&mean(rows.map(r=>r.candidateRegret))<=mean(rows.map(r=>r.bRegret)),
    relativePreferenceImprovement:BLoss>0?(BLoss-candidateLoss)/BLoss:null,
    rootMeanChange:mean(rows.map(r=>r.candidateRegret-r.bRegret))};
}
