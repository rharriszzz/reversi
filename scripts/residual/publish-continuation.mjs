#!/usr/bin/env node
// Read-only scientific audit, compact evidence and final report for the existing run.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { read, atomic } from '../research/io.mjs';
import { audit } from './audit.mjs';
import { workerHistory } from './worker-history.mjs';
import { hash, PROTOCOL } from './protocol.mjs';
import { bootstrapSources, summarizeDecisions, positionalGate } from './diagnostics.mjs';
import { compactSearchReceipt } from './planning-source.mjs';
const [directory,repository='.']=process.argv.slice(2),output=resolve(directory),root=resolve(repository);
const optional=name=>existsSync(`${output}/${name}.json`)?read(`${output}/${name}.json`):null;
const state=optional('manifest');
if(state.status==='running')throw Error('Publish only a clean checkpoint');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const preserved=optional('continuation-preserved-files');
let preservedFiles=0;
for(const [file,digest] of Object.entries(preserved)) {
  if(sha(readFileSync(`${output}/${file}`))!==digest)throw Error(`Previously completed evidence changed: ${file}`);
  preservedFiles++;
}
const checked=audit(output),fit=optional('fit-results'),assessment=optional('assessment-results'),confirmation=optional('confirmation-results');
let assessmentReferencesVerified=0;
if(assessment) {
  if(assessment.runIdentity!==state.runIdentity||assessment.modelChecksum!==fit.model.checksum
    ||hash(assessment.gates)!==hash(positionalGate(assessment.B.loss,assessment.candidate.loss,assessment.rootRows)))
    throw Error('Assessment model/gate identity mismatch');
  const reservation=optional('reservations'),expected=new Set(reservation.transferIds.flatMap(id=>[`${id}/4`,`${id}/6`]));
  for(const row of assessment.rootRows) {
    if(!expected.delete(`${row.source}/${row.depth}`))throw Error('Missing or repeated assessment source/depth');
    for(const which of ['B','candidate']) {
      const id=`search-${row.source}-${row.depth}-${which}`,receipt=read(`${output}/tasks/${id}.json`);
      if(hash(row.search[which])!==hash(compactSearchReceipt(receipt.result,id)))throw Error('Assessment search reference mismatch');
      if(row.search[which].rows[0].move!==row[which==='B'?'b':'candidate'])throw Error('Assessment chosen move mismatch');
    }
    const teacher=read(`${output}/tasks/transfer-${row.source}-d12.json`).result.rows;
    const best=Math.max(...teacher.map(r=>r.value)),regret=move=>best-teacher.find(r=>r.move===move).value;
    if(row.bRegret!==regret(row.b)||row.candidateRegret!==regret(row.candidate))throw Error('Assessment regret mismatch');
    assessmentReferencesVerified++;
  }
  if(expected.size)throw Error('Incomplete assessment reference coverage');
}
const amendment=optional('planning-amendment'),before=optional('continuation-forecast-before'),curve=optional('learning-curve');
const ceilingAmendment=optional(`amendments/${before.identity.planningAmendmentHash}`)??amendment;
const serializationInventory=optional('serialization-preserved-files');
let serializationPreserved=0;
for(const [file,digest] of Object.entries(serializationInventory??{})) {
  if(sha(readFileSync(`${output}/${file}`))!==digest)throw Error(`Recovery changed preserved evidence: ${file}`);
  serializationPreserved++;
}
const events=readFileSync(`${output}/events.jsonl`,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const samples=existsSync(`${output}/continuation-worker-samples.jsonl`)?readFileSync(`${output}/continuation-worker-samples.jsonl`,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const launches=state.sessions.filter(s=>s.mode==='continue'),start=launches[0]?.started;
const continuationEvents=events.filter(e=>start&&e.at>=start);
const serializationFailure=continuationEvents.find(e=>e.event==='failure'&&e.error?.startsWith('RangeError: Invalid string length'));
const collectionEvents=serializationFailure?continuationEvents.filter(e=>e.at<serializationFailure.at):continuationEvents;
const extraResourceSnapshots=['continuation-root-preflight','continuation-root-preflight-latest'].map(optional).filter(Boolean);
const resources=[...readFileSync(`${output}/resource-history.jsonl`,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse),
  ...extraResourceSnapshots].filter(r=>start&&r.at>=start);
const workerTimeline=workerHistory(output);
const throughput=Object.fromEntries(['development','assessment'].map(role=>{
  const stage=collectionEvents.find(e=>e.event==='stage'&&e.name===`label-${role}`);
  const done=collectionEvents.filter(e=>e.event==='source-labeled'&&e.stage===`label-${role}`);
  const last=done.at(-1),seconds=stage&&last?(Date.parse(last.at)-Date.parse(stage.at))/1000:null;
  return [role,{sources:last?.completed??0,wallSeconds:seconds,sourcesPerSecond:seconds?last.completed/seconds:null,
    note:'Original collection stage including resource checks and native queries; the recovery receipt replay is excluded.'}];
}));
const throughputByPool=[];
for(const role of ['development','assessment']) {
  const beginnings=collectionEvents.filter(e=>e.event==='stage'&&e.name===`label-${role}`);
  for(const beginning of beginnings) {
    const end=collectionEvents.find(e=>e.at>beginning.at&&e.event==='stage');
    const finish=end?.at??state.updated;
    const cuts=[{at:beginning.at,actualPool:workerTimeline.timeline.filter(r=>r.at<=beginning.at).at(-1)?.actualPool??2},
      ...workerTimeline.timeline.filter(r=>r.at>beginning.at&&r.at<finish),{at:finish}];
    for(let i=0;i<cuts.length-1;i++) {
      const seconds=(Date.parse(cuts[i+1].at)-Date.parse(cuts[i].at))/1000;
      const completed=collectionEvents.filter(e=>e.event==='source-labeled'&&e.stage===`label-${role}`&&e.at>=cuts[i].at&&e.at<cuts[i+1].at).length;
      throughputByPool.push({role,workers:cuts[i].actualPool,seconds,completed,sourcesPerSecond:seconds?completed/seconds:null});
    }
  }
}
const featureNames=fit?.corrections.slice(0,7).map(r=>r.feature)??[];
const a=assessment?{...assessment,
  rootRows:assessment.rootRows.map(({search,teacherValues,...row})=>({...row,BMove:row.b,candidateMove:row.candidate})),
  frontierRows:undefined,
  immediateImprovesRootWorsens:assessment.immediateImprovesRootWorsens.map(({search,teacherValues,...row})=>row),
  ablations:assessment.ablations.map(row=>({...row,featureName:featureNames[row.feature]}))}:null;
if(a) {
  const mean=xs=>xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:null;
  const sources=[...new Set(assessment.frontierRows.map(r=>r.source))].map(id=>{
    const rows=assessment.frontierRows.filter(r=>r.source===id),r=rows[0];
    return {id,phase:r.sourcePhase,policy:r.policy,depth:r.depth,
      bRegret:mean(rows.map(r=>r.bRegret)),candidateRegret:mean(rows.map(r=>r.candidateRegret))};
  });
  a.frontierRegretChangeInterval=bootstrapSources(sources,r=>r.candidateRegret-r.bRegret);
  a.exactFrontier=Object.fromEntries(['raw','awarded'].map(convention=>{
    const rows=assessment.frontierRows.filter(r=>r.exact?.[convention]);
    return [convention,{parents:rows.length,sources:new Set(rows.map(r=>r.source)).size,
      BWdlErrors:rows.filter(r=>r.exact[convention].bWdlError).length,
      candidateWdlErrors:rows.filter(r=>r.exact[convention].candidateWdlError).length}];
  }));
  a.rootBySourceDepth=Object.fromEntries([4,6].map(depth=>[depth,Object.fromEntries([4,6].map(sourceDepth=>[sourceDepth,
    summarizeDecisions(assessment.rootRows.filter(r=>r.depth===depth&&r.sourceDepth===sourceDepth).map(r=>({...r,sourcePhase:r.phase})))]))]));
  a.exactRoots=Object.fromEntries([4,6].map(depth=>[depth,Object.fromEntries(['raw','awarded'].map(convention=>{
    const rows=assessment.rootRows.filter(r=>r.depth===depth&&r.independent);
    const error=(r,move)=>Math.sign(r.independent[convention].rows.find(x=>x.move===move).value)<Math.sign(r.independent[convention].value);
    return [convention,{sources:rows.length,BWdlErrors:rows.filter(r=>error(r,r.b)).length,candidateWdlErrors:rows.filter(r=>error(r,r.candidate)).length}];
  }))]));
}
const optimizer=Object.fromEntries(PROTOCOL.lambdas.map(lambda=>[lambda,optional(`optimizer/selected-${lambda}`)]));
const candidateLosses=fit?[{lambda:0,training:fit.BTraining.loss,development:fit.BDevelopment.loss},
  ...fit.fits.map(f=>({lambda:f.lambda,training:f.preferenceLoss,development:null,converged:f.converged,projectedGradient:f.projectedGradient,iterations:f.iteration}))]:[];
// Score the already frozen fits on development for reporting only; no reselection.
if(fit) {
  const { objective, normalizePairs }=await import('./model.mjs');
  const reservations=optional('reservations'),groups=reservations.roles.development.map(r=>read(`${output}/preferences/${r.id}.json`).group);
  const pairs=normalizePairs(groups);
  for(const row of candidateLosses.filter(r=>r.lambda))row.development=objective(optimizer[row.lambda].delta,pairs).loss;
}
const hashes={};for(const name of ['protocol','reservations','historical-index','fit-results','learning-curve','assessment-results','confirmation-results','session','manifest']) {
  if(existsSync(`${output}/${name}.json`))hashes[name]=sha(readFileSync(`${output}/${name}.json`));
}
const evidence={version:1,published:new Date().toISOString(),status:state.status,error:state.error,pauseReason:state.status==='paused'?state.pauseReason:null,
  audit:checked,preservedFiles,serializationPreserved,assessmentReferencesVerified,amendment,ceilingAmendment,recoveredEngineeringFailures:state.recoveredEngineeringFailures,
  sourceChangesSincePrevious:before.changedSincePrevious,hashes,
  beforeForecast:before,currentForecast:state.forecast,resourceChangeForecast:optional('continuation-resource-forecast'),elapsedMs:state.elapsedMs,
  continuationMs:state.elapsedMs-optional('amendments/manifest-before-ten-hours').elapsedMs,
  preflight:optional('continuation-preflight-before'),extraResourceSnapshots,workers:workerTimeline,
  resources:{samples:resources.length,minAvailableGiB:Math.min(...resources.map(r=>r.limitingAvailableGiB)),
    maxSwapPagesPerSecond:Math.max(...resources.map(r=>r.swapPagesInOutPerSecond??0)),
    actualPoolHistogram:samples.reduce((s,r)=>(s[r.actualPool]=(s[r.actualPool]??0)+1,s),{}),
    activeNativeQueryHistogram:samples.reduce((s,r)=>(s[r.activeNativeQueries]=(s[r.activeNativeQueries]??0)+1,s),{}),
    configuredWorkers:2,sampleIntervalSeconds:15,throughput,throughputByPool},
  fit:fit?{...fit,model:undefined}:null,modelChecksum:fit?.model.checksum,candidateLosses,
  optimizer:Object.fromEntries(Object.entries(optimizer).map(([lambda,f])=>[lambda,f?{dataHash:f.dataHash,converged:f.converged,
    projectedGradient:f.projectedGradient,iterations:f.iteration,wallMs:f.wallMs,history:f.history}:null])),
  learningCurve:curve,assessment:a,confirmation,
  finalStage:state.stage,counts:state.counts};
evidence.checksum=hash(evidence);
atomic(`${root}/docs/data/residual-frontier-final-20261028.json`,evidence);
const n=(x,d=6)=>x==null?'—':Number(x).toFixed(d),pct=x=>`${n(100*x,2)}%`,hours=x=>n(x/3600000,3);
const ci=x=>x?.map(v=>n(v,4)).join(' to ')??'—';
const gates=assessment?.gates,finished=['complete','positional-gate-failed'].includes(state.status);
const lossRows=fit?[['Training',fit.BTraining,fit.training],['Development',fit.BDevelopment,fit.development],
  ...(assessment?[['Locked assessment',assessment.B,assessment.candidate]]:[])].map(([name,b,c])=>
  `| ${name} | ${c.sources} (${c.informative} informative) | ${c.preferences} | ${n(b.loss)} | ${n(c.loss)} | ${pct((b.loss-c.loss)/b.loss)} |`).join('\n'):'';
const breakdown=(title,rows)=>['',`### ${title}`,'','| Group | B loss | Candidate loss | Relative improvement |','| --- | ---: | ---: | ---: |',
  ...Object.keys(rows[0]).map(key=>`| ${key} | ${n(rows[0][key].loss)} | ${n(rows[1][key].loss)} | ${pct((rows[0][key].loss-rows[1][key].loss)/rows[0][key].loss)} |`)];
const report=[
'# Frozen residual-learning experiment: continuation and outcome','',
`**Status: ${state.status}.** ${finished?'The predefined experiment is finished.':state.pauseReason??state.error??'Incomplete.'} ${gates?`The preference gate ${gates.preference?'passed':'failed'} and the depth-six root-regret gate ${gates.root?'passed':'failed'}.`:''} Production evaluator B and production search remain unchanged.`,
'','[Audited final numerical evidence](data/residual-frontier-final-20261028.json) · [first-session report](RESIDUAL_FRONTIER_SESSION_ONE.md) · [unchanged protocol](RESIDUAL_FRONTIER_PROTOCOL.md)',
'','## Scheduling authorization and preserved evidence','',
'The user authorized a new session of at most eight active hours and raised the cumulative scientific ceiling from eight to ten active hours. This changes scheduling only. The original protocol file and source snapshot retain their original eight-hour value. The separately hashed scheduling certificate supplies the effective ten-hour guard; session and cumulative clocks are checked separately. The original three-hour session ledger is archived, not reset.',
'',`Original numerical source: \`${state.source}\`. Run identity: \`${state.runIdentity}\`. Joint split digest: \`${state.reservationDigest}\`.`,
'',`Previous execution source: \`${before.identity?optional('amendments/manifest-before-ten-hours').executionSource:'—'}\`; previous certificate: \`${ceilingAmendment.previousAmendmentHash}\`. Ceiling-amended execution source: \`${ceilingAmendment.executionSource}\`; certificate: \`${ceilingAmendment.checksum}\`.`,
'','Only these execution files changed relative to the preceding scheduling snapshot:',
'',...before.changedSincePrevious.map(c=>`- \`${c.path}\`: \`${c.before}\` → \`${c.after}\`.`),
'',`The installer and regression tests also changed in the repository, outside the frozen execution snapshot. The certificate verifies the complete source inventory and byte-identical non-forecast diagnostics, including statistical gates. No numerical, sampling, teacher, evaluator, optimizer, assessment or promotion rule changed. All **${preservedFiles.toLocaleString()}** files inventoried before continuation, including all 1,600 training sources and their labels, retain their exact SHA-256 bytes. The final audit verified **${checked.verifiedTaskReceipts.toLocaleString()}** task receipts, all reservations, continuation witnesses, teacher identities, model checksums and historical exclusions.`,
...(amendment.operationalRepair?['','### Checkpoint serialization recovery','',
  'After all labels, transfer searches and 224 ablation searches completed, the assembled assessment exceeded V8’s single-string limit: it duplicated large static-board observation arrays inside its root and mismatch records. This was an engineering serialization failure, not an invalid teacher result. No incomplete computation was accepted.',
  '',`The failed manifest and source snapshot remain archived. A separate operational certificate \`${amendment.checksum}\` registers execution source \`${state.executionSource}\`. Relative to the ceiling-amended snapshot, only \`run.mjs\` and \`planning-source.mjs\` changed. The verifier accepts exactly the observation-reference replacement and rejects any further run-code change. Complete observed-board arrays remain in their original immutable search task receipts; the assessment retains every numerical result and references the corresponding receipt with its observation count.`,
  '',`Recovery reused all completed native queries and searches in the same run and same session allowance. All **${serializationPreserved.toLocaleString()}** files inventoried after the failure, including the finalist, fit results, learning curve, splits and every completed task, retain identical SHA-256 bytes. The candidate checksum remained unchanged. Bootstrap/report assembly was recomputed deterministically because its failed aggregate write was not a valid checkpoint. A further cross-check verified all ${assessmentReferencesVerified} source/depth records against their original search receipts, teacher-relative regrets, frozen model and original gate function.`]:[]),
'','## Development selection and learned weights','',
fit?`All 400 predetermined development sources were labeled. Selection included zero-correction B and all three frozen regularizations. Selected λ: **${fit.selected.lambda}**. Finalist checksum: \`${fit.model.checksum}\`. Temperature 10, correction bounds ±25 and the deterministic projected/backtracking optimizer are unchanged. No selection or tuning used locked data.`:'Development selection is incomplete.',
'','| Corpus | Sources | Preferences | B loss | Candidate loss | Relative improvement |','| --- | ---: | ---: | ---: | ---: | ---: |',lossRows,
'','Loss is averaged over informative independent source trajectories, each with unit total preference mass. Siblings and preferences are correlated and are not independent sample sizes.',
'','| λ | Training preference loss | Development preference loss |','| --- | ---: | ---: |',
...candidateLosses.map(r=>`| ${r.lambda===0?'0 (B control)':r.lambda} | ${n(r.training)} | ${n(r.development)} |`),
'','| Phase | Feature | Original B | Learned correction | Corrected weight |','| --- | --- | ---: | ---: | ---: |',
...(fit?.corrections??[]).map(r=>`| ${r.phase} | ${r.feature} | ${r.original} | ${n(r.correction)} | ${n(r.new)} |`),
'','![Source learning curves](residual-frontier-final-learning-20261028.svg)',
'','![The 21 frozen feature corrections](residual-frontier-final-corrections-20261028.svg)',
'','The learning curves use the single development-selected λ at the frozen source counts. They describe data scaling, not a further selection opportunity. Optimizer convergence and histories are in the compact evidence.',
'','| Training sources | Training preference loss | Fixed development preference loss |','| --- | ---: | ---: |',
...(curve?.curve??[]).map(r=>`| ${r.size} | ${n(r.training.loss)} | ${n(r.development.loss)} |`),
'','## Locked positional assessment and search transfer','',
...(assessment?['![Independent preference loss and searched-root regret](residual-frontier-final-assessment-20261028.svg)','']:[]),
assessment?`Assessment used all 400 reserved sources and all 128 predetermined root-transfer positions at depths four and six. Relative held-out preference improvement: **${pct(gates.relativePreferenceImprovement)}**, against the fixed 5% minimum. Candidate-minus-B loss difference: ${n(assessment.candidate.loss-assessment.B.loss)}; source-stratified 95% bootstrap interval **${ci(assessment.lossInterval.interval95)}**. These intervals condition on the admitted source distribution and exclude systematic teacher bias.`:'Locked assessment is incomplete or unopened.',
'','| Root search depth | Sources | B mean D12 regret | Candidate mean D12 regret | Candidate − B (95% interval) | Disagreements |','| --- | ---: | ---: | ---: | --- | ---: |',
...[4,6].filter(d=>assessment).map(d=>{const r=assessment.rootSummary[d];return `| ${d} | ${r.sources} | ${n(r.bRegret,4)} | ${n(r.candidateRegret,4)} | ${n(r.candidateRegret-r.bRegret,4)} (${ci(assessment.rootIntervals[d].interval95)}) | ${r.disagreements} |`;}),
'',assessment?'Both searched-root uncertainty intervals include zero. Depth four was slightly worse on the point estimate; depth six was better, with most of that gain in the 48–55 occupied source stratum. Passing the depth-six point-estimate gate is not evidence of a reliably improved searched player.':'',
'',assessment?`Immediate frontier mean D12-relative regret: B ${n(assessment.frontier.bRegret,4)}, candidate ${n(assessment.frontier.candidateRegret,4)} estimated discs. Frontier disagreements: ${assessment.frontier.disagreements}; significant changes: ${assessment.frontier.significantChanges}; D10/D12 reversals: ${assessment.frontier.reversals}. Immediate-frontier improvement with a worse searched root occurred in ${assessment.immediateImprovesRootWorsens.length} depth/source cases. Better sibling preferences and better backed-up root decisions are separate outcomes.`:'',
'',assessment?`Frontier candidate-minus-B regret has a source-stratified 95% interval of ${ci(a.frontierRegretChangeInterval.interval95)} estimated discs. Independent exact frontier checks cover ${a.exactFrontier.raw.parents} parents from ${a.exactFrontier.raw.sources} sources. W/D/L errors under raw scoring: B ${a.exactFrontier.raw.BWdlErrors}, candidate ${a.exactFrontier.raw.candidateWdlErrors}; under awarded-empty scoring: B ${a.exactFrontier.awarded.BWdlErrors}, candidate ${a.exactFrontier.awarded.candidateWdlErrors}. Exact-root results for both conventions are in the compact evidence. These exact subsets do not calibrate earlier Edax estimates as game-theoretic truth.`:'',
...(assessment?breakdown('Locked loss by child phase',[assessment.B.byChildPhase,assessment.candidate.byChildPhase]):[]),
...(assessment?breakdown('Locked loss by source policy',[assessment.B.byPolicy,assessment.candidate.byPolicy]):[]),
...(assessment?breakdown('Locked loss by source search depth',[assessment.B.byDepth,assessment.candidate.byDepth]):[]),
'','### Frozen feature diagnostics','',
'Each row removes one feature’s corrections in all three phases without refitting. Positive loss damage means that removal worsens the frozen candidate. Root diagnostics use the predetermined every-fourth subset (32 roots) at depth six. These conditional ablations do not identify independently optimal feature weights.',
'','| Removed correction | Loss damage when removed | Mean root regret change when removed |','| --- | ---: | ---: |',
...(assessment?.ablations??[]).map(r=>`| ${featureNames[r.feature]} | ${n(r.lossDamageWhenRemoved)} | ${n(r.rootSubset.reduce((s,x)=>s+x.change,0)/r.rootSubset.length,4)} |`),
'',assessment?'Frontier-disc, mobility and X-square corrections provided the largest conditional preference-loss gains; corner-weight changes contributed very little. Removing any single correction worsened locked preference loss, but none of the seven feature removals changed teacher-relative regret on the 32-root diagnostic subset. This does not attribute the full-sample root improvement to a particular feature.':'',
'','All 21 coefficient loss ablations, phase/policy/depth regret diagnostics, source-level root rows, exact-root conventions and frontier/root mismatch cases are included in the compact evidence or the immutable local assessment artifact.',
'','## Equal-time playing strength','',
confirmation?`The complete frozen confirmation tournament ran after all labeling/training workers stopped. Simultaneous promotion criterion satisfied: **${confirmation.positive}**. No automatic production promotion.`:gates&&(!gates.preference||!gates.root)?'The predefined positional gates failed, so no confirmation games were played. Equal-time playing strength remains unmeasured for this candidate. The experiment stopped as specified; weights, samples and hyperparameters were not changed to rescue the result.':'Confirmation has not completed.',
...(confirmation?['','| Budget | Pairs / games | Wins / draws / losses | Candidate game points | One-sided 97.5% lower bound |','| --- | ---: | --- | ---: | ---: |',...confirmation.conditions.map(r=>`| ${r.timeMs} ms | ${r.pairs} / ${r.pairs*2} | ${r.wins} / ${r.draws} / ${r.losses} | ${pct(r.mean)} | ${pct(r.lower975)} |`),'','Full depth, node, evaluation, elapsed-time, deadline and inference-cost summaries are retained in the numerical evidence.']:[]),
'','## Resource utilization and forecast versus actual','',
`Preflight: Windows available ${n(before?evidence.preflight.limitingAvailableGiB:null,3)} GiB; WSL available ${n(evidence.preflight.availableGiB,3)} GiB; no duplicate research process. Configured workers: **2**. The safe cap, actual pool and actively executing native-query counts are distinct. Independent 15-second samples record pool histogram \`${JSON.stringify(evidence.resources.actualPoolHistogram)}\` and active-query histogram \`${JSON.stringify(evidence.resources.activeNativeQueryHistogram)}\`. A slot can be idle between queries; these are sampled occupancy counts, not CPU utilization. After stopping, actual pool and active native queries are zero.`,
'',`During continuation, limiting available memory reached ${n(evidence.resources.minAvailableGiB,3)} GiB; maximum measured WSL swapping was ${evidence.resources.maxSwapPagesPerSecond} pages/second. Resource reductions and their times/reasons are in the complete worker timeline. No applications were closed and no saved settings changed. The existing bounded temporary Windows keep-awake mechanism was used. WSL2 execution was measured; macOS hardware was unavailable and no macOS test is claimed.`,
'','| UTC reduction time | Actual pool | Windows available GiB | Reason |','| --- | --- | ---: | --- |',
...workerTimeline.timeline.filter(r=>start&&r.at>=start&&r.event==='pool-adjustment').map(r=>`| ${r.at} | ${r.previousPool} → ${r.actualPool} | ${n(r.windowsAvailableGiB,3)} | ${r.reason}; two-worker reserve ${n(r.requiredFreeHeadroomGiB,1)} GiB |`),
'','Native queries peaked near 57 MiB each. Retained root-observation arrays drove the larger coordinator memory footprint and the serialization failure; the receipt-reference repair removed their duplication from the aggregate assessment. The low-headroom sample occurred during that diagnostic stage, with no active WSL swapping measured.',
'','| Label stage | Completed sources | Stage seconds | Sustained sources/second |','| --- | ---: | ---: | ---: |',
...Object.entries(throughput).map(([role,r])=>`| ${role} | ${r.sources} | ${n(r.wallSeconds,1)} | ${n(r.sourcesPerSecond,3)} |`),
'','| Collection interval | Actual pool | Sources | Sustained sources/second |','| --- | ---: | ---: | ---: |',
...throughputByPool.map(r=>`| ${r.role} | ${r.workers} | ${r.completed} | ${n(r.sourcesPerSecond,3)} |`),
'','Rates for each constant-pool interval (excluding clean pauses) are retained in the compact evidence; throughput is never inferred from the safe cap. The earlier first-session training replay is receipt verification, not new scientific throughput.',
'',`Before continuation, the conservative full remaining forecast was ${hours(before.one.conservativeMs)} hours at one worker (${hours(before.one.totalProjectedMs)} cumulative), or ${hours(before.two.conservativeMs)} hours at two (${hours(before.two.totalProjectedMs)} cumulative). Both used complete training-task costs, cell maxima, measured parallel speedup capped by actual pool, at least 35% allowance, and a separate 20-minute reporting reserve. The forecast reserves games even though gate failure can eliminate them.`,
'',`Actual charged pipeline time: **${hours(state.elapsedMs)} cumulative hours**, including **${hours(evidence.continuationMs)} continuation hours**. Separate native Edax CPU: ${n(checked.nativeCpuSeconds,1)} seconds; Node CPU including worker threads: ${n(checked.nodeCpuSeconds,1)} seconds. Native and Node RSS high-water: ${n(checked.nativeMaxRssBytes/2**20,1)} / ${n(checked.nodeMaxRssBytes/2**20,1)} MiB. Historical-builder CPU/RSS remains separately audited. Report generation and final checks occur within the separately reserved reporting time.`,
'','## Interpretation and next research direction','',
fit&&assessment?`Independent Edax supervision changed the 21 weights and reduced training loss by ${pct((fit.BTraining.loss-fit.training.loss)/fit.BTraining.loss)}, development loss by ${pct((fit.BDevelopment.loss-fit.development.loss)/fit.BDevelopment.loss)}, and locked loss by ${pct(gates.relativePreferenceImprovement)}. ${gates.root?'The depth-six point-estimate no-deterioration gate passed.':'The corrections did not satisfy the depth-six no-deterioration gate.'} ${confirmation?`Equal-time confirmation ${confirmation.positive?'supports stronger play under both frozen budgets':'does not establish stronger play under both frozen budgets'}.`:'There is no evidence from confirmation games of stronger equal-time play.'}`:'The scientific interpretation remains incomplete.',
'','Converged convex fits, training/development learning curves, coefficient bounds and the fixed ablations distinguish limited gain within this seven-feature, phase-fixed, regularized objective from optimizer instability. They do not prove that every possible use of seven features is inadequate. Residual teacher disagreement may reflect representational limits, frontier sampling, irreducible horizon instability or failure to transfer through minimax. Supported preferences already exclude D10/D12 ordering disagreements, but agreement is not proof of exact early-game truth.',
'',fit&&curve?`The selected convex fit converged in ${optimizer[fit.selected.lambda]?.iteration??0} iterations, with maximum absolute correction ${n(Math.max(...fit.model.correction.map(Math.abs)),3)} against the ±25 bound. Development loss was ${n(curve.curve[0].development.loss)} at 100 sources and ${n(curve.curve.at(-1).development.loss)} at 1,600; more sources did not produce monotonic improvement. The flat curve and similar small training/held-out gains suggest that merely collecting more of this same supervision for these seven linear features is less promising than adding limited positional information. Regularization and the frontier distribution still constrain that inference.`:'',
'','The single most promising next direction is a separately preregistered compact corner/edge pattern residual, tested for independent positional gain and equal-time search cost. This experiment adds no such model and starts no new campaign.',
'','## Reproduction and continuation','',
`Run directory: \`${output}\`. Large data, raw teacher transcripts, models, optimizer histories, task receipts and checkpoints remain local and ignored. Original first-session numerical evidence and figures remain preserved.`,
'','```bash',`node scripts/residual/audit.mjs ${output.replace(root+'/', '')}`,
`node scripts/residual/publish-continuation.mjs ${output.replace(root+'/', '')} .`,
`python3 scripts/residual/plots-continuation.py ${output.replace(root+'/', '')} .`,'npm test','```',
...(finished?['','No further resume is required. The launcher rejects repeating a completed experiment.']:['','Resume only within the still-valid authorized session; no new allowance is inferred:','','```bash',`python3 scripts/residual/launch.py --output ${output.replace(root+'/', '')} --resume --workers 2 --mode continue --open-assessment`,'```']),
];
atomic(`${root}/docs/RESIDUAL_FRONTIER_RESULTS.md`,report.join('\n')+'\n');
console.log(JSON.stringify({published:true,status:state.status,preservedFiles,receipts:checked.verifiedTaskReceipts,model:fit?.model.checksum,gates}));
