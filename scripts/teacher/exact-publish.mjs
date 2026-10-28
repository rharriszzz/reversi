#!/usr/bin/env node
// Audit immutable engineering receipts; never runs a search or changes old experiments.
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {read,atomic,sourceDigest} from '../research/io.mjs';
import {hash,quantile,mean} from './qualification-core.mjs';
import {oracleChildren} from '../../tests/oracle.mjs';
import {replay} from './qualification.mjs';
const output=resolve(process.argv[2]),destination=resolve(process.argv[3]),run=read(`${output}/results.json`);
if(run.status!=='complete'||run.results.length!==44)throw Error('Incomplete engineering benchmark');
if(sourceDigest(`${output}/source`)!==run.source)throw Error('Benchmark source snapshot mismatch');
const identity=hash({protocol:run.protocol,pin:run.pin,source:run.source});if(identity!==run.runIdentity)throw Error('Run identity mismatch');
const receiptHashes={};for(const name of readdirSync(`${output}/tasks`)){
 const text=readFileSync(`${output}/tasks/${name}`,'utf8'),r=JSON.parse(text);if(r.inputHash!==hash({input:r.input,runIdentity:identity}))throw Error(`Receipt mismatch ${name}`);receiptHashes[name]=hash(text);
}
const median=xs=>{if(!xs.length)return null;const s=[...xs].sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
const bare=r=>r.rows.map(({move,value})=>[move,value||0]),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
let alternatives=0,originalComplete=0;
for(const row of run.results){
 const s=row.trials.optimized.state,legal=oracleChildren(s.board,s.player).map(x=>x.move),o=row.trials.optimized.result;
 if(!o||row.trials.optimized.error||row.trials.optimized.wallMs>=10000)throw Error('Optimized incomplete/capped');
 for(const k of ['awarded','raw']){if(!o[k].exact||!same(o[k].rows.map(x=>x.move),legal)||o[k].value!==Math.max(...o[k].rows.map(x=>x.value)))throw Error('Exact coverage/value mismatch');}
 if(!same(bare(o.awarded),bare(row.edax)))throw Error('Edax mismatch');replay(s,row.edax);alternatives+=legal.length;
 const original=row.trials.original;
 if(original.result){originalComplete++;for(const k of ['awarded','raw'])if(!same(bare(original.result[k]),bare(o[k])))throw Error('Original equivalence mismatch');}
 const receipt=read(`${output}/tasks/${s.id}-optimized.json`).result;if(!same(receipt,row.trials.optimized))throw Error('Published worker mismatch');
 const originalReceipt=read(`${output}/tasks/${s.id}-original.json`).result;if(!same(originalReceipt,row.trials.original))throw Error('Published original worker mismatch');
 const teacherReceipt=read(`${output}/tasks/${s.id}-edax.json`).result;if(!same(teacherReceipt,row.edax))throw Error('Published native mismatch');
}
for(const a of [...run.ablations,...run.repeats])if(a.result){const expected=run.results.find(x=>x.id===a.state.id).trials.optimized.result;for(const k of ['raw','awarded'])if(!same(bare(a.result[k]),bare(expected[k])))throw Error('Ablation/repetition changed exact values');}
const groups=[8,10,12].map(empty=>{
 const rows=run.results.filter(x=>x.id.startsWith('fresh-')&&x.empty===empty),complete=rows.filter(x=>x.trials.original.result),speedups=complete.map(x=>x.trials.original.wallMs/x.trials.optimized.wallMs);
 const stats=kind=>{const xs=rows.map(x=>x.trials[kind]),done=xs.filter(x=>x.result);return {n:xs.length,complete:done.length,wallMeanMs:mean(xs.map(x=>x.wallMs)),wallMedianMs:median(xs.map(x=>x.wallMs)),wallMaxMs:Math.max(...xs.map(x=>x.wallMs)),cpuTotalMs:xs.reduce((n,x)=>n+x.cpuMs,0),maxRssKiB:Math.max(...xs.map(x=>x.resource.maxRSS)),completedNodeMedian:median(done.map(x=>x.result.raw.nodes+x.result.awarded.nodes)),completedNodeSum:done.reduce((n,x)=>n+x.result.raw.nodes+x.result.awarded.nodes,0),rawWallMedianMs:median(done.map(x=>x.result.raw.wallMs??x.result.traces?.find(t=>!t.awarded)?.wallMs)),awardedWallMedianMs:median(done.map(x=>x.result.awarded.wallMs??x.result.traces?.find(t=>t.awarded)?.wallMs))};};
 return {empty,original:stats('original'),optimized:stats('optimized'),completedPairs:complete.length,medianPairedSpeedup:median(speedups),censoredOriginal:rows.filter(x=>!x.trials.original.result).map(x=>x.id)};
});
const ablations=[];for(const tt of [false,true])for(const ordering of [false,true]){
 const rows=run.ablations.filter(x=>x.options.useTT===tt&&x.options.ordering===ordering);ablations.push({tt,ordering,n:rows.length,wallMs:rows.reduce((n,x)=>n+x.wallMs,0),nodes:rows.reduce((n,x)=>n+(x.result?.raw.nodes??0)+(x.result?.awarded.nodes??0),0),timeouts:rows.filter(x=>!x.result).length});
}
const preserved=read('.local-research/exact-optimization-20261028/stopped-qualification-hashes.json');for(const [path,sha] of Object.entries(preserved)){const raw=readFileSync(`.local-research/teacher-qualification-v2-20261028/${path}`);if(createHash('sha256').update(raw).digest('hex')!==sha)throw Error(`Stopped run changed: ${path}`);}
const difficult=run.results.find(x=>x.id==='disclosed-exact-cost-5'),repeats=run.repeats.filter(x=>x.state.id===difficult.id);
const compact={version:1,scope:'engineering benchmarks; no teacher qualification or training',protocol:run.protocol,source:run.source,runIdentity:run.runIdentity,pin:run.pin,elapsedMs:run.elapsedMs,admission:{attempts:run.inputs.attempts,exclusions:run.inputs.exclusions},groups,ablations,difficult:{state:difficult.trials.optimized.state,original:difficult.trials.original,optimized:difficult.trials.optimized,repeatWallMs:repeats.map(x=>x.wallMs)},checks:{roots:44,freshRoots:36,originalCompleted:originalComplete,originalCapped:44-originalComplete,edaxAlternatives:alternatives,oldQualificationFilesPreserved:Object.keys(preserved).length,lockedAssessmentQueries:0},rows:run.results.map(x=>({id:x.id,empty:x.empty,seed:x.seed,state:x.trials.optimized.state,original:{wallMs:x.trials.original.wallMs,cpuMs:x.trials.original.cpuMs,error:x.trials.original.error,nodes:x.trials.original.result?x.trials.original.result.raw.nodes+x.trials.original.result.awarded.nodes:null,maxRssKiB:x.trials.original.resource.maxRSS},optimized:x.trials.optimized,edax:x.edax.rows.map(({move,value})=>({move,value}))})),receiptHashes};
const profilePath='.local-research/exact-optimization-20261028/profile-stratified/profile.json';if(existsSync(profilePath)){const raw=readFileSync(profilePath,'utf8');compact.profiling={sha256:hash(raw),note:'Instrumented counters cumulative within each root; first (raw) record is per-convention',rows:JSON.parse(raw).map(x=>({id:x.id,awarded:x.awarded,wallMs:x.wallMs,cpuMs:x.cpuMs,error:x.error,stats:x.stats}))};}
atomic(destination,compact);console.log(JSON.stringify({checks:compact.checks,groups:groups.map(x=>({empty:x.empty,speedup:x.medianPairedSpeedup,maxOptimizedMs:x.optimized.wallMaxMs})),elapsedMs:run.elapsedMs}));
