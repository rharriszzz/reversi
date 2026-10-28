#!/usr/bin/env node
// Read-only V4 publication: no searches, admission, model fitting or gate changes.
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {audit} from './qualification-publish.mjs';
import {read,atomic} from '../research/io.mjs';
import {hash,mean,quantile,summarize,wilson} from './qualification-core.mjs';
import {sha,parse} from './edax.mjs';
import {verifySourcePolicy} from './qualification-import.mjs';
import {legalMoves} from '../../src/rules.js';

const histogram=xs=>Object.fromEntries([...new Set(xs)].sort((a,b)=>a-b).map(x=>[x,xs.filter(y=>x===y).length]));
const distribution=xs=>({n:xs.length,mean:mean(xs),median:quantile(xs,.5),p90:quantile(xs,.9),p95:quantile(xs,.95),max:xs.length?Math.max(...xs):null,histogram:histogram(xs)});
const wdl=(best,chosen)=>best>0?(chosen<0?'win-to-loss':chosen===0?'win-to-draw':'win-retained'):best===0?(chosen<0?'draw-to-loss':'draw-retained'):'loss-retained';

// Reporting only. The frozen runner's LCG % n cycles through a permutation
// when a stratum has 32 roots, producing a falsely zero-width interval.
// Use all 32 random bits for the index; do not change any observed-value gate.
export function reportBootstrap(rows,value=r=>r.regret,seed=91845,reps=10000){
 if(!rows.length)return null;let state=seed>>>0;
 const next=n=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return Math.floor(state/4294967296*n);};
 const groups=[...new Set(rows.map(r=>`${r.phase}/${r.policy}`))].map(k=>rows.filter(r=>`${r.phase}/${r.policy}`===k)),samples=[];
 for(let i=0;i<reps;i++){let sum=0;for(const group of groups)for(let j=0;j<group.length;j++)sum+=value(group[next(group.length)]);samples.push(sum/rows.length);}
 return [quantile(samples,.025),quantile(samples,.975)];
}

