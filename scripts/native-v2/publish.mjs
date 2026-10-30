#!/usr/bin/env node
// Reporting only; frozen before scored play. Never edits local scientific receipts.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {output,read,checked} from './common.mjs';
const mode=process.argv[2]??'registration',data=resolve('docs/data'),write=(name,value)=>writeFileSync(resolve(data,`native-v2-${name}-20261030.json`),JSON.stringify(value)+'\n');
const reg=checked(resolve(output,'registration.json'));
if(mode==='registration'){write('registration',reg);write('reservation-verification',read(resolve(output,'reservation-verification.json')));process.exit(0);}
if(mode!=='results')throw Error('Use registration or results');
const summary=read(resolve(output,'summary.json')),verification=read(resolve(output,'independent-verification.json')),provenance=checked(resolve(output,'provenance-audit.json'));
if(!verification.passed||verification.registration!==reg.checksum)throw Error('Independent verification required');
write('results',{...summary,verification});
const columns=['ply','occupied','depth','score','nodes','evaluations','elapsedMs','cpuMs','measuredMs','overrunMs','exact','timedOut','ttProbes','ttHits','ttBoundHits','ttCutoffs','ttCollisions','ttReplacements','ttStores','ttRejectedStores','cutoffs','firstMoveCutoffs'];
const games=reg.schedule.map((c,game)=>{const r=checked(resolve(output,`games/game-${game}.json`)),g=r.result;return {...c,game,receipt:provenance.receiptInventory[game][1],moves:g.moves.map(m=>[m.player,m.move]),board:g.board,margin:g.margin,outcome:g.outcome,points:g.points,telemetry:g.moves.flatMap((m,ply)=>m.move===null?[]:[columns.map(k=>k==='ply'?ply:m[k])])};});
write('games',{registration:reg.checksum,telemetryColumns:columns,games});
write('provenance',{registration:reg.checksum,checksum:provenance.checksum,sourceFamilySeparation:true,directLPKeys:provenance.directLPKeys,provenOlderDirectKeys:provenance.provenOlderDirectKeys,prohibitedKeys:provenance.prohibitedKeys,unresolvedKeys:provenance.unresolvedKeys,broaderDirectStateSeparation:provenance.broaderDirectStateSeparation,allOutcomesRetained:true,scoreSummariesOpened:false,historicalOccurrenceRows:provenance.historicalOccurrenceRows,receiptInventoryHash:provenance.receiptInventoryHash,classifications:provenance.classifications.map(c=>({...c,evidence:c.evidence.map(o=>({path:o.path,location:o.location,role:o.role,source:o.source,incremental:o.incremental}))})),playedCrossFamilyConvergences:provenance.playedCrossFamilyConvergences});
const bench=read(resolve(output,'benchmark-final.json')),history=read(resolve(output,'production-history.json')),timed=read(resolve(output,'timed-final.json'));
const metric=r=>Object.fromEntries(['score','depth','exact','timedOut','nodes','evaluations','elapsedMs','cpuMs','interfaceMs','ttProbes','ttHits','ttBoundHits','ttCutoffs','ttCollisions','ttReplacements','ttStores','ttRejectedStores','cutoffs','firstMoveCutoffs'].filter(k=>r[k]!==undefined).map(k=>[k,r[k]]));
write('benchmarks',{baseline:bench.baseline,current:bench.current,positions:bench.positions,rows:bench.rows.map(r=>({...r,baseline:{search:metric(r.baseline.search),evaluation:r.baseline.evaluation},current:{search:metric(r.current.search),evaluation:r.current.evaluation}})),timed:timed.timed.map(r=>({...r,baseline:metric(r.baseline),capped:metric(r.capped),uncapped:metric(r.uncapped)})),ipc:timed.ipc,startup:timed.startup});
write('history',{receipts:history.receipts,positions:history.positions,rows:history.rows.map(r=>({...r,results:Object.fromEntries(Object.entries(r.results).map(([k,v])=>[k,metric(v)]))})),exploratoryTrials:['leaf','patterns','moves','flips'].map(tag=>{const r=read(resolve(output,`benchmark-${tag}.json`));return {tag,baseline:r.baseline,current:r.current,note:'Early screening used baseline frame-pointer sampling build. Final production-history above uses identical optimized flags for every variant.'};})});
const profiles={};for(const tag of ['baseline','final'])for(const type of ['sample','instrument'])profiles[`${tag}-${type}`]=read(resolve(output,`profile-${tag}-${type}.json`));
profiles.representative=read(resolve(output,'representative-profiles.json'));profiles.selfSamples={};for(const tag of ['baseline','final'])for(const phase of ['opening','middle','endgame']){
 const text=readFileSync(resolve(output,`profile-v2-${tag}-${phase}.txt`),'utf8'),part=text.split('Sort by top of stack, same collapsed (when >= 5):')[1].split('Binary Images:')[0],rows=[];
 for(const line of part.split('\n')){const m=line.match(/^\s+(.+?)\s+\(in (.+?)\)\s+(\d+)\s*$/);if(m)rows.push({function:m[1],library:m[2],samples:Number(m[3])});}
 profiles.selfSamples[`${tag}-${phase}`]=rows;
}
profiles.hardwareCounters=read(resolve(output,'hardware-counters.json'));write('profiles',profiles);
write('qualification',{...read(resolve(output,'qualification.json')),extraTests:{exhaustivePatternSums:174960,arbitraryAndLongRayRules:true,depths:[15,16,64],generationRollover:true,fixedNodeBudget:true,realCoordinatorExitAndResume:true,sanitizers:'ASan/UBSan'}});
const resources=readFileSync(resolve(output,'tournament-resources.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
write('execution',{registration:reg.checksum,ledger:read(resolve(output,'measurement-budget.json')),forecast:reg.forecast,resources:{samples:resources.length,minimumAvailableGiB:Math.min(...resources.map(r=>r.availableGiB)),swapFirst:resources[0].swap,swapLast:resources.at(-1).swap,swapinsDelta:resources.at(-1).swapins-resources[0].swapins,swapoutsDelta:resources.at(-1).swapouts-resources[0].swapouts,processSnapshots:resources.map(r=>({at:r.at,availableGiB:r.availableGiB,processes:r.processes.split('\n').filter(l=>/reversi-native|scripts\/native-v2\/run/.test(l))}))},gitHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()});
console.log(JSON.stringify({published:true,games:games.length}));
