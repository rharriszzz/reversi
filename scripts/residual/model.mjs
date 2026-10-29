import { DEFAULT_WEIGHTS, FEATURE_NAMES, phaseOf, validWeights } from '../../src/features.js';
import { extractFeaturesFast, evaluateFast } from '../../src/fast-features.js';
import { legalMoves } from '../../src/rules.js';
import { terminalScore } from '../../src/search.js';
import { PROTOCOL, hash } from './protocol.mjs';
export const PHASES=['opening','middle','endgame'];
export const FEATURES=Object.keys(FEATURE_NAMES);
export const zero=()=>Array(21).fill(0);
export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const norm2=a=>dot(a,a);

export function weightsFor(delta=zero()) {
  if(delta.length!==21||delta.some(x=>!Number.isFinite(x)||Math.abs(x)>PROTOCOL.correctionBound+1e-10)) throw Error('Invalid residual corrections');
  return Object.fromEntries(PHASES.map((p,i)=>[p,Object.fromEntries(FEATURES.map((k,j)=>[k,DEFAULT_WEIGHTS[p][k]+delta[i*7+j]]))]));
}
export function childEncoding(board,player) {
  const terminal=!legalMoves(board,1).length&&!legalMoves(board,-1).length;
  const x=zero(),phase=phaseOf(board);
  if(!terminal) {const f=extractFeaturesFast(board,player),offset=7*PHASES.indexOf(phase);FEATURES.forEach((k,i)=>{x[offset+i]=f[k];});}
  return {x,base:terminal?terminalScore(board,player):evaluateFast(board,player),phase,terminal};
}
export function makeModel(delta,metadata={}) {
  const model={kind:'reversi-B-residual-v1',features:FEATURES,phases:PHASES,baseline:DEFAULT_WEIGHTS,
    correction:[...delta],weights:weightsFor(delta),metadata};
  return {...model,checksum:hash(model)};
}
export function verifyModel(model) {
  const {checksum,...body}=model;
  if(hash(body)!==checksum||model.kind!=='reversi-B-residual-v1'||hash(model.baseline)!==hash(DEFAULT_WEIGHTS)
    ||hash(model.features)!==hash(FEATURES)||hash(model.phases)!==hash(PHASES)
    ||!validWeights(model.weights)||hash(weightsFor(model.correction))!==hash(model.weights)) throw Error('Model identity mismatch');
  return model.weights;
}
const softplus=x=>Math.max(0,x)+Math.log1p(Math.exp(-Math.abs(x)));
const sigmoid=x=>x>=0?1/(1+Math.exp(-x)):Math.exp(x)/(1+Math.exp(x));

// Each trajectory has mass 1 regardless of its parent/alternative/pair counts.
export function normalizePairs(groups) {
  const informative=groups.filter(g=>g.pairs.length),n=informative.length;
  return informative.flatMap(g=>{
    const mass=g.pairs.reduce((s,p)=>s+p.rawWeight,0);
    if(!(mass>0)) throw Error('Invalid preference mass');
    return g.pairs.map(p=>({...p,source:g.id,weight:p.rawWeight/mass/n}));
  });
}
export function objective(delta,pairs,lambda=0) {
  let loss=lambda*norm2(delta);const gradient=delta.map(x=>2*lambda*x);
  for(const p of pairs) {
    const z=-(p.base+dot(p.x,delta))/PROTOCOL.temperature;
    loss+=p.weight*softplus(z);
    const a=-p.weight*sigmoid(z)/PROTOCOL.temperature;
    for(let j=0;j<21;j++) gradient[j]+=a*p.x[j];
  }
  return {loss,gradient};
}
// No centering/scaling of the model or penalty. Training RMS of pair differences
// preconditions a direction in original weight units; lambda remains ||delta||².
export function moments(pairs) {
  const result=zero();
  for(const p of pairs) for(let j=0;j<21;j++) result[j]+=p.weight*p.x[j]*p.x[j];
  return result.map(x=>Math.max(PROTOCOL.optimization.momentFloor,Math.sqrt(x)));
}
export function fit(pairs,lambda,{state=null,checkpoint=()=>{},check=()=>{}}={}) {
  if(!pairs.length||!PROTOCOL.lambdas.includes(lambda)) throw Error('Empty training data or undeclared lambda');
  const config=PROTOCOL.optimization,scales=moments(pairs),dataHash=hash(pairs);
  if(state&&(state.dataHash!==dataHash||state.lambda!==lambda||hash(state.scales)!==hash(scales))) throw Error('Optimizer checkpoint identity mismatch');
  if(state?.converged) {
    const verified=objective(state.delta,pairs,lambda);
    if(Math.abs(verified.loss-state.loss)>1e-12)throw Error('Optimizer result mismatch');
    return state;
  }
  let delta=state?[...state.delta]:zero(),iteration=state?.iteration??0,step=state?.step??config.initialStep;
  const start=performance.now(),history=state?.history?[...state.history]:[];
  let converged=false,pg=Infinity;
  for(;iteration<config.maxIterations;iteration++) {
    check();const current=objective(delta,pairs,lambda);
    const projected=delta.map((v,j)=>Math.max(-25,Math.min(25,v-current.gradient[j]))-v);
    pg=Math.max(...projected.map(Math.abs));
    if(pg<config.gradientTolerance){converged=true;break;}
    let trial,accepted=false,alpha=Math.min(step*2,1e6);
    while(alpha>=config.minStep) {
      const diagonal=scales.map(s=>2*lambda+s*s/(4*PROTOCOL.temperature**2));
      trial=delta.map((v,j)=>Math.max(-25,Math.min(25,v-alpha*current.gradient[j]/diagonal[j])));
      const direction=trial.map((v,j)=>v-delta[j]);
      if(objective(trial,pairs,lambda).loss<=current.loss+config.armijo*dot(current.gradient,direction)) {accepted=true;break;}
      alpha*=config.backtracking;
    }
    if(!accepted) throw Error('Optimizer backtracking exhausted');
    delta=trial;step=alpha;
    if(iteration%25===0) history.push({iteration,loss:objective(delta,pairs,lambda).loss,projectedGradient:pg,step});
    if(iteration%100===0) checkpoint({delta,iteration:iteration+1,step,scales,lambda,dataHash,history});
  }
  const result={delta,iteration,step,scales,lambda,dataHash,history,converged,projectedGradient:pg,
    loss:objective(delta,pairs,lambda).loss,preferenceLoss:objective(delta,pairs).loss,wallMs:performance.now()-start};
  checkpoint(result);if(!converged) throw Error('Optimizer did not converge within frozen iteration cap');
  return result;
}
export function select(candidates,developmentPairs) {
  if(!developmentPairs.length) throw Error('No informative development trajectories');
  return candidates.map(c=>({...c,developmentLoss:objective(c.delta,developmentPairs).loss,norm:norm2(c.delta)}))
    .sort((a,b)=>Math.abs(a.developmentLoss-b.developmentLoss)<=1e-12?a.norm-b.norm:a.developmentLoss-b.developmentLoss)[0];
}