export async function publishV4(output,preparedEvidence,prelaunch){
 const e=audit(output),m=read(`${output}/manifest.json`),before=read(prelaunch),originalPreparation=read(preparedEvidence).v4,prepared=before.protocol?{...before,oddIds:originalPreparation.oddIds}:originalPreparation;
 if(e.protocol.version!==4||hash(e.protocol)!==hash(prepared.protocol)||e.source!==prepared.source||e.runIdentity!==prepared.runIdentity||e.reservation.digest!==prepared.reservationDigest||e.runIdentity!==before.runIdentity)throw Error('Original V4 preparation changed');
 const {verifyPreflight:frozenPreflight}=await import(pathToFileURL(`${output}/source/scripts/teacher/bound-preflight.mjs`).href);frozenPreflight(m.adapterPreflightPath,m.pin);
 const reservation=read(`${output}/tasks/reservation.json`).result,tasks={};
 for(const name of readdirSync(`${output}/tasks`))tasks[name.slice(0,-5)]=read(`${output}/tasks/${name}`);
 for(const [name,h] of Object.entries(before.taskHashes))if(sha(`${output}/tasks/${name}`)!==h)throw Error('Prepared receipt overwritten');
 for(const [id,h] of Object.entries(prepared.trajectoryHashes)){const path=`${output}/trajectories/${id}.json`;if(sha(path)!==h)throw Error('Reserved trajectory changed');const tr=read(path);verifySourcePolicy(tr,tr);}
 if((!before.protocol&&reservation.import)||reservation.oddIds.length!==32||hash(reservation.oddIds)!==hash(prepared.oddIds))throw Error('Predetermined odd checks changed');
 for(const [role,roots] of Object.entries(reservation.roles)){
  if(roots.length!==prepared.roles[role])throw Error('Fixed sample changed');
  for(const [i,s] of roots.entries())if(s.id!==`${role}-${i}`||(role==='assessment'&&(s.phase!==Math.floor(i/64)||s.policy!==(i%2?'B4-2%':'B1-12%')))||(role==='exact-assessment'&&(s.occupied!==(i<32?54:52)||s.policy!=='random-exact')))throw Error('Reservation order or distribution changed');
 }
 if(before.protocol&&(!before.importedAssessmentIdentical||!before.oddSubsetIdentical||reservation.import?.previouslyEvaluated!==false||reservation.import.digest!==originalPreparation.reservationDigest||reservation.import.oldRunIdentity!==originalPreparation.runIdentity))throw Error('Unopened assessment import proof mismatch');
 let nativeQueries=0,terminalAlternatives=0,passAlternatives=0,alternatives=0;
 const rawHashes={},labelCosts=[];
 for(const [name,receipt] of Object.entries(tasks)){
  const {input,result}=receipt;if(!input.s||!input.depth||!result.rows)continue;
  if(hash(input.pin)!==hash(e.pin))throw Error('Mixed teacher identities');
  alternatives+=result.rows.length;terminalAlternatives+=result.rows.filter(x=>x.adapterTerminal).length;passAlternatives+=result.rows.filter(x=>x.normalizedPass).length;
  const requests=result.rows.filter(x=>!x.adapterTerminal);
  if(requests.length){
   const path=`${output}/raw/${name}.json`,raw=read(path),args=Object.fromEntries(Array.from({length:raw.args.length/2},(_,i)=>raw.args.slice(2*i,2*i+2)));
   if(raw.code!==0||raw.expired||raw.signal||args['-eval-file']!==e.pin.evalFile||args['-n']!=='1'||args['-h']!=='16'||args['-depth']!==String(input.depth-1)||args['-selectivity']!=='5'||args['-alpha']!=='-64'||args['-beta']!=='64')throw Error('Native transcript settings mismatch');
   const parsed=parse(raw.stdout,requests.length,requests.map(x=>x.depth));
   for(const [i,row] of requests.entries()){
    const native=parsed[i],flip=row.normalizedPass?-1:1,bound=row.normalizedPass?(native.bound==='>'?'<':native.bound==='<'?'>':native.bound):native.bound;
    if(row.score!==flip*native.score||row.bound!==bound||row.nodes!==native.nodes||hash(row.pv)!==hash(row.normalizedPass?[null,...native.pv]:native.pv))throw Error('Transcript/accepted label mismatch');
   }
   if(hash(raw.native)!==hash(result.native))throw Error('Native accounting mismatch');
   rawHashes[name]=sha(path);nativeQueries++;
  }
  labelCosts.push({id:input.s.id,depth:input.depth,phase:input.s.phase,wallMs:result.wallMs,nativeCpuSeconds:(result.native?.userSeconds??0)+(result.native?.systemSeconds??0),nodes:result.rows.reduce((n,x)=>n+x.nodes,0),probe:name.includes('probe')});
 }
 const records=e.assessment?.records??e.partialAssessment?.records??[],H=e.selection?.h,R=e.selection?.r;
 const diagnose=rows=>{
  const gaps=rows.map(x=>x.bRegret),signs=rows.map(x=>{const a=tasks[`${x.id}-d${H}`]?.result,b=tasks[`${x.id}-d${R}`]?.result,bMove=tasks[`${x.id}-b6`]?.result.move;return {id:x.id,teacher:b?.rows.find(y=>y.move===x.choice)?.value,b:b?.rows.find(y=>y.move===bMove)?.value,atH:a?.rows.find(y=>y.move===x.choice)?.value};});
  return {summary:summarize(rows),meanInterval95:reportBootstrap(rows),bMinusTeacherRegretInterval95:reportBootstrap(rows,r=>r.bRegret-r.regret),bRegret:distribution(gaps),bAtLeast2:gaps.filter(x=>x>=2).length,bAtLeast4:gaps.filter(x=>x>=4).length,bAtLeast8:gaps.filter(x=>x>=8).length,bLargeInterval95:wilson(gaps.filter(x=>x>=4).length,rows.length),bEstimatedRobustSignChanges:signs.filter(x=>x.teacher>=2&&x.b<=-2),teacherSignErrors:rows.filter(x=>x.signError).map(x=>x.id),majorReversals:rows.filter(x=>x.reversal).map(x=>x.id),odd:distribution(rows.map(x=>x.oddRegret).filter(x=>x!==null)),pairGaps:rows.reduce((out,x)=>{for(const [bin,s] of Object.entries(x.gapBins)){const t=out[bin]??={n:0,changeSum:0,signReversals:0};for(const k of Object.keys(t))t[k]+=s[k];}return out;},{})};
 };
 const exactRows=(e.exactDetails??[]).map(x=>{
  const root=reservation.roles['exact-assessment'].find(s=>s.id===x.id),b=tasks[`${x.id}-b6`].result.move;
  return {id:x.id,empty:x.empty,conventions:Object.fromEntries(['raw','awarded'].map(c=>{const ref=x[c],choices={B6:b,...Object.fromEntries(Object.keys(x.measures).map(d=>[`D${d}`,tasks[`${x.id}-d${d}`].result.rows.reduce((a,y)=>y.value>a.value||y.value===a.value&&y.move<a.move?y:a).move]))};return [c,{best:ref.value,choices:Object.fromEntries(Object.entries(choices).map(([name,move])=>{const value=ref.rows.find(y=>y.move===move).value;return [name,{move,value,regret:ref.value-value,wdl:wdl(ref.value,value)}];}))}];})),alternatives:legalMoves(root.board,root.player).length};
 });
 const rejectedNativeCpuSeconds=(e.rejectedQueries??[]).reduce((n,r)=>n+(r.transcript.native?.userSeconds??0)+(r.transcript.native?.systemSeconds??0),0);
 const resources=readFileSync(`${output}/resource-history.jsonl`,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse),nativeCpu=e.resources.nativeCpuSeconds+rejectedNativeCpuSeconds,node=e.resources.nodeCpuTotal??e.resources.nodeCpu,nodeCpu=(node.user+node.system)/1e6;
 const selected=e.selection?.forecast??null,actualAssessment=e.stageElapsed?.assessment??null,actualExact=e.stageElapsed?.exact??null;
 const assessmentId=id=>id.startsWith('assessment-')||id.startsWith('exact-assessment-'),recordedSerialMs=labelCosts.filter(x=>assessmentId(x.id)).reduce((n,x)=>n+x.wallMs,0)+Object.entries(tasks).filter(([id])=>assessmentId(id)&&id.endsWith('-b6')).reduce((n,[,r])=>n+r.result.elapsedMs,0)+(e.exactDetails??[]).reduce((n,x)=>n+x.wallMs,0);
 e.v4Audit={passed:true,deterministicSourcePolicyReplay:true,originalPreparation:prepared,prelaunch:before,prelaunchSha256:sha(prelaunch),nativeQueries,alternatives,terminalAlternatives,passAlternatives,rawHashes,trajectoryHashes:prepared.trajectoryHashes,reservationReceiptSha256:sha(`${output}/tasks/reservation.json`),preflightSha256:sha(m.adapterPreflightPath),originalProduction: Object.fromEntries(readdirSync(`${output}/source/src`).filter(n=>n.endsWith('.js')).map(n=>{const frozen=sha(`${output}/source/src/${n}`),current=sha(resolve(fileURLToPath(new URL('../..',import.meta.url)),'src',n));if(frozen!==current)throw Error('Production source changed');return [n,frozen];}))};
 e.completion={calibration:Object.fromEntries([10,12,14,16].map(d=>[d,reservation.roles.cost.filter(s=>tasks[`${s.id}-d${d}`]).length])),oddCalibration:reservation.roles.cost.filter(s=>tasks[`${s.id}-d13`]).length,exactCalibration:e.completedExactCost.length,reliability:records.length,oddAssessment:records.filter(x=>x.oddRegret!==null).length,exactAssessment:exactRows.length,selectionFrozen:!!tasks['selection-freeze']};
 e.diagnostics={bootstrap:{method:'10,000 stratified root resamples with replacement; full-uint32 scaled index; seed 91845',frozenRunnerInterval:e.assessment?.meanInterval95??null,reportingCorrection:'Frozen LCG modulo 32 sampled permutations, not bootstrap replicates; corrected reporting only, no native result or gate changed'},primarySolvedCoverage:H?{teacherTerminalDepth:reservation.roles.assessment.filter(s=>64-s.occupied<=H).length,referenceTerminalDepth:reservation.roles.assessment.filter(s=>64-s.occupied<=R).length,interpretation:'Terminal-reaching native horizons in the primary sample; independently verified exact anchors are the separate exact assessment'}:null,pooled:diagnose(records),early:diagnose(records.filter(x=>x.phase<2)),byPhase:[0,1,2,3].map(p=>diagnose(records.filter(x=>x.phase===p))),byPolicy:Object.fromEntries(['B1-12%','B4-2%'].map(p=>[p,diagnose(records.filter(x=>x.policy===p))])),exactChoices:exactRows,labelCosts,forecast:{selected,recordedSerialMs,actualAssessmentMs:actualAssessment,actualExactMs:actualExact,actualRemainingWorkMs:actualAssessment===null||actualExact===null?null:actualAssessment+actualExact,definition:'Frozen serial conservative forecast versus observed stage elapsed with measured concurrency; no claim that these are equal workloads'},processing:{nativeCpuSeconds:nativeCpu,acceptedNativeCpuSeconds:e.resources.nativeCpuSeconds,rejectedNativeCpuSeconds,nodeProcessCpuSeconds:nodeCpu,trackedCpuSeconds:nativeCpu+nodeCpu,trackedCoreHours:(nativeCpu+nodeCpu)/3600,trackedAverageCores:(nativeCpu+nodeCpu)/(e.elapsedMs/1000),resourceSamples:resources.length,limitingGiB:{min:Math.min(...resources.map(x=>x.limitingAvailableGiB)),max:Math.max(...resources.map(x=>x.limitingAvailableGiB))},windowsCpuMax:Math.max(...resources.map(x=>x.windows?.cpuPercent??0)),linuxBusyMax:Math.max(...resources.map(x=>x.cpuBusy??0)),swapPagesPerSecondMax:Math.max(...resources.map(x=>x.swapPagesInOutPerSecond??0))}};
 return e;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [output,destination,prelaunch]=process.argv.slice(2),root=fileURLToPath(new URL('../..',import.meta.url)),e=await publishV4(resolve(output),`${root}/docs/data/edax-bound-resolution-20261028.json`,resolve(prelaunch));atomic(resolve(destination),e);console.log(JSON.stringify({status:e.status,qualified:e.qualified,gates:e.gates,audit:e.v4Audit.passed,queries:e.v4Audit.nativeQueries,processing:e.diagnostics.processing}));
}
