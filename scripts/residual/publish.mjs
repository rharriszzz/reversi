#!/usr/bin/env node
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { read, atomic } from '../research/io.mjs';
import { audit } from './audit.mjs';
import { PROTOCOL } from './protocol.mjs';
import { workerHistory } from './worker-history.mjs';
import { trainingSummary } from './training-summary.mjs';
const [directory,repository='.']=process.argv.slice(2),output=resolve(directory),root=resolve(repository);
const state=read(`${output}/manifest.json`),pilot=existsSync(`${output}/pilot-results.json`)?read(`${output}/pilot-results.json`):null;
if(state.status==='running')throw Error('Publish a clean paused/completed checkpoint, not an active run');
const checked=audit(output),n=x=>x===null||x===undefined?'—':Number(x).toFixed(3);
const workers=workerHistory(output);
const baselineTraining=trainingSummary(output);
const finalForecast=state.forecast;
const measuredSpeedup=Math.min(...Object.values(pilot.scaling).map(row=>row.safeSpeedup));
const forecastAt=count=>{
  const stages=finalForecast.stages,parallel=stages.generation+stages.reconstruction+stages.teacher10+stages.teacher12+stages.rootTransfer,
    serial=Object.values(stages).reduce((a,b)=>a+b,0)-parallel,speedup=Math.min(count,measuredSpeedup),
    remainingMs=1.35*(parallel/speedup+serial)+finalForecast.reportReserveMs;
  return {workers:count,speedup,remainingMs,totalMs:finalForecast.elapsedMs+remainingMs,
    feasible:finalForecast.elapsedMs+remainingMs<=PROTOCOL.experimentCapMs};
};
const conditionalForecasts={oneWorker:forecastAt(1),twoWorkers:forecastAt(2)};
const compact={version:1,date:new Date().toISOString(),directory:output,protocol:PROTOCOL,
  status:state.status,pauseReason:state.pauseReason,error:state.error,audit:checked,counts:state.counts,
  forecast:state.forecast,conditionalForecasts,initialForecast:state.initialForecast,resources:state.resources,workers,baselineTraining,
  pilot:pilot?{passed:pilot.passed,digest:pilot.digest,roots:pilot.roots,attempts:pilot.attempts,costs:pilot.costs,
    training:pilot.learned.training,development:pilot.learned.development,BTraining:pilot.learned.BTraining,BDevelopment:pilot.learned.BDevelopment,
    selectedLambda:pilot.learned.selected.lambda,modelChecksum:pilot.learned.model.checksum,corrections:pilot.learned.corrections,
    fitSummaries:pilot.learned.fits,scaling:pilot.scaling,rootLabelCosts:pilot.rootLabelCosts,
    gameCosts:pilot.gameCosts.map(g=>({timeMs:g.timeMs,index:g.index,wallMs:g.wallMs})),inferenceCost:pilot.inferenceCost,
    decisions:pilot.decisions,recovery:pilot.recovery,
    exampleWitnesses:pilot.sampleExamples.map(e=>({id:e.root.id,occupied:e.root.occupied,player:e.root.player,policy:e.root.policy,depth:e.root.depth,
      rootScores:e.frontier.rootScores,lines:e.frontier.lines,parents:e.frontier.parents.map(p=>({board:p.board,player:p.player,occupied:p.occupied,bChoice:p.bChoice,
        children:p.children.map(c=>({move:c.move,occupied:c.occupied,phase:c.phase,terminal:c.terminal,base:c.base}))})),
      preferenceExamples:e.preferences.pairs.slice(0,3)}))}:null};
