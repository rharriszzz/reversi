#!/usr/bin/env node
// Reads only the completed run's old training/development; never writes there.
import { existsSync,mkdirSync,readFileSync,readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { atomic,read,sourceDigest } from '../research/io.mjs';
import { fit as oldFit,normalizePairs,objective as oldObjective } from '../residual/model.mjs';
import { fit as linearFit,makeModel,zero,objective as linearObjective } from './linear.mjs';
import { encodePairs,csr,objective,makePattern,compile,DIMENSION,verifyPattern } from './model.mjs';
import { fit } from './optimize.mjs';
import { PROTOCOL,hash } from './protocol.mjs';
import { mean } from '../teacher/qualification-core.mjs';
const [oldArg,outArg]=process.argv.slice(2);if(!oldArg||!outArg)throw Error('Usage: fit.mjs OLD_RUN NEW_OUTPUT');
const old=resolve(oldArg),output=resolve(outArg);if(old===output)throw Error('Separate output required');mkdirSync(output,{recursive:true});
const path=name=>`${output}/${name}.json`,reservations=read(`${old}/reservations.json`),manifest=read(`${old}/manifest.json`);
if(hash(reservations.roles)!==reservations.digest||reservations.runIdentity!==manifest.runIdentity)throw Error('Old split mismatch');
const fitFiles=['fit','linear','model','optimize','protocol'].map(n=>`scripts/next-residual/${n}.mjs`).concat(['scripts/residual/model.mjs','scripts/residual/protocol.mjs','scripts/strong/model.mjs','scripts/research/core.mjs','scripts/research/io.mjs','scripts/teacher/qualification-core.mjs'],readdirSync('src').filter(n=>n.endsWith('.js')).map(n=>`src/${n}`));
const source=hash(fitFiles.map(p=>[p,hash(readFileSync(p,'utf8'))])),started=performance.now();
const prior=existsSync(path('fit-progress'))?read(path('fit-progress')):{source,elapsedMs:0};
if(prior.source!==source)throw Error('Fitting source changed; preserve checkpoints and use an audited recovery');
const elapsed=()=>prior.elapsedMs+performance.now()-started;
const check=()=>{if(elapsed()>PROTOCOL.patternQualificationMs)throw Error('Ten-minute encoding/fitting qualification envelope exhausted; checkpoints preserved, no fresh assessment authorized');};
let report={source,oldRun:old,oldRunIdentity:manifest.runIdentity,reservationDigest:reservations.digest,protocolHash:hash(PROTOCOL)};
const load=role=>reservations.roles[role].map(root=>{
  const receipt=read(`${old}/preferences/${root.id}.json`);
  if(receipt.runIdentity!==manifest.runIdentity||receipt.rootHash!==hash(root)||receipt.groupHash!==hash(receipt.group))throw Error('Old preference provenance mismatch');return receipt.group;
});
const frontierCache=new Map();
const frontier=id=>{if(!frontierCache.has(id)){const r=read(`${old}/frontiers/${id}.json`);if(r.resultHash!==hash(r.result))throw Error('Old frontier integrity mismatch');frontierCache.set(id,r.result);}return frontierCache.get(id);};
const saveFit=(name,fn)=>{
  const state=existsSync(path(name))?read(path(name)):null;
  return fn(state,s=>{atomic(path(name),s);atomic(path('fit-progress'),{source,elapsedMs:elapsed(),stage:name});});
};
const loss=(groups,model)=>{
  const evaluate=compile(model).evaluate;let sum=0,n=0;
  for(const g of groups){if(!g.pairs.length)continue;let s=0,m=0;const f=frontier(g.id);
    for(const p of g.pairs){const parent=f.parents[p.parent],score=move=>{
      const child=parent.children.find(c=>c.move===move);return child.terminal?child.base:evaluate(child.board,parent.player);};
      const z=-(score(p.preferred)-score(p.other))/10;s+=p.rawWeight*(Math.max(0,z)+Math.log1p(Math.exp(-Math.abs(z))));m+=p.rawWeight;}
    sum+=s/m;n++;}return sum/n;
};
const regret=(roots,model)=>{
  const evaluate=compile(model).evaluate,values=[];
  for(const root of roots){const f=frontier(root.id),gs=[];
    for(const [i,p] of f.parents.entries()){
      const labels=read(`${old}/tasks/label-${root.id}-p${i}-d12.json`).result.rows;
      const scores=p.children.map(c=>({move:c.move,value:c.terminal?c.base:evaluate(c.board,p.player)})).sort((a,b)=>b.value-a.value||a.move-b.move);
      gs.push(Math.max(...labels.map(r=>r.value))-labels.find(r=>r.move===scores[0].move).value);
    }if(gs.length)values.push(mean(gs));}return mean(values);
};
try {
  const training=load('training'),development=load('development'),trainPairs=normalizePairs(training),devPairs=normalizePairs(development);
  report.corpusHash=hash({training,development});check();
  // Control reproduces the completed fit without amending its source or artifact.
  const reproduced=oldFit(trainPairs,.0001,{check}),original=read(`${old}/fit-results.json`);
  if(reproduced.preferenceLoss!==original.training.loss||oldObjective(reproduced.delta,devPairs).loss!==original.development.loss)throw Error('Frozen old fit failed exact reproduction');
  report.oldReproduced={training:reproduced.preferenceLoss,development:oldObjective(reproduced.delta,devPairs).loss,converged:reproduced.converged};
  const lf=saveFit('linear-fit',(state,checkpoint)=>linearFit(trainPairs,0,{state,checkpoint,check}));
  const L=makeModel(lf.delta,{corpusHash:report.corpusHash,trainingRun:manifest.runIdentity,lambda:0,bound:100,temperature:10});
  if(existsSync(path('L'))&&read(path('L')).checksum!==L.checksum)throw Error('Frozen L changed on resume');atomic(path('L'),L);
  report.linear={checksum:L.checksum,fit:lf,training:linearObjective(lf.delta,trainPairs).loss,development:linearObjective(lf.delta,devPairs).loss,
    BTraining:linearObjective(zero(),trainPairs).loss,BDevelopment:linearObjective(zero(),devPairs).loss,developmentRegret:regret(reservations.roles.development,L)};
  console.log(JSON.stringify({stage:'L-frozen',checksum:L.checksum,training:report.linear.training,development:report.linear.development,elapsedSeconds:elapsed()/1000}));
  const encoded=encodePairs(training,frontier,L),encodedDev=encodePairs(development,frontier,L),train=csr(encoded.groups),dev=csr(encodedDev.groups);
  report.encoding={dimension:DIMENSION,trainingPairs:train.n,developmentPairs:dev.n,nonzeros:train.indices.length,support:encoded.support,
    observed:encoded.support.filter(n=>n>0).length,trainingIdentity:train.identity,developmentIdentity:dev.identity,
    unseenDevelopmentNonzeros:[...dev.indices].filter(i=>!encoded.support[i]).length,developmentNonzeros:dev.indices.length};
  report.patternTrials=[];
  for(const lambda of PROTOCOL.patternLambdas) {
    const fitted=saveFit(`pattern-fit-${lambda}`,(state,checkpoint)=>fit(train,lambda,{state,checkpoint,check}));
    const row={lambda,converged:fitted.converged,iterations:fitted.iteration,projectedGradient:fitted.projectedGradient,
      training:fitted.preferenceLoss,development:objective(fitted.coefficients,dev,0,false).loss,norm2:fitted.coefficients.reduce((n,v)=>n+v*v,0),wallMs:fitted.wallMs};
    report.patternTrials.push(row);console.log(JSON.stringify({stage:'P-fit',...row,elapsedSeconds:elapsed()/1000}));
  }
  const selected=[...report.patternTrials].sort((a,b)=>Math.abs(a.development-b.development)<=1e-12?a.norm2-b.norm2:a.development-b.development)[0];
  const pf=read(path(`pattern-fit-${selected.lambda}`)),P=makePattern(L,pf.coefficients,{lambda:selected.lambda,corpusHash:report.corpusHash,trainingIdentity:train.identity,supportHash:hash(encoded.support)});
  verifyPattern(P);if(existsSync(path('P'))&&read(path('P')).checksum!==P.checksum)throw Error('Frozen P changed on resume');atomic(path('P'),P);
  report.pattern={checksum:P.checksum,selected,compiledDevelopmentLoss:loss(development,P),developmentRegret:regret(reservations.roles.development,P)};
  if(Math.abs(report.pattern.compiledDevelopmentLoss-selected.development)>1e-7)throw Error('Sparse/compiled development loss mismatch');
  report.admission={relativeLossImprovement:(report.linear.development-selected.development)/report.linear.development,
    regretChange:report.pattern.developmentRegret-report.linear.developmentRegret};
  report.admission.loss=report.admission.relativeLossImprovement>=.05;report.admission.regret=report.admission.regretChange<=0;
  report.admission.oldDevelopment=report.admission.loss&&report.admission.regret;
  report.curves=[];
  for(const size of PROTOCOL.learningCurve) {
    const lp=normalizePairs(training.slice(0,size)),lfit=size===1600?lf:saveFit(`curve-L-${size}`,(state,checkpoint)=>linearFit(lp,0,{state,checkpoint,check}));
    // P curves refit ONLY its tables on prefixes; L always remains the full frozen L.
    const tp=csr(encoded.groups.slice(0,size)),pfit=size===1600?pf:saveFit(`curve-P-${size}`,(state,checkpoint)=>fit(tp,selected.lambda,{state,checkpoint,check}));
    report.curves.push({size,LTraining:linearObjective(lfit.delta,lp).loss,LDevelopment:linearObjective(lfit.delta,devPairs).loss,
      PTraining:pfit.preferenceLoss,PDevelopment:objective(pfit.coefficients,dev,0,false).loss,
      LConverged:lfit.converged,PConverged:pfit.converged,LIterations:lfit.iteration,PIterations:pfit.iteration});
    console.log(JSON.stringify({stage:'curve',...report.curves.at(-1),elapsedSeconds:elapsed()/1000}));
  }
  check();report.status='qualified';report.elapsedMs=elapsed();report.checksum=hash(report);atomic(path('fit-report'),report);
  atomic(path('fit-progress'),{source,elapsedMs:elapsed(),status:'complete'});
  console.log(JSON.stringify({status:report.status,admission:report.admission,seconds:report.elapsedMs/1000}));
}catch(error){report.status='qualification-failed';report.error=error.stack;report.elapsedMs=elapsed();atomic(path('fit-report'),report);atomic(path('fit-progress'),{source,elapsedMs:elapsed(),status:report.status});throw error;}
