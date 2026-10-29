#!/usr/bin/env node
// Bounded exploratory fits on OLD training/development only. Never resumes a run,
// reads assessment labels, invokes Edax, or writes a production/model artifact.
import { mkdirSync, readFileSync, writeFileSync, symlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { read, atomic } from '../research/io.mjs';
import { hash } from './protocol.mjs';
import { normalizePairs, zero, objective, norm2, childEncoding } from './model.mjs';
import { frontierDecisions, summarizeDecisions } from './diagnostics.mjs';
import { specification, geometry } from '../strong/model.mjs';
const [input,outputArg]=process.argv.slice(2),root=resolve('.'),output=resolve(outputArg),run=resolve(input);
if(!input||!outputArg||output===run||existsSync(output))throw Error('Use a new dedicated diagnostic output directory');
mkdirSync(output,{recursive:true});
const frozen=read(`${run}/reservations.json`),manifest=read(`${run}/manifest.json`);
if(hash(frozen.roles)!==frozen.digest||frozen.runIdentity!==manifest.runIdentity)throw Error('Split identity mismatch');
const groups=Object.fromEntries(['training','development'].map(role=>[role,frozen.roles[role].map(source=>{
  const receipt=read(`${run}/preferences/${source.id}.json`);
  if(receipt.runIdentity!==manifest.runIdentity||receipt.rootHash!==hash(source)||receipt.groupHash!==hash(receipt.group))throw Error('Preference provenance mismatch');
  return receipt.group;
})]));
const pairs=Object.fromEntries(Object.entries(groups).map(([role,rows])=>[role,normalizePairs(rows)]));
const development=frozen.roles.development.map(source=>{
  const frontier=read(`${run}/frontiers/${source.id}.json`).result;
  const labels=frontier.parents.map((_,i)=>Object.fromEntries([10,12].map(d=>[d,read(`${run}/tasks/label-${source.id}-p${i}-d${d}.json`).result])));
  return {source,frontier,labels};
});
const decisions=delta=>summarizeDecisions(development.flatMap(({source,frontier,labels})=>frontierDecisions(source,frontier,labels,delta)));
const incorrect=(delta,ps)=>ps.filter(p=>p.base+p.x.reduce((s,v,j)=>s+v*delta[j],0)<=0).reduce((s,p)=>s+p.weight,0);
// Exact feature collisions are a representation check, not approximate binning.
const spec=specification('long',3);spec.templates=spec.templates.filter(t=>['corner6','edge8'].includes(t.name));
const geometries=geometry(spec),patternEncoding=board=>{
  const map=new Map();
  for(const [j,g] of geometries.entries()) {
    let code=0,power=1;for(const q of g.squares){code+=(board[q]+1)*power;power*=3;}
    const mirror=g.size-1-code;if(code===mirror)continue;
    const key=`${Math.floor(j/8)}/${Math.min(code,mirror)}`;
    map.set(key,(map.get(key)??0)+(code<mirror?1:-1));
  }
  return map;
};
const collisions={};
for(const role of ['training','development']) {
  const tied=pairs[role].filter(p=>!p.terminal&&p.base===0&&p.x.every(v=>v===0));let distinguishable=0;const examples=[];
  for(const pair of tied) {
    const parent=read(`${run}/frontiers/${pair.source}.json`).result.parents[pair.parent];
    const a=parent.children.find(c=>c.move===pair.preferred).board,b=parent.children.find(c=>c.move===pair.other).board;
    const fa=childEncoding(a,parent.player),fb=childEncoding(b,parent.player);
    if(fa.base!==fb.base||fa.x.some((v,j)=>v!==fb.x[j]))throw Error('Feature collision did not reproduce from boards');
    const pa=patternEncoding(a),pb=patternEncoding(b),different=[...new Set([...pa.keys(),...pb.keys()])].some(k=>(pa.get(k)??0)!==(pb.get(k)??0));
    distinguishable+=different;
    if(different&&examples.length<3)examples.push({source:pair.source,parent:pair.parent,preferred:pair.preferred,other:pair.other,gapH:pair.gapH,gapR:pair.gapR});
  }
  collisions[role]={identicalFeaturePreferencePairs:tied.length,sources:new Set(tied.map(p=>p.source)).size,
    mass:tied.reduce((n,p)=>n+p.weight,0),unavoidableLossContribution:tied.reduce((n,p)=>n+p.weight*Math.log(2),0),
    distinguishableByTwoTemplates:distinguishable,examples};
}
const sourceHashes=Object.fromEntries(['model','protocol'].map(name=>[name,hash(readFileSync(`${root}/scripts/residual/${name}.mjs`,'utf8'))]));
const report={kind:'exploratory-old-data-regularization-diagnosis-v1',started:new Date().toISOString(),
  runIdentity:manifest.runIdentity,reservationDigest:frozen.digest,sourceHashes,
  access:'Only 1600 training and 400 development preference receipts; no assessment labels or games accessed',
  collisions,baseline:{training:objective(zero(),pairs.training).loss,development:objective(zero(),pairs.development).loss,
    nonpositivePreferenceMass:incorrect(zero(),pairs.development),frontier:decisions(zero())},trials:[]};
const start=performance.now(),deadline=start+90000;
// Copy the exact fitter; relax only its declared lambda grid in a NEW scratch
// module. Its objective, optimizer, moments, bounds, temperature and tolerances
// remain byte-identical. No file in the completed run is modified.
const scratch=`${output}/fit-source`;
mkdirSync(`${scratch}/scripts/residual`,{recursive:true});
symlinkSync(`${root}/src`,`${scratch}/src`,'dir');symlinkSync(`${root}/scripts/teacher`,`${scratch}/scripts/teacher`,'dir');
writeFileSync(`${scratch}/scripts/residual/model.mjs`,readFileSync(`${root}/scripts/residual/model.mjs`));
const protocol=readFileSync(`${root}/scripts/residual/protocol.mjs`,'utf8'),before='lambdas:[.0001,.001,.01]';
if(protocol.split(before).length!==2)throw Error('Unknown frozen lambda declaration');
const revised=protocol.replace(before,'lambdas:[.0001,.00001,.000001,0]');
writeFileSync(`${scratch}/scripts/residual/protocol.mjs`,revised);
report.exploratoryProtocolHash=hash(revised);
const model=await import(pathToFileURL(`${scratch}/scripts/residual/model.mjs`));
for(const lambda of [.0001,.00001,.000001,0]) {
  const trialStart=performance.now();
  try {
    const fitted=model.fit(pairs.training,lambda,{check:()=>{if(performance.now()>deadline)throw Error('Diagnostic 90-second fitting cap');}});
    const row={lambda,temperature:10,bound:25,training:model.objective(fitted.delta,pairs.training).loss,
      development:model.objective(fitted.delta,pairs.development).loss,norm2:norm2(fitted.delta),
      maxAbs:Math.max(...fitted.delta.map(Math.abs)),boundCoordinates:fitted.delta.filter(x=>Math.abs(x)>=25-1e-8).length,
      penalty:lambda*norm2(fitted.delta),converged:fitted.converged,projectedGradient:fitted.projectedGradient,
      unregularizedGradientMax:Math.max(...model.objective(fitted.delta,pairs.training).gradient.map(Math.abs)),
      nonpositivePreferenceMass:incorrect(fitted.delta,pairs.development),frontier:decisions(fitted.delta),
      iterations:fitted.iteration,wallMs:performance.now()-trialStart,
      byChildPhase:{}};
    for(const phase of ['opening','middle','endgame']) {
      const phaseGroups=groups.development.filter(g=>{const occupied=g.parents[0]?.occupied+1;return (occupied<28?'opening':occupied<52?'middle':'endgame')===phase;});
      const ps=model.normalizePairs(phaseGroups);
      row.byChildPhase[phase]={sources:phaseGroups.length,B:model.objective(zero(),ps).loss,candidate:model.objective(fitted.delta,ps).loss};
    }
    report.trials.push(row);console.log(JSON.stringify({...row,frontier:{bRegret:row.frontier.bRegret,candidateRegret:row.frontier.candidateRegret,disagreements:row.frontier.disagreements}}));
    if(lambda===.0001) {
      const original=read(`${run}/fit-results.json`);
      if(row.training!==original.training.loss||row.development!==original.development.loss)throw Error('Frozen fit did not reproduce exactly');
      report.frozenFitReproducedExactly=true;
    }
    if(lambda===.000001) {
      report.weakRegularizationCurve=[];
      for(const size of [100,400,1600]) {
        const result=size===1600?fitted:model.fit(model.normalizePairs(groups.training.slice(0,size)),lambda,{check:()=>{if(performance.now()>deadline)throw Error('Diagnostic cap');}});
        report.weakRegularizationCurve.push({size,training:model.objective(result.delta,model.normalizePairs(groups.training.slice(0,size))).loss,
          development:model.objective(result.delta,pairs.development).loss,converged:result.converged});
      }
    }
  }catch(error){report.trials.push({lambda,complete:false,error:error.message,wallMs:performance.now()-trialStart});break;}
}
// Separate bound sensitivity: only the two explicit optimizer projections and
// the validation bound change in this second scratch copy. Never alter originals.
const wide=`${output}/fit-source-wide`;mkdirSync(`${wide}/scripts/residual`,{recursive:true});
symlinkSync(`${root}/src`,`${wide}/src`,'dir');symlinkSync(`${root}/scripts/teacher`,`${wide}/scripts/teacher`,'dir');
const originalModel=readFileSync(`${root}/scripts/residual/model.mjs`,'utf8'),projection='Math.max(-25,Math.min(25,';
if(originalModel.split(projection).length!==3)throw Error('Unknown box projection structure');
writeFileSync(`${wide}/scripts/residual/model.mjs`,originalModel.replaceAll(projection,'Math.max(-100,Math.min(100,'));
writeFileSync(`${wide}/scripts/residual/protocol.mjs`,revised.replace('correctionBound:25','correctionBound:100'));
const wideModel=await import(pathToFileURL(`${wide}/scripts/residual/model.mjs`));
report.boundSensitivity=[];
for(const lambda of [.000001,0]) {
  const fitted=wideModel.fit(pairs.training,lambda,{check:()=>{if(performance.now()>deadline)throw Error('Diagnostic cap');}});
  report.boundSensitivity.push({lambda,bound:100,temperature:10,training:wideModel.objective(fitted.delta,pairs.training).loss,
    development:wideModel.objective(fitted.delta,pairs.development).loss,norm2:norm2(fitted.delta),
    maxAbs:Math.max(...fitted.delta.map(Math.abs)),boundCoordinates:fitted.delta.filter(x=>Math.abs(x)>=100-1e-8).length,
    converged:fitted.converged,projectedGradient:fitted.projectedGradient,iterations:fitted.iteration,
    nonpositivePreferenceMass:incorrect(fitted.delta,pairs.development),frontier:decisions(fitted.delta)});
}
// A scale-only control changes logistic calibration without changing any
// nonterminal frontier ordering. Exclude terminal pairs and renormalize sources.
const nonterminal=Object.fromEntries(Object.entries(groups).map(([role,gs])=>[role,normalizePairs(gs.map(g=>({...g,pairs:g.pairs.filter(p=>!p.terminal)})))]));
const scaleLoss=(alpha,ps)=>ps.reduce((s,p)=>{const z=-alpha*p.base/10;return s+p.weight*(Math.max(0,z)+Math.log1p(Math.exp(-Math.abs(z))));},0);
let lo=.05,hi=4;
for(let i=0;i<55;i++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(scaleLoss(a,nonterminal.training)<scaleLoss(b,nonterminal.training))hi=b;else lo=a;}
const alpha=(lo+hi)/2;
report.scaleOnly={alpha,range:[.05,4],selectedOn:'training nonterminal preferences only',
  baselineTraining:scaleLoss(1,nonterminal.training),training:scaleLoss(alpha,nonterminal.training),
  baselineDevelopment:scaleLoss(1,nonterminal.development),development:scaleLoss(alpha,nonterminal.development),
  note:'Positive scaling preserves nonterminal sibling rankings; values exclude terminal-containing pairs and are not the full-corpus losses.'};
report.wallMs=performance.now()-start;report.checksum=hash(report);atomic(`${output}/diagnosis.json`,report);
console.log(JSON.stringify({output,wallSeconds:report.wallMs/1000,complete:report.trials.every(t=>t.converged)}));
