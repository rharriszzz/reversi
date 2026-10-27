import { existsSync } from 'node:fs';
import { atomic, read } from './io.mjs';
import { pairInterval } from './core.mjs';
const fmt=(n,d=3)=>Number.isFinite(n)?n.toFixed(d):'unavailable';
const quantile=(a,q)=>a.length?[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)*q)]:null;
export function summarizePairs(pairs,comparisons=32,maxPairs=128) {
  const games=pairs.flatMap(p=>p.games),sides={candidate:[],opponent:[]};
  for(const game of games) for(const [side,rows] of Object.entries(game.stats)) {
    const candidate=(side==='black'?1:-1)===game.candidateColor;
    sides[candidate?'candidate':'opponent'].push(...rows);
  }
  const metrics=Object.fromEntries(Object.entries(sides).map(([side,rows])=>{
    const wallMs=rows.reduce((s,r)=>s+r.wallMs,0),evaluations=rows.reduce((s,r)=>s+r.evaluations,0);
    const depths={};for(const row of rows) depths[row.depth]=(depths[row.depth]??0)+1;
    return [side,{moves:rows.length,medianDepth:quantile(rows.map(r=>r.depth),0.5),depths,
      nodes:rows.reduce((s,r)=>s+r.nodes,0),evaluations,evaluationsPerSecond:wallMs?evaluations*1000/wallMs:null,
      wallMs,cpuMs:rows.reduce((s,r)=>s+r.cpuMs,0),meanMoveMs:rows.length?wallMs/rows.length:null,
      p95OverrunMs:quantile(rows.map(r=>r.overrunMs),0.95),maxOverrunMs:quantile(rows.map(r=>r.overrunMs),1),fallbacks:rows.filter(r=>r.fallback).length}];
  }));
  return {...pairInterval(pairs.map(p=>p.point),{comparisons,maxPairs}),games:games.length,
    wins:games.filter(g=>g.outcome>0).length,draws:games.filter(g=>g.outcome===0).length,losses:games.filter(g=>g.outcome<0).length,
    meanCandidateMargin:games.length?games.reduce((s,g)=>s+g.margin*g.candidateColor,0)/games.length:null,metrics};
}
export function buildResults(state,output) {
  const conditions=[];
  for(const condition of state.conditions??[]) {
    const pairs=(condition.tasks??[]).filter(id=>state.tasks[id]?.status==='complete').map(id=>read(state.tasks[id].path));
    conditions.push({...condition,summary:summarizePairs(pairs,state.protocol.comparisons,state.protocol.maxPairs),
      complete:pairs.length>=condition.target,originalTarget:condition.originalTarget??condition.target});
  }
  const files=(state.assessmentTasks??[]).filter(id=>state.tasks[id]?.status==='complete');
  const assessments=files.flatMap(id=>read(state.tasks[id].path).metrics);
  const confirmation=state.confirmationTask&&state.tasks[state.confirmationTask]?.status==='complete'?read(state.tasks[state.confirmationTask].path).metrics:[];
  return {version:state.version,seed:state.config.seed,status:state.status,stage:state.stage,source:state.source,git:state.git,platform:state.platform,config:state.config,
    elapsedMs:state.elapsedMs,cpuMs:state.cpuMs,allocation:state.allocation,calibration:state.calibration,
    progress:state.progress,training:state.training,assessments,confirmation,conditions,freeze:state.freeze,
    failures:state.failures,splitAudit:state.splitAudit,stoppingReason:state.stoppingReason,
    limitations:['Internal related-engine tournaments do not establish human strength or Elo.','Timed games vary with host scheduling; worker isolation cannot control unrelated host processes.',
      'Only available historical boards/opening roots can be excluded; unpublished old trajectories are unavailable.',
      'Physical macOS Intel and Apple Silicon acceptance is outstanding.','Behavior-policy outcomes are not minimax labels; TD estimates the mixed behavior policy.']};
}
export function report(state,output) {
  const results=buildResults(state,output);atomic(`${output}/results.json`,results);
  const lines=['# Local Reversi research report','',`Status: **${state.status}**, stage **${state.stage}**. Active wall time ${fmt(state.elapsedMs/1000,1)} s of ${fmt(state.config.budgetMs/1000,1)} s; process CPU ${fmt(state.cpuMs/1000,1)} s. Seed ${state.config.seed}.`,
    '',`Source SHA-256: \`${state.source}\`. Platform: ${state.platform.system} ${state.platform.arch}, Node ${state.platform.node}. CPU is process-wide (coordinator plus worker threads); test subprocess CPU is excluded. Parallel task CPU samples must not be summed.`,
    '',state.config.mode==='smoke'?'**Smoke test: infrastructure evidence only. Tiny samples cannot establish playing strength.**':'Models remain offline; B remains the production evaluator.',
    '',`Stopping reason: ${state.stoppingReason??'run in progress'}. Selection freeze: ${state.freeze?`${state.freeze.id} at ${fmt(state.freeze.elapsedMs/1000,1)} s`:'not reached; no confirmation claims'}.`,
    '', '## Data and fitting', '',`Accepted games by split: ${JSON.stringify(state.progress?.accepted??{})}. Exclusions: ${JSON.stringify(state.splitAudit??{})}.`,
    '', 'Prediction error uses one mean per game; counts of correlated positions are descriptive. Outcomes and margins are separate targets; relative MSE divides by B error on the same target. B/C prediction metrics use per-phase scalar calibration fitted only on training outcomes; playing and move-ranking scores retain the original heuristic scales.',
    '', '| Model | Target | Dev games | Relative MSE | Eval µs | Exact regret d1 / d3 |', '|---|---|---:|---:|---:|---:|'];
  for(const m of results.assessments) lines.push(`| ${m.id} | ${m.target} | ${m.loss.games} | ${fmt(m.relativeMse)} | ${fmt(m.cost?.microseconds)} | ${m.exact?.map(e=>fmt(e.meanRegret)).join(' / ')} |`);
  if(results.confirmation.length) {
    lines.push('','Untouched quality confirmation (read only after freeze):','','| Model | Target | Games | Outcome-label MSE | Exact-label MSE | Exact regret d1 / d3 |','|---|---|---:|---:|---:|---:|');
    for(const m of results.confirmation) lines.push(`| ${m.id} | ${m.target} | ${m.loss.games} | ${fmt(m.loss.mse)} | ${fmt(m.exactPrediction?.mse)} | ${m.exact.map(e=>fmt(e.meanRegret)).join(' / ')} |`);
  }
  lines.push('','## Paired playing comparisons','','Bounds cover all planned conditions and all possible sample prefixes with a Hoeffding union bound. The opening pair is the statistical unit. Selection rows are exploratory. Incomplete comparisons retain their original evidence thresholds.','','| Stage | Candidate / opponent | Budget | Pairs / target | W / D / L | Points | Simultaneous interval |','|---|---|---|---:|---:|---:|---|');
  for(const c of results.conditions) {const s=c.summary;lines.push(`| ${c.stage} | ${c.candidate} / ${c.opponent} | ${c.budget.timeMs?`${c.budget.timeMs} ms`:`depth ${c.budget.depth}${c.opponentDepth?` vs ${c.opponentDepth}`:''}`} | ${s.pairs} / ${c.target}${c.target!==c.originalTarget?` (minimum ${c.originalTarget})`:''} | ${s.wins} / ${s.draws} / ${s.losses} | ${fmt(s.mean)} | ${s.interval.map(n=>fmt(n)).join('–')} |`);}
  lines.push('','| Candidate / budget / side | Median depth | Nodes | Static calls | Calls/s | Mean ms | p95 / max overrun ms |','|---|---:|---:|---:|---:|---:|---:|');
  for(const c of results.conditions.filter(c=>c.summary.pairs)) for(const [side,m] of Object.entries(c.summary.metrics)) lines.push(`| ${c.candidate} / ${JSON.stringify(c.budget)} / ${side} | ${m.medianDepth} | ${m.nodes} | ${m.evaluations} | ${fmt(m.evaluationsPerSecond,0)} | ${fmt(m.meanMoveMs)} | ${fmt(m.p95OverrunMs)} / ${fmt(m.maxOverrunMs)} |`);
  const confirmed=results.conditions.filter(c=>c.stage==='confirmation'&&[80,300].includes(c.budget.timeMs));
  const credible=state.config.mode==='full'&&confirmed.length===2&&confirmed.every(c=>c.summary.pairs>=(c.budget.timeMs===80?128:64)&&c.summary.interval[0]>0.5);
  lines.push('','## Questions and evidence','',
    `1. Independent positional accuracy: ${results.confirmation.length?'see untouched exact-regret rows above; game outcomes remain policy-dependent labels.':'confirmation is unavailable; development accuracy cannot answer this independently.'}`,
    '2. Equal-depth strength: use the paired depth rows above; incomplete/wide intervals are inconclusive.',
    `3. Equal-time strength: ${credible?'the frozen candidate meets the prespecified internal confirmation threshold; external/platform validation is still needed.':'no independently confirmed improvement has been demonstrated.'}`,
    '4. Evaluation cost: measured complete evaluator calls appear above; work counts and per-move wall/CPU time remain separate in results.json.',
    '5. Features/patterns: inspect ablations.json and individual add/remove models; removal of a fixed fitted component measures dependence, not a refitted causal contribution.',
    '6. Learning methods: training history below compares development error at saved active training times. These are exploratory, never final confirmation.',
    '7. Training-time changes: curves.svg and training history show prediction quality; selection tournaments assess frozen checkpoints. Strength at every epoch is not measured.',
    '8. Deeper search: exact regret at depths 1/3 and same-evaluator depth-control games measure horizon effects. Timed completed depths alone do not establish causation.',
    '9. Failures: task failures and stopping reason below explain missing evidence; negative selection results are retained.',
    '10. Next: complete missing confirmation first; if quality gains vanish under time limits, prioritize cheaper features/search. No neural model is warranted by missing evidence.',
    '', '## Learning history','','| Model | Epoch | Active training s | Development MSE |','|---|---:|---:|---:|');
  for(const row of state.training?.history??[]) lines.push(`| ${row.id} | ${row.epoch} | ${fmt(row.trainingMs/1000,2)} | ${fmt(row.developmentMse)} |`);
  lines.push('','[Learning curves](curves.svg) · [Quality versus cost](quality-cost.svg) · [Pareto candidates](pareto.json)');
  if(state.calibration) {lines.push('','## Calibration','','| Component | Placements | µs |','|---|---:|---:|');for(const c of state.calibration.component) lines.push(`| ${c.name} | ${c.plies} | ${fmt(c.microseconds)} |`);lines.push('',`Research search options: ${JSON.stringify(state.calibration.options)}. Matched search timings, work counts, and sampled profile functions are in results.json.`);}
  if(existsSync(`${output}/ablations.json`)) {lines.push('','## Frozen-model ablations','','Positive delta MSE means removal worsens prediction; this is development evidence.','','| Group | Delta MSE |','|---|---:|');for(const row of read(`${output}/ablations.json`).results) lines.push(`| ${row.group} | ${fmt(row.deltaMse)} |`);}
  if(existsSync(`${output}/diagnostics.json`)) {lines.push('','## Independently supported disagreements','');for(const p of read(`${output}/diagnostics.json`).positions) {lines.push(`Board (Black=1, White=-1), side ${p.player}:`, '', '```',...Array.from({length:8},(_,r)=>p.board.slice(r*8,r*8+8).map(v=>v===1?'B':v===-1?'W':'.').join('')),'```','');for(const c of p.choices) lines.push(`${c.id} depth ${c.depth}: move ${c.move}, ${c.scoreKind} score ${fmt(c.score)}, exact final margin ${c.margin}, independently optimal continuation after that choice: ${c.line.map(x=>x.move===null?'pass':String.fromCharCode(65+x.move%8)+(1+(x.move>>3))).join(' ')}.`);}}
  lines.push('','## Failures and limits','',...(state.failures.length?state.failures.map(f=>`- ${f.id}: ${f.error}`):['No failed tasks recorded.']), '',...results.limitations.map(l=>`- ${l}`),'', 'Raw pair files contain per-move timings, depth histograms inputs, CPU totals and trajectories. manifest.json records task statuses and source identity. Resume never turns disclosed confirmation into a fresh holdout.');
  atomic(`${output}/report.md`,lines.join('\n')+'\n');
  // Standalone SVG, no plotting dependency. Each curve uses its own MSE scale.
  const colors=['#1166bb','#bb5522','#228855','#7755aa','#aa2266'];
  let svg='<svg xmlns="http://www.w3.org/2000/svg" width="960" height="520" viewBox="0 0 960 520"><rect width="960" height="520" fill="white"/><style>text{font:12px sans-serif;fill:#222}</style><text x="25" y="25">Development learning curves (relative to each model’s first checkpoint); descriptive</text>';
  const history=state.training?.history??[],ids=[...new Set(history.map(h=>h.id))];
  const xmax=Math.max(1,...history.map(h=>h.trainingMs));
  ids.forEach((id,k)=>{const h=history.filter(r=>r.id===id&&Number.isFinite(r.developmentMse));if(!h.length) return;const first=Math.max(1,h[0].developmentMse);svg+=`<polyline fill="none" stroke="${colors[k%colors.length]}" points="${h.map(r=>`${40+650*r.trainingMs/xmax},${60+350*Math.max(0,Math.min(2,r.developmentMse/first))/2}`).join(' ')}"/><text x="710" y="${55+k*23}" fill="${colors[k%colors.length]}">${id}</text>`;});
  svg+='<path d="M40 50 V420 H695" fill="none" stroke="#555"/><text x="220" y="450">Cumulative active fitting time per model →</text><text x="45" y="485">Prediction quality is not playing strength. See report.md for paired games and missing evidence.</text></svg>';
  atomic(`${output}/curves.svg`,svg);
  const metrics=results.assessments.filter(m=>m.cost&&Number.isFinite(m.relativeMse));
  const pareto=metrics.filter(m=>!metrics.some(n=>n.id!==m.id&&n.cost.microseconds<=m.cost.microseconds&&n.relativeMse<=m.relativeMse&&(n.cost.microseconds<m.cost.microseconds||n.relativeMse<m.relativeMse)));
  atomic(`${output}/pareto.json`,{criterion:'development relative prediction MSE versus measured evaluation microseconds; not playing strength',candidates:pareto.map(m=>m.id)});
  const maxCost=Math.max(1,...metrics.map(m=>m.cost.microseconds)),maxError=Math.max(1,...metrics.map(m=>m.relativeMse));
  let frontier='<svg xmlns="http://www.w3.org/2000/svg" width="900" height="520"><rect width="900" height="520" fill="white"/><style>text{font:12px sans-serif;fill:#222}</style><text x="30" y="25">Development prediction quality versus measured evaluator cost</text><path d="M60 50 V430 H850" fill="none" stroke="#444"/>';
  for(const m of metrics) {
    const x=70+700*m.cost.microseconds/maxCost,y=60+330*m.relativeMse/maxError;
    frontier+=`<circle cx="${x}" cy="${y}" r="${pareto.includes(m)?6:4}" fill="${pareto.includes(m)?'#1166bb':'#777'}"/><text x="${x+8}" y="${y-5}">${m.id}</text>`;
  }
  frontier+='<text x="300" y="470">Evaluation microseconds → (lower is cheaper)</text><text x="70" y="500">Vertical: relative prediction MSE (lower is better). Blue: nondominated candidates. Not playing strength.</text></svg>';
  atomic(`${output}/quality-cost.svg`,frontier);
  return results;
}
