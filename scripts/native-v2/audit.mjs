#!/usr/bin/env node
// Outcome-blind role attribution; no aggregate game scores are accessed here.
import assert from 'node:assert/strict';
import {createReadStream,readFileSync} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {resolve} from 'node:path';
import {output,read,checked,sealed,measure,hash} from './common.mjs';
import {loadHistory} from './history.mjs';
import {keysFor,verifyTrajectory} from '../residual/data.mjs';
import {admissionKeys,terminal} from '../frozen-player/execution.mjs';
import {oracleChildren} from '../../tests/oracle.mjs';
import {KeyIndex} from '../residual/index.mjs';
import {sha} from '../native/build.mjs';
await measure('outcome-blind-provenance-v2',async()=>{
 const reg=checked(resolve(output,'registration.json')),history=loadHistory(),owners=new Map(),sourceInputs=[];
 for(const root of reg.openings){const tr=read(resolve(output,`trajectories/${root.id}.json`));assert.equal(hash(tr),root.trajectoryHash);verifyTrajectory(tr);for(const k of admissionKeys(tr).all){assert.ok(!history.has(k)&&!owners.has(k));owners.set(k,root.id);}sourceInputs.push([root.id,hash(tr)]);}
 const old='.local-research/p-independent-confirmation-v1-20261029',base='.local-research/frozen-player-screen-v1-20261029',direct=KeyIndex.load(`${old}/known-direct-keys.bin`);
 assert.equal(direct.digest(),history.prior.h.knownDirectDigest);
 const proven=read(`${old}/historical-target-audit.json`),knownOlder=new Set(proven.confirmedDirectHistoricalTargetKeys.map(r=>r.key));
 const overlaps=[],hits=new Set(),playedOwners=new Map(),convergences=[],receipts=[];
 function boardAudit(board,family,path,step){const occupied=board.filter(Boolean).length;if(occupied<12)return;const term=terminal(board);for(const key of keysFor(board)){
  if(playedOwners.has(key)&&playedOwners.get(key)!==family)convergences.push({key,family,otherFamily:playedOwners.get(key),occupied,terminal:term,path,step});else playedOwners.set(key,family);
  if(history.has(key)){hits.add(key);overlaps.push({key,family,path,step,occupied,terminal:term,directLP:!term&&direct.has(key),provenOlderDirect:!term&&knownOlder.has(key)});}
 }}
 for(const [i,c] of reg.schedule.entries()){
  const path=resolve(output,`games/game-${i}.json`),r=checked(path);assert.equal(r.registration,reg.checksum);assert.deepEqual(r.condition,c);assert.equal(hash(r.result),r.resultHash);assert.ok(r.committed>reg.at);
  const opening=reg.openings[c.family];let b=opening.board,p=opening.player,passes=0;boardAudit(b,c.family,path,0);
  for(const [j,m] of r.result.moves.entries()){assert.equal(m.player,p);assert.ok(passes<2);const cs=oracleChildren(b,p);if(m.move===null){assert.equal(cs.length,0);passes++;}else{const child=cs.find(x=>x.move===m.move);assert.ok(child);b=child.board;passes=0;}p=-p;boardAudit(b,c.family,path,j+1);}
  assert.equal(passes,2);assert.deepEqual(b.map(v=>v||0),r.result.board.map(v=>v||0));receipts.push([i,sha(readFileSync(path))]);
 }
 const inv=read(`${base}/pc-inventory-before.json`).files,manifest=checked(`${base}/history-v2/manifest.json`),records=new Map([...hits].map(k=>[k,[]]));
 console.log(JSON.stringify({stage:'blind-provenance',indexedKeys:hits.size,occurrences:overlaps.length}));
 const lines=createInterface({input:createReadStream(`${base}/history-v2/occurrences.jsonl.gz`).pipe(createGunzip()),crlfDelay:Infinity});let lineCount=0;
 for await(const line of lines){if(!line)continue;const o=JSON.parse(line);for(const k of o.keys??[])if(records.has(k))records.get(k).push({...o,path:o.file<inv.length?inv[o.file].path:manifest.localInputs[o.file-inv.length]});if(++lineCount%5000000===0)console.log(JSON.stringify({stage:'historical-role-scan',rows:lineCount}));}
 for(const path of [`${old}/added-occurrences.json`,resolve(output,'history-extra-occurrences.json')])for(const o of read(path))for(const k of o.keys??[])if(records.has(k))records.get(k).push({...o,incremental:true});
 const classifications=[];
 for(const key of hits){const locations=overlaps.filter(x=>x.key===key),nonterminal=locations.some(x=>!x.terminal),evidence=records.get(key);
  const directLP=locations.some(x=>x.directLP),provenOlderDirect=locations.some(x=>x.provenOlderDirect),reservedOrDirect=evidence.some(o=>o.role==='direct'||o.role==='direct-scored-child'||o.role==='previous-reserved-root'||o.role==='previous-reserved-child');
  const onlyKnownIncidental=evidence.length&&evidence.every(o=>['previous-played-path','played-game-state','teacher-internal-PV','internal-PV','declared-source-ancestry'].includes(o.role));
  const prohibited=nonterminal&&(directLP||provenOlderDirect||reservedOrDirect),unresolved=nonterminal&&!prohibited&&!onlyKnownIncidental;
  classifications.push({key,nonterminal,directLP,provenOlderDirect,prohibited,unresolved,disposition:!nonterminal?'terminal convergence':prohibited?'direct target/reserved decision encountered':unresolved?'historical role not fully established; broader novelty restricted':'incidental played/ancestral/internal convergence',evidence,newLocations:locations});
 }
 const report={format:'native-v2-blind-provenance-v1',registration:reg.checksum,sourceFamilySeparation:true,sourceInputDigest:hash(sourceInputs),receiptInventory:receipts,receiptInventoryHash:hash(receipts),overlaps,classifications,playedCrossFamilyConvergences:convergences,historicalOccurrenceRows:lineCount,directLPKeys:classifications.filter(c=>c.directLP).length,provenOlderDirectKeys:classifications.filter(c=>c.provenOlderDirect).length,prohibitedKeys:classifications.filter(c=>c.prohibited).length,unresolvedKeys:classifications.filter(c=>c.unresolved).length,broaderDirectStateSeparation:classifications.every(c=>!c.prohibited&&!c.unresolved),scoreSummariesOpened:false,allOutcomesRetained:true,note:'Source-family claim was fixed prospectively. Later encounters are role-attributed and constrain broader claims; no outcome-dependent exclusions, replacements or retrospective gate changes.'};
 sealed(resolve(output,'provenance-audit.json'),report);console.log(JSON.stringify({sourceFamilySeparation:true,directLPKeys:report.directLPKeys,provenOlderDirectKeys:report.provenOlderDirectKeys,prohibitedKeys:report.prohibitedKeys,unresolvedKeys:report.unresolvedKeys}));
});
