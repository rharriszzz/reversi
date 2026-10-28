import { atomic, read } from '../research/io.mjs';
export function interval(points,{comparisons=2,alpha=0.05}={}) {
  if(!points.length) return {n:0,mean:null,interval:[0,1]};
  const mean=points.reduce((a,b)=>a+b,0)/points.length,r=Math.sqrt(Math.log(2*comparisons/alpha)/(2*points.length));
  return {n:points.length,mean,interval:[Math.max(0,mean-r),Math.min(1,mean+r)]};
}
const fmt=(v,n=3)=>v===null||v===undefined?'—':Number(v).toFixed(n);
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function chart(output,name,title,series,xLabel,yLabel) {
  const points=series.flatMap(s=>s.points).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
  const height=Math.max(560,series.length*20+80);
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="${height}"><rect width="1100" height="${height}" fill="white"/><style>text{font:12px sans-serif;fill:#222}</style><text x="30" y="25">${escape(title)}</text><path d="M70 50 V450 H780" fill="none" stroke="#444"/>`;
  const maxX=Math.max(1,...points.map(p=>p[0])),maxY=Math.max(1e-6,...points.map(p=>p[1]));
  const colors=['#185fa5','#c34822','#257744','#8456a7','#a57900','#ee5599'];
  series.forEach((s,i)=>{
    const ps=s.points.filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1])),color=colors[i%colors.length];
    svg+=`<text x="800" y="${55+20*i}" style="fill:${color}">${escape(s.id)}</text>`;
    svg+=`<polyline fill="none" stroke="${color}" points="${ps.map(p=>`${70+p[0]/maxX*700},${450-p[1]/maxY*390}`).join(' ')}"/>`;
    for(const p of ps) svg+=`<circle cx="${70+p[0]/maxX*700}" cy="${450-p[1]/maxY*390}" r="3" fill="${color}"/>`;
  });
  for(let i=0;i<=5;i++) svg+=`<text x="${65+i*140}" y="470">${fmt(maxX*i/5,1)}</text><text x="10" y="${455-i*78}">${fmt(maxY*i/5,2)}</text>`;
  svg+=`<text x="240" y="510">${escape(xLabel)}</text><text x="30" y="540">${escape(yLabel)}</text>${points.length?'':'<text x="150" y="200">No completed measurements yet</text>'}</svg>`;
  atomic(`${output}/${name}.svg`,svg);
}
export function report(s,output) {
  const conditions=s.conditions.map(c=>{const pairs=c.tasks.map(p=>read(p));return {...c,summary:interval(pairs.map(p=>p.point),{comparisons:c.stage==='confirmation'?2:1}),wins:pairs.flatMap(p=>p.games).filter(g=>g.outcome>0).length,draws:pairs.flatMap(p=>p.games).filter(g=>g.outcome===0).length,losses:pairs.flatMap(p=>p.games).filter(g=>g.outcome<0).length};});
  const result={version:s.version,status:s.status,stage:s.stage,source:s.source,config:s.config,elapsedMs:s.elapsedMs,cpuMs:s.cpuMs,allocation:s.allocation,
    counts:s.counts,pilot:s.pilot,history:s.history,historyChunks:s.historyChunks,profile:s.profile,latest:s.latestAssessment,confirmation:s.confirmationAssessment,freeze:s.freeze,conditions,failures:s.failures,exclusions:s.exclusionAudit,
    conclusion:'B retained. No automatic evaluator promotion. Incomplete conditions do not support fixed-sample inference.'};
  const lines=[`# Strong evaluator research: ${s.status}`, '',`Stage: **${s.stage}**; active ${fmt(s.elapsedMs/3600000,2)} / ${fmt(s.config.budgetMs/3600000,2)} hours; process CPU ${fmt(s.cpuMs/3600000,2)} hours.`,
    '',`Training games: ${s.counts.trainGames}; accepted unique positions: ${s.counts.positions}; exact / search labels: ${s.counts.exact} / ${s.counts.search}. Rejected trajectories: ${s.counts.rejected}.`,
    '',`Last checkpoint: ${s.updated}. Source ${s.source}. Production B retained.`,
    '', '## Actual computation', '', '| Category | Active wall seconds | Process CPU seconds |', '|---|---:|---:|'];
  for(const [k,v] of Object.entries(s.allocation)) lines.push(`| ${k} | ${fmt(v.wallMs/1000,1)} | ${fmt(v.cpuMs/1000,1)} |`);
  lines.push('', '## Latest development quality', '', '| Model | MSE | Exact disc regret | Search-unit regret | Pair accuracy exact / search | Static µs |', '|---|---:|---:|---:|---:|---:|');
  for(const m of s.latestAssessment??[]) lines.push(`| ${m.id} | ${fmt(m.prediction.mse)} | ${fmt(m.ranking.exact.regret)} | ${fmt(m.ranking.search.regret)} | ${fmt(m.ranking.exact.pairAccuracy)} / ${fmt(m.ranking.search.pairAccuracy)} | ${fmt(m.speed.microseconds)} |`);
  if(s.confirmationAssessment) {
    lines.push('', '## Frozen independent quality assessment', '', '| Model | Exact positions | Exact regret d1 / d3 | Exact preference accuracy d1 | Static µs |', '|---|---:|---:|---:|---:|');
    for(const m of s.confirmationAssessment.metrics) lines.push(`| ${m.id} | ${m.ranking.exact.n} | ${fmt(m.ranking.exact.regret)} / ${fmt(m.depth3?.exact.regret)} | ${fmt(m.ranking.exact.pairAccuracy)} | ${fmt(m.speed.microseconds)} |`);
  }
  lines.push('', '## Paired games', '', '| Stage | Candidate | Budget | Pairs / fixed target | W/D/L | Points | Interval |', '|---|---|---|---:|---:|---:|---|');
  for(const c of conditions) lines.push(`| ${c.stage} | ${c.candidateId} | ${JSON.stringify(c.budget)} | ${c.summary.n}/${c.target} | ${c.wins}/${c.draws}/${c.losses} | ${fmt(c.summary.mean)} | ${c.summary.interval.map(v=>fmt(v)).join('–')}${c.summary.n<c.target?' (incomplete; descriptive)':''} |`);
  const primary=conditions.filter(c=>c.stage==='confirmation'&&[80,300].includes(c.budget.timeMs));
  result.primaryComplete=!s.config.smoke&&!s.config.pilot&&primary.length===2&&primary.every(c=>c.summary.n===c.target);
  result.evidenceForImprovement=result.primaryComplete&&primary.every(c=>c.summary.interval[0]>.5);
  lines.push('',result.evidenceForImprovement?'The completed primary conditions meet the declared internal evidence rule. Production still requires explicit review.':'No completed independent strength-promotion criterion has been met. B remains production.');
  lines.push('', 'Final inference uses only a frozen finalist, fixed 80/300 ms counts, pair means, and Bonferroni two-control Hoeffding bounds. There is no outcome-dependent stopping. Selection is exploratory. Twenty-ms games are descriptive.',
    '', '## Graphs', '', '[Prediction vs positions](positions.svg) · [Ranking vs positions](ranking.svg) · [Quality vs CPU](computation.svg) · [Strength vs move time](strength.svg) · [Quality vs evaluator cost](cost.svg) · [Phase diagnostics](phases.svg) · [Architecture comparison](families.svg)',
    '', '## Recovery', '', 'Launch/resume through scripts/strong-launch.py with the same output. The frozen source copy is authoritative. After Windows reboot, rerun that command in WSL. Downtime does not consume the budget. Completed shards, model epochs and opening pairs survive; only in-flight work is retried.',
    '', '## Limits and failures', '', 'Completed-game targets are policy-dependent. Earlier search labels share B and are estimates in its own units. Only independent exact labels measure disc regret. A smaller prediction error does not establish stronger equal-time play. Mac hardware untested.',
    ...s.failures.map(f=>`- ${f.id}: ${f.error}`),'');
  if(s.tasks['diagnostic-positions']) {
    lines.push('## Exact diagnostic continuations','');
    for(const p of read(s.tasks['diagnostic-positions'].path).positions) {
      lines.push(`Side to move: ${p.player===1?'Black':'White'}.`, '', '```', ...Array.from({length:8},(_,r)=>p.board.slice(r*8,r*8+8).map(v=>v===1?'B':v===-1?'W':'.').join('')), '```','');
      for(const [name,c] of Object.entries({B:p.baseline,learned:p.candidate})) lines.push(`${name}: move ${String.fromCharCode(65+c.move%8)}${1+(c.move>>3)}, exact margin ${c.margin}; independently verified continuation ${c.line.join(' ')}.`);
      lines.push('');
    }
  }
  atomic(`${output}/results.json`,result);
  atomic(`${output}/report.md`,lines.join('\n'));
  const ids=[...new Set(s.history.map(r=>r.id))],series=(x,y)=>ids.map(id=>({id,points:s.history.filter(r=>r.id===id).map(r=>[x(r),y(r)])}));
  chart(output,'positions','Development prediction error vs accumulated unique training positions',series(r=>r.totalPositions,r=>r.mse),'Unique training positions','Game-cluster development MSE (lower is better; outcome target is distinct)');
  chart(output,'ranking','Development exact/search move-ranking accuracy vs training positions',ids.flatMap(id=>['exact','search'].map(k=>({id:`${id} ${k}`,points:s.history.filter(r=>r.id===id&&r.ranking).map(r=>[r.totalPositions,r.ranking[k].pairAccuracy])}))),'Unique training positions','Pairwise preference accuracy; estimates and exact labels remain separate');
  chart(output,'computation','Prediction quality vs measured learning CPU',series(r=>r.totalCpuMs/3600000,r=>r.mse),'Cumulative learning process CPU hours','Development MSE (lower is better)');
  chart(output,'strength','Frozen candidates vs B: equal elapsed time', [...new Set(conditions.map(c=>c.candidateId))].map(id=>({id,points:conditions.filter(c=>c.candidateId===id&&c.budget.timeMs).map(c=>[c.budget.timeMs,c.summary.mean]).sort((a,b)=>a[0]-b[0])})),'Milliseconds per move','Candidate pair points; inspect report for counts and uncertainty');
  chart(output,'cost','Complete static cost vs exact decision quality',(s.latestAssessment??[]).map(m=>({id:m.id,points:[[m.speed.microseconds,m.ranking.exact.regret]]})),'Complete evaluation microseconds','Exact final-disc regret (lower is better)');
  chart(output,'phases','Prediction error by game phase',(s.latestAssessment??[]).map(m=>({id:m.id,points:m.prediction.byPhase.map((p,i)=>[i+1,p.mse])})),'Phase bucket 1–4','Development prediction MSE');
  chart(output,'families','Hand features / short tuples / long tuples / hybrid',(s.latestAssessment??[]).map((m,i)=>({id:m.id,points:[[i+1,m.ranking.search.pairAccuracy]]})),'Architecture index (legend)','Estimated-search preference accuracy (not independent strength)');
}
