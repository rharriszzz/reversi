#!/usr/bin/env node
import {existsSync,mkdirSync,appendFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {Worker} from 'node:worker_threads';
import {freemem,uptime} from 'node:os';
import {identity,alternatives} from './edax.mjs';
import {validate} from './validate.mjs';
import {reserveData} from './qualification-data.mjs';
import {PROTOCOL,hash,receipt,writerLock,parallel,compare,calibrationPass,quantile,mean,feasible,assessGates,summarize,bootstrapMean,tops,exactCalibration,recoveryCharge} from './qualification-core.mjs';
import {atomic,read,sourceDigest} from '../research/io.mjs';
import {QualificationProgress as Progress} from './qualification-progress.mjs';
import {Profiler} from '../strong/telemetry.mjs';
import {findBestMove} from '../../src/search.js';
import {legalMovesFast} from '../../src/fast-features.js';
import {legalMoves,play,counts} from '../../src/rules.js';
export function replay(state,result){for(const row of result.rows){let board=row.move===null?state.board:[...play(state.board,state.player,row.move)],player=row.move===null?state.player:-state.player;for(const m of row.pv??[]){if(m===null){if(legalMoves(board,player).length||!legalMoves(board,-player).length)throw Error('Invalid PV pass');}else{if(!legalMoves(board,player).includes(m))throw Error('Invalid PV move');board=[...play(board,player,m)];}player=-player;}}}
export async function main(argv=process.argv.slice(2)){
 const args={};for(let i=0;i<argv.length;i+=2){if(!['--output','--repository','--mode'].includes(argv[i])||!argv[i+1])throw Error('Invalid qualification arguments');args[argv[i].slice(2)]=argv[i+1];}
 const output=resolve(args.output),repository=resolve(args.repository??'.'),mode=args.mode??'full';if(!['full','calibration'].includes(mode))throw Error('Invalid mode');mkdirSync(output,{recursive:true});
 const frozen=sourceDigest(fileURLToPath(new URL('../..',import.meta.url))),pin=identity(`${repository}/.local-research/teacher/edax/bin/lEdax-x86-64-v3`,`${repository}/.local-research/teacher/edax/bin/data/eval.dat`),protocol={...PROTOCOL,mode};
 const runIdentity=hash({frozen,pin,protocol});let state=existsSync(`${output}/manifest.json`)?read(`${output}/manifest.json`):{version:1,status:'created',source:frozen,pin,protocol,runIdentity,elapsedMs:read(`${output}/preflight.json`).preflightMs??0,stageElapsed:{},nativeCpuSeconds:0,nativeMaxRssBytes:0,nativeNodes:0,completedTasks:0};
 if(state.runIdentity!==runIdentity)throw Error('Frozen source/protocol/teacher mismatch');
 if(state.status==='stopped'&&state.error&&!state.error.includes('Interrupted;'))throw Error('Required work failed; this stopped experiment cannot be retried automatically');
 if(['complete','failed-gates','calibration-rejected','calibration-only','infeasible'].includes(state.status)){console.log('Qualification already finished; no computation repeated.');return;}
 atomic(`${output}/protocol.json`,{protocol,runIdentity,frozen,pin});
 let bootId=null;try{bootId=readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim();}catch{}
 const unlock=writerLock(`${output}/writer.lock`),start=performance.now(),prior=state.elapsedMs+recoveryCharge(state,uptime()*1000,bootId)+(state.status!=='created'?(read(`${output}/preflight.json`).preflightMs??0):0),progress=new Progress(output),profiler=new Profiler();let currentStage=null,stageStart=start,stagePrior=0,stop=false,finished=false,workers=Math.min(2,read(`${output}/preflight.json`).workers),active=new Map(),lastResource=0;const durations=[];
 const elapsed=()=>prior+performance.now()-start,stageElapsed=()=>stagePrior+performance.now()-stageStart;
 const checkpoint=()=>{state.elapsedMs=elapsed();if(currentStage)state.stageElapsed[currentStage]=stageElapsed();state.updated=new Date().toISOString();state.bootId=bootId;state.heartbeatBootMs=uptime()*1000;state.pid=process.pid;state.nodeCpu=process.cpuUsage();state.nodeMaxRssBytes=process.resourceUsage().maxRSS*1024;state.profile=profiler.snapshot();atomic(`${output}/manifest.json`,state);progress.update({checkpoint:state.updated,nativeCpuSeconds:state.nativeCpuSeconds,nativeMaxRssMiB:state.nativeMaxRssBytes/2**20,activeQueries:[...active.values()].map(x=>({...x,elapsedSeconds:(performance.now()-x.start)/1000}))});};
 const check=()=>{if(stop)throw Error('Interrupted; completed receipts preserved');const cap=mode==='full'?protocol.capMs:protocol.calibrationOnlyCapMs;
  if(elapsed()>cap-(currentStage==='reporting'?0:mode==='full'?protocol.reportReserveMs:60000))throw Error('Total active-time cap; reporting reserve protected');
  if(currentStage&&protocol.stageCaps[currentStage]&&stageElapsed()>protocol.stageCaps[currentStage])throw Error(`Stage cap: ${currentStage}`);
 };
 const stage=name=>{checkpoint();currentStage=name;stageStart=performance.now();stagePrior=state.stageElapsed[name]??0;state.stage=name;progress.set({stage:name,substage:'bounded-qualification',task:'initializing',completed:0,total:undefined});checkpoint();check();};
 const monitor=setInterval(()=>{checkpoint();const queries=[...active.values()].map(x=>`${x.id} D${x.depth} age=${((performance.now()-x.start)/1000).toFixed(1)}s`).join(', ');progress.update({task:queries||state.stage,note:`native CPU completed=${state.nativeCpuSeconds.toFixed(1)}s; native max RSS=${(state.nativeMaxRssBytes/2**20).toFixed(1)}MiB; workers=${workers}`});},5000);
 process.on('SIGTERM',()=>{stop=true;});process.on('SIGINT',()=>{stop=true;});
 async function resourceCheck(){if(performance.now()-lastResource<60000&&lastResource)return;const p=spawnSync('python3',[fileURLToPath(new URL('./qualification-launch.py',import.meta.url)),'--output',output,'--resources-only'],{encoding:'utf8',timeout:35000});if(p.status!==0)throw Error(`Resource recheck failed ${p.stderr}`);const r=JSON.parse(p.stdout);progress.update({hostCpu:`${(100*Math.max(r.cpuBusy??0,(r.windows?.cpuPercent??0)/100)).toFixed(1)}%`});appendFileSync(`${output}/resource-history.jsonl`,JSON.stringify(r)+'\n');if(r.blockers.length)throw Error(`Interrupted; resource stop ${r.blockers.join('; ')}`);const oldWorkers=workers;workers=Math.min(workers,r.workers);if(workers<oldWorkers)throw Error('Interrupted; resource concurrency cap decreased; resume drains to safe worker count');if(r.limitingAvailableGiB<1.5+.6*workers)throw Error('Interrupted; resource stop: headroom reserve');lastResource=performance.now();checkpoint();}
 async function task(name,input,fn){const path=`${output}/tasks/${name}.json`,existed=existsSync(path),t=performance.now();const result=await receipt(path,input,runIdentity,async()=>{check();return fn();});if(!existed){state.completedTasks++;durations.push(performance.now()-t);progress.update({durations:`last=${((performance.now()-t)/1000).toFixed(2)}s median=${(quantile(durations,.5)/1000).toFixed(2)}s max=${(Math.max(...durations)/1000).toFixed(2)}s`});checkpoint();}return result;}
 async function label(s,depth,suffix=''){
  return task(`${s.id}-d${depth}${suffix}`,{s,depth,pin},async()=>{await resourceCheck();check();const name=`${s.id}/D${depth}${suffix}`;active.set(name,{id:s.id,depth,start:performance.now()});progress.update({task:name});const remaining=Math.min((mode==='full'?protocol.capMs-protocol.reportReserveMs:protocol.calibrationOnlyCapMs-60000)-elapsed(),protocol.stageCaps[currentStage]-stageElapsed());
   try{const result=await alternatives(pin,s,depth,{measureNative:true,timeoutMs:Math.max(1,Math.min(protocol.queryCapMs,remaining)),transcript:`${output}/raw/${s.id}-d${depth}${suffix}.json`});replay(s,result);state.nativeCpuSeconds+=(result.native?.userSeconds??0)+(result.native?.systemSeconds??0);state.nativeMaxRssBytes=Math.max(state.nativeMaxRssBytes,result.native?.maxRssBytes??0);state.nativeNodes+=result.rows.reduce((n,r)=>n+r.nodes,0);return {...result,valueKind:depth>=counts(s.board).empty?'terminal minimax under awarded-empty convention':'horizon-limited estimated Edax discs'};}finally{active.delete(name);}
  });
 }
 const bChoice=s=>task(`${s.id}-b6`,{s,depth:6},async()=>{check();return findBestMove(s.board,s.player,6,undefined,{legalMoves:legalMovesFast});});
 async function exact(s){const independent=await task(`${s.id}-independent`,{s,capMs:protocol.exactCapMs},()=>new Promise((ok,bad)=>{const w=new Worker(new URL('./qualification-exact.mjs',import.meta.url),{workerData:{state:s,capMs:protocol.exactCapMs}}),timer=setTimeout(()=>{w.terminate();bad(Error('Independent exact worker cap'));},protocol.exactCapMs+1000);w.once('error',e=>{clearTimeout(timer);bad(e);});w.once('message',r=>{clearTimeout(timer);if(r.error){atomic(`${output}/failed-tasks/${s.id}-independent.json`,{input:{s,capMs:protocol.exactCapMs},runIdentity,result:r});bad(Error(`Independent reference ${s.id}: ${r.error}`));}else ok(r);});}));
  const labels={};for(const d of [6,8,...(s.occupied===52?[10]:[]),64-s.occupied])labels[d]=await label(s,d);
  const reference=independent.awarded,full=labels[64-s.occupied];if(full.rows.length!==reference.rows.length||full.rows.some(r=>r.value!==reference.rows.find(x=>x.move===r.move)?.value))throw Error('Independent exact alternative mismatch');
  const measures={};for(const d of [6,8,...(s.occupied===52?[10]:[])]){const m=compare(labels[d],{rows:reference.rows});const chosen=reference.rows.find(x=>x.move===m.choice).value;m.wdlError=Math.sign(chosen)<Math.sign(reference.value);m.rawWdlError=Math.sign(independent.raw.rows.find(x=>x.move===m.choice).value)<Math.sign(independent.raw.value);measures[d]=m;}
  const b=await bChoice(s);return {id:s.id,empty:64-s.occupied,independent,measures,b,labels};
 }
 try{state.status='running';checkpoint();stage('admission');await resourceCheck();state.validation=await task('validation',{pin},()=>validate(pin,output));
  const reservation=await task('reservation',{protocol},()=>reserveData(repository,output,check,(attempts,n)=>{progress.update({positions:n,completed:n,total:352,task:`admission attempt ${attempts}`});checkpoint();}));global.gc?.();state.reservationDigest=reservation.digest;state.reservationImport={...reservation.import,newSource:frozen,newProtocol:protocol,newRunIdentity:runIdentity};checkpoint();progress.update({positions:352,completed:352,total:352,task:'320 imported + 32 fresh reservations verified'});progress.emit('reservations-verified',{imported:320,fresh:32});
  const cost=reservation.roles.cost,cal=existsSync(`${output}/calibration-labels.json`)?read(`${output}/calibration-labels.json`):{};let completed=0;
  if(!state.selection && !state.calibration){stage('calibration');
  progress.update({total:72+8,task:'D10/D12/D14 balanced batches',eta:undefined});
  // Serial/parallel matched D10 probes measure actual concurrency benefit. They remain cost-only receipts.
  state.concurrency=await task('concurrency',{roots:cost.filter((_,i)=>i%6<2),workers},async()=>{const roots=cost.filter((_,i)=>i%6<2);await resourceCheck();const partial=roots.some(s=>existsSync(`${output}/tasks/${s.id}-d10-serial-probe.json`)||existsSync(`${output}/tasks/${s.id}-d10-parallel-probe.json`));let serialMs=0;for(const s of roots){const result=await label(s,10,'-serial-probe');serialMs+=result.wallMs;}const t=performance.now();await parallel(roots,workers,s=>label(s,10,'-parallel-probe'));const parallelMs=performance.now()-t;return {roots:roots.length,workers,serialMs,parallelMs,partialRecovery:partial,speedup:partial?1:serialMs/parallelMs};});
  if(state.concurrency.speedup<1.10)workers=1;state.workers=workers;progress.emit('concurrency-measured',state.concurrency);
  for(let batch=0;batch<3;batch++){const indices=[0,1,2,3].flatMap(p=>[p*6+batch*2,p*6+batch*2+1]);for(const d of protocol.depths){await parallel(indices,workers,async i=>{const r=await label(cost[i],d);(cal[cost[i].id]??={})[d]=r;progress.update({completed:++completed,positions:completed,task:`cost ${cost[i].id} D${d}`});});progress.emit('cost-batch-completed',{batch,depth:d});}}
  const oddCost=cost.filter((_,i)=>i%6<2);progress.set({stage:'calibration',substage:'fixed-D13',task:'predetermined odd-depth roots',total:8});let oddCompleted=0;for(const s of oddCost){(cal[s.id]??={})[13]=await label(s,13);progress.update({completed:++oddCompleted});}
  progress.set({stage:'calibration',substage:'independent-exact',task:'both conventions plus Edax D6/D8/D10/exact',total:8});let exactCompleted=0;state.exactCost=await parallel(reservation.roles['exact-cost'],workers,async s=>{const result=await exact(s);progress.update({completed:++exactCompleted});return result;});checkpoint();
  const comparisons=(h,r)=>cost.map(s=>({...compare(cal[s.id][h],cal[s.id][r]),phase:s.phase,policy:s.policy}));
  // D16 is optional only when ALL 24 searches plus allowance fit the calibration stage.
  const costSum=d=>cost.reduce((n,s)=>n+cal[s.id][d].wallMs,0),growth=Math.max(1,costSum(14)/costSum(12)),d16Forecast=costSum(14)*growth;state.d16Decision={growth,forecastSerialMs:d16Forecast,remainingCalibrationMs:protocol.stageCaps.calibration-stageElapsed(),attempted:protocol.allowance*d16Forecast<protocol.stageCaps.calibration-stageElapsed()};
  progress.emit('optional-d16-decision',state.d16Decision);if(state.d16Decision.attempted){progress.set({stage:'calibration',substage:'optional-D16',task:'all 24 predetermined roots D16',total:24});let d16Completed=0;await parallel(cost,workers,async s=>{cal[s.id][16]=await label(s,16);progress.update({completed:++d16Completed});});}
  let b6Ms=0;for(const s of cost)b6Ms+=(await bChoice(s)).elapsedMs;state.costB6Ms=b6Ms;
  state.calibration={depths:state.d16Decision.attempted?[10,12,14,16]:[10,12,14],pairs:[...[[10,12],[12,14]],...(state.d16Decision.attempted?[[14,16]]:[])].map(([h,r])=>({h,r,pass:calibrationPass(comparisons(h,r)),summary:summarize(comparisons(h,r))})),odd:oddCost.map(s=>({id:s.id,...compare(cal[s.id][12],cal[s.id][13])})),cost:cost.map(s=>({id:s.id,phase:s.phase,policy:s.policy,depths:Object.fromEntries(Object.entries(cal[s.id]).map(([d,v])=>[d,{wallMs:v.wallMs,native:v.native,nodes:v.rows.reduce((a,x)=>a+x.nodes,0)}]))}))};
  atomic(`${output}/calibration-labels.json`,cal);checkpoint();
  }
  const candidates=[];for(const p of state.calibration.pairs){if(!p.pass)continue;
   // Conservative serial forecast: max of slowest balanced batch and phase p95 sums; no assumed parallel speedup.
   const perRoot=cost.map(s=>cal[s.id][p.h].wallMs+cal[s.id][p.r].wallMs),slowBatch=Math.max(...[0,1,2].map(b=>mean(perRoot.filter((_,i)=>Math.floor((i%6)/2)===b)))),phaseForecast=[0,1,2,3].reduce((n,phase)=>n+64*quantile(perRoot.filter((_,i)=>cost[i].phase===phase),.95),0);
   const oddMs=32*Math.max(...cost.map(s=>cal[s.id][p.r].wallMs)),bMs=state.costB6Ms/24*256,exactMs=64*Math.max(...state.exactCost.map(r=>r.independent.wallMs+Object.values(r.labels).reduce((n,x)=>n+x.wallMs,0)))+64000;
   const assessmentMs=Math.max(256*slowBatch,phaseForecast)+oddMs+bMs+256*20,forecastMs=assessmentMs+exactMs;
   const fits=assessmentMs*protocol.allowance<=protocol.stageCaps.assessment&&exactMs*protocol.allowance<=protocol.stageCaps.exact&&feasible(elapsed(),forecastMs,protocol.capMs);
   candidates.push({...p,forecast:{assessmentMs,exactMs,forecastMs,allowance:1.35,reportReserveMs:1200000,fits}});
  }
  if(!existsSync(`${output}/tasks/selection-freeze.json`)){state.candidates=candidates;state.selection=candidates.find(x=>x.forecast.fits)??null;}else{state.selection=read(`${output}/tasks/selection-freeze.json`).result.selected;}checkpoint();
  if(!state.selection){state.status=state.calibration.pairs.some(x=>x.pass)?'infeasible':'calibration-rejected';}
  else if(mode==='calibration'){state.status='calibration-only';}
  else{
   // This immutable decision is committed before ANY locked teacher query.
   const selection=existsSync(`${output}/tasks/selection-freeze.json`)?read(`${output}/tasks/selection-freeze.json`).result:await task('selection-freeze',{reservationDigest:reservation.digest,candidates},async()=>({selected:state.selection,at:new Date().toISOString(),elapsedMs:elapsed()}));state.selection=selection.selected;const {h,r}=state.selection;progress.update({overallEta:`forecast ${(state.selection.forecast.forecastMs/60000).toFixed(1)} minutes remaining work; conservative ${(1.35*state.selection.forecast.forecastMs/60000+20).toFixed(1)} including reserve`});
   stage('assessment');let assessmentCompleted=0;const records=await parallel(reservation.roles.assessment,workers,async(s,i)=>{const shallow=await label(s,h),deep=await label(s,r),b=await bChoice(s),odd=reservation.import.oddIds.includes(s.id)?await label(s,h+1):null;const result={id:s.id,phase:s.phase,policy:s.policy,...compare(shallow,deep,b.move),oddRegret:odd?Math.max(compare(shallow,odd,b.move).regret,compare(shallow,deep,b.move).regret):null};progress.update({completed:++assessmentCompleted,positions:assessmentCompleted,total:256});if(i%8===0)progress.emit('assessment-batch');return result;});state.assessment={records,summary:summarize(records),meanInterval95:bootstrapMean(records),byPhase:[0,1,2,3].map(p=>summarize(records.filter(x=>x.phase===p))),byPolicy:Object.fromEntries(['B1-12%','B4-2%'].map(p=>[p,summarize(records.filter(x=>x.policy===p))]))};checkpoint();
   stage('exact');progress.update({substage:'independent-both-conventions',total:64});let exactCompleted=0;state.exactAssessment=await parallel(reservation.roles['exact-assessment'],workers,async s=>{const result=await exact(s);progress.update({completed:++exactCompleted});return result;});
   const exactResult=exactCalibration(state.exactAssessment);state.exactGroups=exactResult.groups;const exactOK=exactResult.pass;state.gates=assessGates(records,records.map(x=>x.oddRegret).filter(x=>x!==null),exactOK);state.qualified=Object.values(state.gates).every(Boolean);state.status=state.qualified?'complete':'failed-gates';
  }
  finished=true;
 }catch(error){state.status='stopped';state.resumable=error.message.startsWith('Interrupted;');state.error=error.stack;atomic(`${output}/failure-${Date.now()}.json`,{error:error.stack,stage:currentStage,elapsedMs:elapsed(),active:[...active.values()]});process.exitCode=1;}
 finally{checkpoint();clearInterval(monitor);progress.emit('qualification-finished',{status:state.status,qualified:state.qualified??false});progress.close();profiler.close();unlock();atomic(`${output}/results.json`,{...state,finished,reportingRemainingMs:protocol.capMs-elapsed()});console.log(JSON.stringify({status:state.status,qualified:state.qualified??false,selection:state.selection,gates:state.gates,elapsedMs:elapsed()}));}
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1;});
