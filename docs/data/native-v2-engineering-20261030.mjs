#!/usr/bin/env node
// Rebuild compact public engineering evidence without opening scored games.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const directory=resolve(process.argv[2]??'.local-research/native-v2-20261030'),read=n=>JSON.parse(readFileSync(resolve(directory,`${n}.json`)));
const keep=r=>Object.fromEntries(['score','depth','exact','timedOut','nodes','evaluations','elapsedMs','cpuMs','interfaceMs','ttProbes','ttHits','ttBoundHits','ttCutoffs','ttCollisions','ttReplacements','ttStores','ttRejectedStores','cutoffs','firstMoveCutoffs'].filter(k=>r[k]!==undefined).map(k=>[k,r[k]]));
const b=read('benchmark-final'),h=read('production-history'),t=read('timed-final'),profiles={};
for(const tag of ['baseline','final'])for(const type of ['sample','instrument'])profiles[`${tag}-${type}`]=read(`profile-${tag}-${type}`);
profiles.representative=read('representative-profiles');profiles.selfSamples={};
for(const tag of ['baseline','final'])for(const phase of ['opening','middle','endgame']){
 const raw=readFileSync(resolve(directory,`profile-v2-${tag}-${phase}.txt`),'utf8'),section=raw.split('Sort by top of stack, same collapsed (when >= 5):')[1].split('Binary Images:')[0];
 profiles.selfSamples[`${tag}-${phase}`]=section.split('\n').flatMap(l=>{const m=l.match(/^\s+(.+?)\s+\(in (.+?)\)\s+(\d+)\s*$/);return m?[{function:m[1],library:m[2],samples:Number(m[3])}]:[];});
}
profiles.hardwareCounters=read('hardware-counters');
const result={format:'native-v2-qualified-engineering-v1',scoredOutcomesOpened:false,baseline:b.baseline,current:b.current,positions:b.positions,benchmarks:b.rows.map(r=>({...r,baseline:{search:keep(r.baseline.search),evaluation:r.baseline.evaluation},current:{search:keep(r.current.search),evaluation:r.current.evaluation}})),history:{receipts:h.receipts,rows:h.rows.map(r=>({...r,results:Object.fromEntries(Object.entries(r.results).map(([k,v])=>[k,keep(v)]))}))},timed:t.timed.map(r=>({...r,baseline:keep(r.baseline),capped:keep(r.capped),uncapped:keep(r.uncapped)})),ipc:t.ipc,startup:t.startup,profiles,qualification:read('qualification'),tests:{javascript:160,python:38,sanitizedGroups:15,exhaustivePatternSums:174960,realCoordinatorRestart:true},exploratoryNote:'Early screening against frame-pointer baseline informed candidates. Main 7-repetition comparison and all 9-repetition history variants use identical production optimization flags. Older six-empty IPC-heavy profiles and warm-history timed pilot retained locally; representative profiles use an exact-12 endgame and final timed panel resets each variant.'};
writeFileSync('docs/data/native-v2-engineering-20261030.json',JSON.stringify(result)+'\n');
console.log(JSON.stringify({written:true,positions:result.positions.length,matchedSearches:result.benchmarks.length,variantComparisons:result.history.rows.length,timed:result.timed.length}));
