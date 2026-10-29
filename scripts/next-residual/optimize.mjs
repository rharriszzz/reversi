// Deterministic projected L-BFGS, diagonal training-only preconditioning.
// The objective and box remain in original independent-coefficient units.
import { PROTOCOL,hash } from './protocol.mjs';
import { objective } from './model.mjs';
const dot=(a,b)=>{let sum=0;for(let i=0;i<a.length;i++)sum+=a[i]*b[i];return sum;};
const clip=(v,b)=>Math.max(-b,Math.min(b,v));
export function projectedGradient(x,g,bound=25) {
  let max=0;for(let i=0;i<x.length;i++)max=Math.max(max,Math.abs(clip(x[i]-g[i],bound)-x[i]));return max;
}
export function fit(data,lambda,{state=null,checkpoint=()=>{},check=()=>{},bound=25,config=PROTOCOL.patternOptimization}={}) {
  if(!data.n||!PROTOCOL.patternLambdas.includes(lambda))throw Error('Empty corpus or undeclared pattern lambda');
  const identity=hash({data:data.identity,lambda,bound,config,temperature:10,dimension:data.dimension});
  if(state&&state.identity!==identity)throw Error('Pattern optimizer identity mismatch');
  const n=data.dimension,diagonal=new Float64Array(n).fill(2*lambda);
  for(let r=0;r<data.n;r++)for(let k=data.offsets[r];k<data.offsets[r+1];k++)diagonal[data.indices[k]]+=data.weight[r]*data.values[k]**2/400;
  const scale=Float64Array.from(diagonal,d=>Math.sqrt(Math.max(d,1e-10)));
  let x=Float64Array.from(state?.coefficients??new Float64Array(n)),history=(state?.history??[]).map(h=>({s:Float64Array.from(h.s),y:Float64Array.from(h.y),rho:h.rho}));
  if(x.length!==n||x.some(v=>!Number.isFinite(v)||Math.abs(v)>bound+1e-10))throw Error('Invalid optimizer coordinates');
  let iteration=state?.iteration??0,trace=[...(state?.trace??[])],current=objective(x,data,lambda),pg=projectedGradient(x,current.gradient,bound);
  if(state?.converged&&(Math.abs(current.loss-state.loss)>1e-12||pg>=config.gradientTolerance))throw Error('Invalid converged checkpoint');
  const start=performance.now();
  const save=converged=>({identity,lambda,bound,coefficients:[...x],iteration,converged,loss:current.loss,
    preferenceLoss:objective(x,data,0,false).loss,projectedGradient:pg,wallMs:(state?.wallMs??0)+performance.now()-start,
    trace,history:history.map(h=>({s:[...h.s],y:[...h.y],rho:h.rho}))});
  for(;iteration<config.maxIterations&&pg>=config.gradientTolerance;iteration++) {
    check();const g=Float64Array.from(current.gradient,(v,i)=>v/scale[i]),q=Float64Array.from(g),alphas=[];
    for(let h=history.length-1;h>=0;h--) {
      const a=history[h].rho*dot(history[h].s,q);alphas[h]=a;
      for(let i=0;i<n;i++)q[i]-=a*history[h].y[i];
    }
    let gamma=1;
    if(history.length){const last=history.at(-1);gamma=Math.max(1e-6,Math.min(1e6,dot(last.s,last.y)/dot(last.y,last.y)));}
    const direction=Float64Array.from(q,v=>v*gamma);
    for(let h=0;h<history.length;h++) {
      const beta=history[h].rho*dot(history[h].y,direction);
      for(let i=0;i<n;i++)direction[i]+=history[h].s[i]*(alphas[h]-beta);
    }
    for(let i=0;i<n;i++) {
      direction[i]=-direction[i]/scale[i];
      if(x[i]>=bound&&direction[i]>0||x[i]<=-bound&&direction[i]<0)direction[i]=0;
    }
    if(dot(direction,current.gradient)>=-1e-20){history=[];for(let i=0;i<n;i++)direction[i]=-current.gradient[i]/(scale[i]**2);}
    let step=1,trial,next,accepted=false;
    while(step>=config.minStep) {
      trial=Float64Array.from(x,(v,i)=>clip(v+step*direction[i],bound));
      const diff=Float64Array.from(trial,(v,i)=>v-x[i]),slope=dot(diff,current.gradient);
      next=objective(trial,data,lambda,false);
      if(slope<0&&next.loss<=current.loss+config.armijo*slope){accepted=true;break;}
      step*=.5;
    }
    if(!accepted)throw Error(`Pattern optimizer backtracking exhausted at ${iteration}, projected gradient ${pg}`);
    next=objective(trial,data,lambda);
    const s=Float64Array.from(trial,(v,i)=>(v-x[i])*scale[i]),y=Float64Array.from(next.gradient,(v,i)=>(v-current.gradient[i])/scale[i]),sy=dot(s,y);
    if(sy>1e-20&&sy>1e-10*Math.sqrt(dot(s,s)*dot(y,y))) {
      history.push({s,y,rho:1/sy});if(history.length>config.history)history.shift();
    }
    x=trial;current=next;pg=projectedGradient(x,current.gradient,bound);
    if(iteration%25===0)trace.push({iteration:iteration+1,loss:current.loss,projectedGradient:pg,step});
    if(iteration%100===99){const saved=save(false);saved.iteration=iteration+1;checkpoint(saved);}
  }
  const result=save(pg<config.gradientTolerance);checkpoint(result);
  if(!result.converged)throw Error('Pattern optimizer iteration limit without convergence');return result;
}
