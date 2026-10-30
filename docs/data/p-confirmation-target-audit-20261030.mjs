#!/usr/bin/env node
// Outcome-blind focused verification of actual historical fitting targets.
// It supplements, and never rewrites or relaxes, the conservative provenance audit.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {OUT,OLD,read,checked,sealed,sha} from '../../scripts/p-confirmation/common.mjs';
import {keysFor} from '../../scripts/residual/data.mjs';
import {hash} from '../../scripts/p-confirmation/protocol.mjs';
const output=process.argv[2]??OUT,started=performance.now(),audit=checked(`${output}/provenance-audit.json`),archive='.local-research/pc-import-20261029',run='strong-six-hour-20261027',base=`${archive}/${run}`;
assert.ok(!existsSync(`${output}/summary.json`),'Complete role audit before opening new score summaries');
const manifest=read(`${base}/manifest.json`),trainSource=`${base}/source/scripts/strong/train.mjs`,runSource=`${base}/source/scripts/strong/run.mjs`;
assert.ok(readFileSync(trainSource,'utf8').includes('g.states.filter((_,i)=>i%2===0)'));
assert.ok(readFileSync(runSource,'utf8').includes('newPaths=s.data.train.slice(from,to)'));
const cache=new Map(),files=new Map(),targets=new Map();
function raw(path){if(!cache.has(path)){cache.set(path,read(path));files.set(path,sha(path));}return cache.get(path);}
const interested=new Set(audit.violations.map(c=>c.key));
// Only original accepted data shards implicated by raw occurrence evidence.
// No game outcome from the new experiment is accessed here.
const shardPaths=new Set(audit.violations.flatMap(c=>c.evidence).map(e=>e.path).filter(p=>p.startsWith(`${run}/data/generate-train-`)));
for(const relative of shardPaths){const path=`${archive}/${relative}`,data=raw(path),shard=manifest.data.train.findIndex(p=>p.endsWith(`/data/${relative.split('/').at(-1)}`));assert.ok(shard>=0,'Training shard must actually be accepted');
 const applied=Object.keys(manifest.appliedFits).filter(k=>manifest.appliedFits[k]).find(k=>{const from=Number(k.split('-').at(-1));return /-fit-linear-margin-p4-/.test(k)&&from<=shard&&shard<from+8;});
 assert.ok(applied,'An applied fit must cover the shard');assert.equal(manifest.tasks[applied].status,'complete');
 const fit=raw(`${base}/tasks/${applied}.json`);assert.ok(fit.examples>0);
 for(const [gameIndex,g] of data.games.entries())for(const [stateIndex,s] of g.states.entries())for(const key of keysFor(s.board))if(interested.has(key)){
  const row={key,path:relative,pathSha:files.get(path),gameIndex,id:g.id,split:g.split,stateIndex,occupied:s.board.filter(Boolean).length,actualPlayer:s.player,shardIndex:shard,evenIndexUsedByFit:stateIndex%2===0,appliedFit:applied,fitReceiptSha:files.get(`${base}/tasks/${applied}.json`),fitExamples:fit.examples,fitCursor:manifest.fitCursor['linear-margin-p4'],board:s.board};
  assert.equal(g.split,'train');assert.ok(row.fitCursor>shard);if(!targets.has(key))targets.set(key,[]);targets.get(key).push(row);
 }
}
const confirmed=[...targets].filter(([key,rows])=>rows.some(r=>r.evenIndexUsedByFit)).map(([key,evidence])=>({key,evidence,newLocations:audit.violations.find(c=>c.key===key).newLocations}));
const body={format:'p-confirmation-focused-historical-target-audit-v1',launch:audit.launch,provenance:audit.checksum,outcomeBlind:true,newScoreSummaryExists:false,
 manifestSha:sha(`${base}/manifest.json`),archivedTrainingSourceSha:sha(trainSource),archivedCoordinatorSourceSha:sha(runSource),files:[...files],
 confirmedDirectHistoricalTargetKeys:confirmed,confirmedBoards:new Set(confirmed.flatMap(c=>c.evidence.filter(r=>r.evenIndexUsedByFit).map(r=>hash(r.board)))).size,
 remainingConservativeFlags:audit.violations.filter(c=>!confirmed.some(t=>t.key===c.key)).map(c=>({key:c.key,newLocations:c.newLocations,unknown:c.unknown,originalConservativeRestriction:c.prohibited})),
 ownFrozenLPorDevelopmentDirectHits:audit.overlaps.filter(o=>!o.terminal&&o.directKnown).length,independentConfirmationClaim:false,allGamesRetained:true,
 interpretation:'At least one played nonterminal state is an actual direct target of an older historical evaluator fit. Accepted shard, even-index sampling, applied fitting batch, receipt and final cursor are verified from original PC evidence. This violates the requested separation from historical direct targets and blocks the independent confirmation claim. It does not establish that frozen P itself trained on these boards or that their overlap caused any favorable or unfavorable result. Remaining broad flags stay conservative, without outcome-based removal or source replacement.',wallMs:performance.now()-started};
assert.ok(confirmed.length>0,'Do not assert a verified historical-target violation without evidence');
const result=sealed(`${output}/historical-target-audit.json`,body);console.log(JSON.stringify({confirmedKeys:confirmed.length,confirmedBoards:body.confirmedBoards,remainingFlags:body.remainingConservativeFlags.length,independentConfirmationClaim:false,checksum:result.checksum}));