atomic(`${root}/docs/data/residual-frontier-v1-20261028.json`,compact);
const plotted=spawnSync('python3',[fileURLToPath(new URL('./plots.py',import.meta.url)),output,root],{encoding:'utf8'});
if(plotted.status!==0)throw Error(`Publication plots failed: ${plotted.stderr}`);
const training=checked.preferences.training??{sources:0,parents:0,pairs:0},dev=checked.preferences.development??{sources:0},forecast=state.forecast;
const correctionRows=pilot?.learned.corrections.map(r=>`| ${r.phase} | ${r.feature} | ${r.original} | ${n(r.correction)} | ${n(r.new)} |`).join('\n')??'';
const sourceRows=Object.entries(checked.preferences).map(([role,v])=>`| ${role} | ${v.sources} | ${v.informative} | ${v.parents} | ${v.pairs} | ${checked.byRole[role]?.queries??0} | ${checked.byRole[role]?.alternatives??0} |`).join('\n');
const workerRows=workers.timeline.filter(r=>r.event==='pool-adjustment'||r.mode==='session-one').map(r=>{
  const eastern=new Date(r.at).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour12:false});
  return `| ${r.at.slice(11,19)} | ${eastern} | ${r.previousPool??'resume'} → ${r.actualPool} | ${r.safeCap??r.launchWorkerCap} | ${n(r.windowsAvailableGiB)} | ${r.reason} |`;
}).join('\n');
const phaseRows=Object.entries(baselineTraining.byChildPhase).map(([phase,row])=>
  `| ${phase} | ${row.sources} | ${row.parents} | ${n(row.sourceMeanD12Regret)} | ${row.usefulSources} |`).join('\n');
