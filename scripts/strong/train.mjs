import { cpuClock } from './telemetry.mjs';
import { play, counts, isTerminal } from '../../src/rules.js';
import { seededRandom } from '../../src/learning.js';
import { findBestMove, terminalScore } from '../../src/search.js';
import { legalMovesFast, evaluateFast } from '../../src/fast-features.js';
import { sparse, dot, compile, phaseOf, shrink } from './model.mjs';

const target=(g,objective)=>objective==='outcome'?100*g.outcome:100*g.margin/64;
export function fit(model,games,labels,development,{epochs=2,seed=1,rate=0.04,l2=0.002,countGames=games,countLabels=labels,developmentLabels=[],progress=()=>{},profile=null,encodingCache=null}={}) {
  const start=performance.now(),rng=seededRandom(seed);
  const measured=(name,fn)=>profile?profile.measure(name,fn):fn();
  progress({substage:'encoding',positions:0,totalPositions:games.reduce((n,g)=>n+Math.ceil(g.states.length/2),0),note:'encoding fitting batch; no new positions expected'});
  const encodingStart=performance.now(),encodingCpu=cpuClock();
  const raw=encodingCache?encodingCache.bind(model):board=>sparse(board,model,{raw:true});
  // Counts accumulate NEW sampled observations, excluding replay repetitions.
  // Reverse-color indices receive the same observations through signed coding.
  const samples=games.flatMap(g=>g.states.filter((_,i)=>i%2===0).map(s=>({s,g})));
  const labelBoards=countLabels.flatMap(r=>[r,...r.rows.map(row=>({board:play(r.board,r.player,row.move)}))]);
  for(const {board} of [...countGames.flatMap(g=>g.states.filter((_,i)=>i%2===0)),...labelBoards]) for(const [i] of raw(board)) model.counts[i]++;
  const encode=board=>{const x=raw(board).map(([i,v])=>[i,v*(model.spec.linear&&i<model.spec.phases*7?1:shrink(model,i))]);return {indices:Uint32Array.from(x.map(r=>r[0])),values:Float32Array.from(x.map(r=>r[1]))};};
  const value=x=>{let v=0;for(let j=0;j<x.indices.length;j++) v+=model.weights[x.indices[j]]*x.values[j];return v;};
  const rows=samples.map(({s,g})=>({x:encode(s.board),y:target(g,model.objective)}));
  // Exact targets retain disc scale. Search labels contribute only order, never
  // heuristic-to-disc regression. Opponent reply remains in raw label evidence.
  const exact=labels.filter(r=>r.kind==='exact').map(r=>({x:encode(r.board),y:model.objective==='outcome'?100*Math.sign(r.value*r.player):100*r.value*r.player/64}));
  const pairs=[];
  if(model.objective==='rank') for(const r of labels) {
    const key=r.kind==='exact'?'margin':'estimate',ordered=[...r.rows].sort((a,b)=>b[key]-a[key]);
    if(ordered.length<2) continue;
    for(const worse of ordered.slice(1)) {
      if(ordered[0][key]===worse[key]) continue;
      const a=encode(play(r.board,r.player,ordered[0].move)),b=encode(play(r.board,r.player,worse.move));
      pairs.push({a,b,player:r.player,exact:r.kind==='exact'});
    }
  }
  const update=(x,error,multiplier=1)=>{
    let norm=1;for(const v of x.values) norm+=v*v;
    for(let j=0;j<x.indices.length;j++) {
      const i=x.indices[j],w=model.weights[i];
      model.weights[i]=Math.max(-500,Math.min(500,w+rate*multiplier*(error*x.values[j]/norm-l2*w/(1+model.counts[i]))));
    }
  };
  if(profile) {const c=cpuClock(),span=profile.spans['fit.encoding']??={calls:0,wallMs:0,cpuMs:0};span.calls++;span.wallMs+=performance.now()-encodingStart;span.cpuMs+=(c.user+c.system-encodingCpu.user-encodingCpu.system)/1000;}
  const curve=[];let bestLoss=Infinity,bestWeights=null,bestEpoch=model.epochs,stale=0,bestQuality=Infinity;
  for(let epoch=0;epoch<epochs;epoch++) {
    progress({substage:'gradient-updates',epoch:`${epoch+1}/${epochs}`,positions:epoch*rows.length,note:'fitting active; no new training positions expected until fitting finishes'});
    measured('fit.optimization',()=>{
    for(let i=rows.length-1;i>0;i--) {const j=Math.floor(rng()*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]];}
    for(const row of rows) update(row.x,row.y-value(row.x),model.objective==='rank'?0.25:1);
    for(const row of exact) update(row.x,row.y-value(row.x),2);
    for(const p of pairs) {
      const delta=p.player*(value(p.a)-value(p.b));
      // Smooth pairwise logistic preference, with a 10-score temperature.
      const gradient=10/(1+Math.exp(Math.max(-40,Math.min(40,delta/10))));
      update(p.a,p.player*gradient,2);update(p.b,-p.player*gradient,2);
    }
    });
    model.epochs++;model.version++;
    const metrics=measured('fit.development_prediction',()=>prediction(model,development));
    const quality=developmentLabels.length?measured('fit.development_ranking',()=>ranking(model,developmentLabels)):null;
    const decision=quality?.exact.regret??metrics.mse;
    progress({substage:'epoch-complete',epoch:`${epoch+1}/${epochs}`,positions:(epoch+1)*rows.length,note:'epoch completed; no new training data generated'});
    curve.push({epoch:model.epochs,fitMs:performance.now()-start,positions:rows.length,preferencePairs:pairs.length,quality,...metrics});
    if(Number.isFinite(decision)&&(decision<bestQuality-1e-8||(Math.abs(decision-bestQuality)<1e-8&&metrics.mse<bestLoss))) {bestQuality=decision;bestLoss=metrics.mse;bestWeights=Float32Array.from(model.weights);bestEpoch=model.epochs;stale=0;}
    else stale++;
    if(development.length&&stale>=3) break;
  }
  if(bestWeights) {model.weights=bestWeights;model.checkpointEpoch=bestEpoch;}
  if(model.weights.some(w=>!Number.isFinite(w))) throw new Error('Divergent model');
  return {model,curve,encodingCache:encodingCache?.snapshot(),quality:developmentLabels.length?ranking(model,developmentLabels):null,loss:prediction(model,development),examples:rows.length,preferencePairs:pairs.length};
}
export function calibrateBaseline(games,kind='margin') {
  const sums=Array.from({length:4},()=>({xx:0,xy:0}));
  for(const g of games) for(let i=0;i<g.states.length;i+=4) {
    const s=g.states[i],x=evaluateFast(s.board,1),p=phaseOf(64-counts(s.board).empty,{phases:4,phaseStart:16});
    sums[p].xx+=x*x;sums[p].xy+=x*target(g,kind);
  }
  return sums.map(s=>s.xx?s.xy/s.xx:0);
}
export function prediction(model,games,{gains,objective=model.objective}={}) {
  const e=model==='B'?{evaluate:evaluateFast}:compile(model),phases=Array.from({length:4},()=>({sum:0,n:0}));
  let mse=0,n=0;const spec={phases:4,phaseStart:16},boundaries={near:{sum:0,n:0},away:{sum:0,n:0}},policies={};
  for(const g of games) {
    let loss=0,m=0;
    for(let i=0;i<g.states.length;i+=4) {
      const s=g.states[i],occupied=64-counts(s.board).empty,p=phaseOf(occupied,spec),err=e.evaluate(s.board,1)*(gains?.[p]??1)-target(g,objective),group=phases[p];
      loss+=err*err;m++;group.sum+=err*err;group.n++;
      const bucket=Math.min(...[28,40,52].map(v=>Math.abs(v-occupied)))<=1?boundaries.near:boundaries.away;bucket.sum+=err*err;bucket.n++;
    }
    if(m) {mse+=loss/m;n++;const key=JSON.stringify(g.policy??'unknown');policies[key]??={sum:0,n:0};policies[key].sum+=loss/m;policies[key].n++;}
  }
  return {mse:n?mse/n:null,games:n,byPhase:phases.map(p=>({positions:p.n,mse:p.n?p.sum/p.n:null})),
    byBoundary:Object.fromEntries(Object.entries(boundaries).map(([k,v])=>[k,{positions:v.n,mse:v.n?v.sum/v.n:null}])),
    byPolicy:Object.fromEntries(Object.entries(policies).map(([k,v])=>[k,{games:v.n,mse:v.sum/v.n}])),
    target:objective==='outcome'?'100 * outcome sign':'100 * Black margin / 64',calibration:gains?'B zero-intercept phase gains fitted on training outcomes only; search unchanged':'learned target units',unit:'squared prediction units; game-cluster mean'};
}
export function ranking(model,refs,depth=1) {
  const e=model==='B'?{evaluate:evaluateFast}:compile(model),records=[];
  for(const ref of refs) {
    if(ref.rows.length<2) continue;
    const choice=findBestMove(ref.board,ref.player,depth,undefined,{evaluate:e.evaluate,legalMoves:legalMovesFast});
    const key=ref.kind==='exact'?'margin':'estimate',best=Math.max(...ref.rows.map(r=>r[key]));
    const chosen=ref.rows.find(r=>r.move===choice.move);let right=0,total=0;
    const predictions=ref.rows.map(r=>{
      const b=play(ref.board,ref.player,r.move);
      return isTerminal(b)?terminalScore(b,ref.player):depth===1?e.evaluate(b,ref.player):-findBestMove(b,-ref.player,depth-1,undefined,{evaluate:e.evaluate,legalMoves:legalMovesFast}).score;
    });
    for(let i=0;i<ref.rows.length;i++) for(let j=i+1;j<ref.rows.length;j++) if(ref.rows[i][key]!==ref.rows[j][key]) {
      total++;const a=Math.sign(predictions[i]-predictions[j]),b=Math.sign(ref.rows[i][key]-ref.rows[j][key]);right+=a===b?1:a===0?0.5:0;
    }
    records.push({key:ref.key,kind:ref.kind,phase:phaseOf(64-counts(ref.board).empty,{phases:4,phaseStart:16}),regret:best-chosen[key],move:choice.move,right,total,optimal:best===chosen[key]});
  }
  const summarize=rows=>({n:rows.length,optimal:rows.filter(r=>r.optimal).length,regret:rows.length?rows.reduce((s,r)=>s+r.regret,0)/rows.length:null,
    pairAccuracy:rows.reduce((s,r)=>s+r.total,0)?rows.reduce((s,r)=>s+r.right,0)/rows.reduce((s,r)=>s+r.total,0):null});
  return {depth,exact:summarize(records.filter(r=>r.kind==='exact')),search:summarize(records.filter(r=>r.kind==='search')),byPhase:[0,1,2,3].map(p=>summarize(records.filter(r=>r.phase===p))),records};
}
export function speed(model,states,{calls=3000}={}) {
  const e=model==='B'?{evaluate:evaluateFast}:compile(model);let checksum=0;
  for(let i=0;i<calls;i++) checksum+=e.evaluate(states[i%states.length].board,1);
  const samples=[];
  for(let rep=0;rep<3;rep++) {const start=performance.now();for(let i=0;i<calls;i++) checksum+=e.evaluate(states[i%states.length].board,1);samples.push((performance.now()-start)*1000/calls);}
  const searches=states.slice(0,9).map(s=>{const start=performance.now(),r=findBestMove(s.board,s.player,14,undefined,{evaluate:e.evaluate,legalMoves:legalMovesFast,timeMs:20,orderingHints:true});return {depth:r.depth,nodes:r.nodes,evaluations:r.evaluations,wallMs:performance.now()-start};});
  return {microseconds:[...samples].sort((a,b)=>a-b)[1],samples,checksum,bytes:e.bytes??0,searches};
}
