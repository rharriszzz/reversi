import {readFileSync,writeFileSync} from 'node:fs';
const dir='.local-research/wasm-20261030',d=JSON.parse(readFileSync(`${dir}/native-experiment.json`));
const groups=new Map();
for(const row of d.rows)for(const [tag,r] of Object.entries(row.results)) {
 const phase=row.occupied<28?'opening':row.occupied<52?'middle':'endgame',key=`${row.rep}/${row.model}/${tag}/${phase}`;
 if(!groups.has(key))groups.set(key,{rep:row.rep,model:row.model,tag,phase,searches:0});
 const g=groups.get(key);g.searches++;
 for(const k of ['elapsedMs','cpuMs','nodes','evaluations','ttProbes','ttHits','ttBoundHits','ttCollisions','ttReplacements','ttCutoffs','ttStores','ttRejectedStores','cutoffs'])g[k]=(g[k]??0)+r[k];
 g.tableBytes=r.tableBytes;
}
const receipts=Object.fromEntries(Object.entries(d.receipts).map(([tag,r])=>[tag,{...r,sourceHashes:{'native/engine.cpp':r.sourceSha256,'native/engine.hpp':r.sourceHashes['native/engine.hpp'],'native/main.cpp':r.sourceHashes['native/main.cpp']}}]));
writeFileSync('docs/data/native-final-experiments-20261030.json',JSON.stringify({baselineCommit:'2492932',decision:'Revert both candidates: no useful performance benefit',repetitions:9,positions:d.positions,receipts,groups:[...groups.values()],correctness:{tolerance:0,matchedSearches:d.rows.length,candidateSanitizerGroups:15,candidates:['tt','mobility','both'],baselineTests:160}},null,2)+'\n');
// Run profile.mjs before this script to include a compact sampling certificate.
import {existsSync} from 'node:fs';
if(existsSync(`${dir}/native-profiles.json`)) {
 const profiles=JSON.parse(readFileSync(`${dir}/native-profiles.json`));
 for(const r of profiles) {
  const text=readFileSync(`${dir}/native-${r.tag}-${r.phase}.sample.txt`,'utf8').split('Sort by top of stack, same collapsed (when >= 5):')[1].split('Binary Images:')[0];
  r.selfSamples={};for(const line of text.split('\n')){const m=line.match(/^\s*(.*?)\s+\(in reversi-native\)\s+(\d+)\s*$/);if(m)r.selfSamples[m[1]]=Number(m[2]);}
 }
 writeFileSync('docs/data/native-final-profiles-20261030.json',JSON.stringify(profiles,null,2)+'\n');
}