const lines=[
'# B-preserving residual learning: first session',
'',`**Status: ${state.status}.** ${state.pauseReason??state.error??''}. The full scientific experiment is unfinished. Production evaluator B, original weights, search, browser and coaching remain unchanged. This session makes no independent strength claim.`,
'','[Frozen implementation protocol](RESIDUAL_FRONTIER_PROTOCOL.md) · [compact audited numerical evidence](data/residual-frontier-v1-20261028.json)',
'','![Pilot complete-source cost by occupied stratum](residual-frontier-v1-20261028.svg)',
'','![Training sources collected versus active labeling time](residual-frontier-collection-v1-20261028.svg)',
'','## Implemented and verified','',
'A separate 21-correction model, stable convex source-normalized preference fitter with analytical gradients and deterministic projected/backtracking optimization; fresh full-window continuation witnesses; independent legal child/phase/pass checks; qualified patched Edax D10/D12 all-alternative labels; independent raw/awarded exact checks on small frontiers; canonical historical and cross-role exclusions; frozen split identities; atomic task/optimizer/game checkpoints; bounded resumable sessions and detached keep-awake launch. Locked assessment and confirmation are barred in session one.',
'',`The integrated pilot ${pilot?.passed?'passed on all 24 reserved engineering roots':'has not completed'}. Receipt audit: **${checked.verifiedTaskReceipts}** completed tasks verified. Worker recovery tests used actual SIGKILL and immutable-receipt reuse, with changed protocol/result rejection. Historical index contains ${state.historical?.hashedKeys??'pending'} full canonical SHA-256 keys and occupies ${n((state.historical?.indexBytes??0)/2**20)} MiB in compact binary form. The temporary historical rebuild high-water is reported separately from steady research RSS.`,
'','## Completed supervision','',
'| Role | Source roots | Informative | Frontier parents | Supported preferences | D10/D12 queries | Alternative values |',
'| --- | ---: | ---: | ---: | ---: | ---: | ---: |',sourceRows,
'',`Scientific training has **${training.sources}/1,600** source roots labeled, covering **${training.parents} frontier parents**, with **${training.pairs}** supported sibling preferences. Development has ${dev.sources}/400 labeled. Locked queries: **${checked.assessmentQueries}**. Confirmation pairs: **${checked.confirmationPairs}**. No sample target was reduced. Alternative values count both horizons; preferences and correlated children are not independent sample sizes.`,
'',`Joint split digest: \`${checked.reservationDigest??'not yet frozen'}\`. The audit checked ${checked.witnesses.continuations} continuation witnesses: ${checked.witnesses.earlyTerminal} terminate early, ${checked.witnesses.terminalAtFrontier} reach fixed terminal utility exactly at the frontier, and ${checked.witnesses.staticFrontier} reach a static evaluation. There are ${checked.witnesses.passSteps} pass steps. ${checked.witnesses.originalStaticObserved}/${checked.witnesses.staticFrontier} static endpoints were observed by the original B evaluator callback. The ${checked.witnesses.unobservedStatic} unobserved static endpoint has independently verified continuation ties (${checked.witnesses.unobservedStaticWithVerifiedTies} checked), full-window backed-up scores and final static equality; it is not claimed as an original callback visit. Terminal endpoints are kept separate and never fitted as heuristic evaluations.`,
'',`The visible training corpus contains ${baselineTraining.usefulSources}/${baselineTraining.sources} sources with at least one stable useful alternative to B's immediate frontier choice. Source-mean D12-relative frontier regret is ${n(baselineTraining.sourceMeanD12Regret)} estimated discs. ${baselineTraining.exactParents} frontier parents from ${baselineTraining.exactSources} sources were independently solved under both terminal conventions. These describe the collected training signal; they do not measure learned corrections or root transfer.`,
'','| Child weight phase | Training sources | Frontier parents | B frontier D12 regret | Sources with useful correction |','| --- | ---: | ---: | ---: | ---: |',phaseRows,
'',`In the independently solved subset, B's immediate frontier choice makes ${baselineTraining.exactAwardedWdlErrors} exact W/D/L errors among ${baselineTraining.exactParents} parents under both raw and awarded-empty conventions. Parents share ${baselineTraining.exactSources} source trajectories. These are shallow frontier choices, **not** independently measured errors of B's depth-four/six root decisions. Policy and source-depth breakdowns are retained in the compact evidence.`,
'','## Pilot observations','',
pilot?`Pilot training preference loss: B ${n(pilot.learned.BTraining.loss)} → selected ${n(pilot.learned.training.loss)}. Engineering development: ${n(pilot.learned.BDevelopment.loss)} → ${n(pilot.learned.development.loss)}. Selected λ: ${pilot.learned.selected.lambda}. These small development observations validate machinery and are not the locked 5% gate. The pilot model is never substituted for the eventual scientific fit.`:'Pilot pending.',
'',`All three pilot optimizer fits converged in ${n(pilot.learned.fits.reduce((sum,row)=>sum+row.wallMs,0)/1000)} combined seconds. With only 21 parameters, reference-label collection dominates fitting cost; repeated optimization after convergence would not add useful learning.`,
'','![Pilot preference loss is a machinery check, not a strength result](residual-frontier-pilot-loss-v1-20261028.svg)',
'',`Pilot original weights, selected corrections and resulting weights (B score weight units):`,
'','| Phase | Feature | B | Correction | New |','| --- | --- | ---: | ---: | ---: |',correctionRows,
'','## Resources and useful computation','',
`Recorded active pipeline time: **${n(checked.elapsedMs/60000)} minutes**. Node process CPU: ${n(checked.nodeCpuSeconds)} seconds; separate native Edax CPU: ${n(checked.nativeCpuSeconds)} seconds. Node high-water RSS: ${n(checked.nodeMaxRssBytes/2**20)} MiB; native per-query high-water: ${n(checked.nativeMaxRssBytes/2**20)} MiB. Worker thread CPU overlaps Node totals and is not added twice. ${checked.teacherQueries} teacher queries produced ${checked.evaluatedAlternatives} alternative values, including distinct engineering repetitions.`,
'',`The short-lived historical-index builder used ${n(checked.historicalBuilderCpuSeconds)} CPU seconds and peaked at ${n(checked.historicalBuilderMaxRssBytes/2**20)} MiB RSS; it exited before workers started. Its CPU is separate from the coordinator total. Earlier engineering-run computation remains preserved and charged in elapsed time; those old runs are not silently counted as fresh scientific data.`,
'',`Latest Windows/WSL limiting available memory: ${n(state.resources?.limitingAvailableGiB)} GiB. Measured pilot scaling and complete task costs are in the compact evidence. Unrelated applications and saved settings were left unchanged. Actual Windows 11 Home 10.0.26300 / Chrome 156.0.8078.48 passed WSL2 localhost loading, four analyzed moves, verified continuation, computer reply and default-browser launch. Current macOS hardware was unavailable.`,
'','### Safe cap versus actual pool','',
'The manifest resource field `workers` is the current **safe cap**, not the configured or active worker count. The actual pool was reduced to one and stayed there even when later samples again permitted two or three. Automatic checks reduce concurrency; a checkpoint/resume can restore the previously benchmarked count. Active native queries can be fewer than pool slots. After the clean pause there are **zero active research workers**; one was the last configured pool size.',
'','| UTC | Eastern | Actual pool | Safe/launch cap | Windows available GiB | Recorded reason |','| --- | --- | --- | ---: | ---: | --- |',workerRows,
'','The reductions to one worker were triggered by Windows physical-memory headroom falling below **2.7 GiB**, the policy reserve of 1.5 GiB plus 0.6 GiB per worker for a two-worker pool. WSL still had substantially more available memory. These were reserve-policy decisions; the corresponding samples show no active WSL swapping and low CPU load. The threshold describes required free headroom, not measured worker consumption. My interim updates mistakenly read the safe cap as the actual pool; the table corrects that distinction using the original resource receipts and pool-adjustment events.',
'','## Forecast and continuation','',
forecast?`Conservative complete remaining computation forecast: **${n(forecast.conservativeMs/3600000)} hours**, plus ${n(forecast.elapsedMs/3600000)} hours already charged at that forecast. Includes 35% allowance and a separate 20-minute reporting reserve. Projected total: **${n(forecast.totalProjectedMs/3600000)} hours** against the unchanged eight-hour scientific ceiling. Feasible under that test: **${forecast.feasible}**. This is distinct from the three-hour first-session allowance. Sparse pilot tails and future background load remain uncertainty; refresh the forecast from completed scientific costs before opening assessment.`:'Forecast pending.',
'',`Run directory: \`${output}\`. Source checksum: \`${state.source}\`. Run identity: \`${state.runIdentity}\`. All large trajectories, raw labels, models and checkpoints stay local and ignored.`,
'',`The collected data retain their original frozen numerical source and receipt identities. A separately registered scheduling-only repair uses execution source \`${checked.executionSource}\`, certificate \`${checked.planningAmendmentHash}\`. The original source remains intact. Four changed files implement actual-pool forecasting, bounded stale-heartbeat charging, scheduling lineage and stricter reentry guards; search, evaluation, sampling, preference filtering, optimizer, teacher and scientific gate code remain unchanged. The certificate verifies every other source file and all non-forecast diagnostics byte-for-byte. The verification dispatch reused completed receipts and issued no new teacher queries.`,
'',`At one worker the conservative remaining forecast is **${n(conditionalForecasts.oneWorker.remainingMs/3600000)} hours**, or **${n(conditionalForecasts.oneWorker.totalMs/3600000)} total**, exceeding eight hours. A realistic rounded alternative is **nine total computational hours**, requiring later explicit authorization; no extension was taken. With sustained two-worker capacity, the conditional forecast is **${n(conditionalForecasts.twoWorkers.remainingMs/3600000)} additional hours**, **${n(conditionalForecasts.twoWorkers.totalMs/3600000)} total**. A later six-hour session could cover that case, subject to fresh preflight and the corrected actual-pool forecast. If capacity falls and the full plan cannot fit, the program pauses before opening locked results.`,
'','To resume within this same still-valid session allowance:',
'','```bash',`python3 scripts/residual/launch.py --output ${output.replace(root+'/', '')} --resume --mode session-one`,'```',
'','After the user separately authorizes a later six-hour allowance and fresh resources support the feasible forecast:',
'','```bash',`python3 scripts/residual/launch.py --output ${output.replace(root+'/', '')} \\`, '  --resume --new-session --session-hours 6 --mode continue --open-assessment','```',
'','That command preserves scientific inputs and receipts, labels development, freezes the candidate, and proceeds to assessment and gated games only if the actual-pool forecast permits it. Omit `--open-assessment` to stop after candidate selection. The first session cannot use it. A one-worker continuation currently needs a separately authorized total-budget revision before locked assessment; this command does not raise the eight-hour ceiling. Do not change sample sizes.',
'','Progress and a graceful pause:',
'','```bash',`tail -f ${output.replace(root+'/', '')}/launcher.log`,`kill -TERM "$(python3 -c 'import json; print(json.load(open("${output.replace(root+'/', '')}/manifest.json"))["pid"])')"`,'```',
'','## Scientific questions remain open','',
'1. Independent supervision has exercised fitting; improvement to the final 21 weights is not established.',
'2. Depth-four/six transfer awaits the reserved independent root tests.',
'3. Equal-time superiority awaits both complete gated tournaments.',
'4. Pilot coefficient changes are descriptive; beneficial/harmful feature attribution awaits fixed ablations.',
'5. Additional-source learning awaits the frozen development learning curves.',
'6. Seven-feature expressive sufficiency cannot be inferred from engineering data.',
'7. Next step: continue this same frozen experiment from its receipts; do not launch a new architecture or campaign.',
'','Any normal session pause is neither a scientifically failed experiment nor a completed one. Assessment gates, diagnostic comparisons and strength conclusions remain pending.',
];
atomic(`${root}/docs/RESIDUAL_FRONTIER_RESULTS.md`,lines.join('\n')+'\n');
console.log(JSON.stringify({published:true,status:state.status,audit:checked,forecast:forecast?.conservativeMs/3600000}));
