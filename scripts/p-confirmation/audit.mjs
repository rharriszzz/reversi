#!/usr/bin/env node
// Outcome-blind provenance pass. No points, margins or score summaries read.
import assert from 'node:assert/strict';
import {createReadStream,existsSync} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {OUT,OLD,read,checked,sealed,sha,scientificInventory} from './common.mjs';
import {PROTOCOL,hash,schedule,slots} from './protocol.mjs';
import {loadExclusions,ARCHIVE} from './history.mjs';
import {keysFor,verifyTrajectory} from '../residual/data.mjs';
import {admissionKeys,terminal} from '../frozen-player/execution.mjs';
import {oracleChildren} from '../../tests/oracle.mjs';
import {KeyIndex} from '../residual/index.mjs';
export async function audit(output=OUT){const started=performance.now(),launch=checked(`${output}/launch.json`),r=checked(`${output}/reservation.json`),{h,has}=loadExclusions(output);
 assert.equal(hash(scientificInventory()),launch.source);assert.deepEqual(r.schedule,schedule());assert.equal(r.roots.length,768);assert.equal(r.checksum,launch.reservation);const owners=new Map(),sourceInputs=[];
 for(const spec of slots()){const root=r.roots[spec.family],tr=read(`${output}/trajectories/${root.id}.json`);assert.equal(hash(tr),root.trajectoryHash);verifyTrajectory(tr);assert.deepEqual(tr.spec,spec);assert.deepEqual(root.board,spec.reverse?tr.root.board.map(v=>-v):tr.root.board);assert.equal(root.player,spec.reverse?-tr.root.player:tr.root.player);
  for(const key of admissionKeys(tr).all){assert.ok(!has(key));assert.ok(!owners.has(key));owners.set(key,root.id);}sourceInputs.push([root.id,hash(tr)]);
 }
 const direct=KeyIndex.load(`${output}/known-direct-keys.bin`);assert.equal(direct.digest(),h.knownDirectDigest);const overlaps=[],hits=new Set(),playedOwners=new Map(),convergences=[],receipts=[];
 function boardAudit(board,player,source,path,step){const ks=keysFor(board),occupied=board.filter(Boolean).length,isTerminal=terminal(board);for(const key of ks){const previous=playedOwners.get(key);if(previous&&previous!==source)convergences.push({key,source,other:previous,path,step,occupied,terminal:isTerminal});else playedOwners.set(key,source);if(has(key)){hits.add(key);overlaps.push({key,source,path,step,occupied,terminal:isTerminal,directKnown:!isTerminal&&direct.has(key)});}}}
 for(const [i,c] of r.schedule.entries()){const path=`${output}/games/game-${i}.json`,receipt=checked(path);assert.equal(receipt.launch,launch.checksum);assert.deepEqual(receipt.condition,c);assert.equal(hash(receipt.result),receipt.resultHash);assert.ok(receipt.committed>launch.at);const opening=r.roots[c.family];assert.equal(receipt.identity,hash({launch:launch.checksum,condition:c,opening}));
  // Deliberately access only the move path and final board, not outcome fields.
  const moves=receipt.result.moves;let b=opening.board,p=opening.player,passes=0;boardAudit(b,p,opening.id,path,0);
  for(const [j,m] of moves.entries()){assert.equal(m.player,p);assert.ok(passes<2);const children=oracleChildren(b,p);if(m.move===null){assert.equal(children.length,0);passes++;}else{const child=children.find(x=>x.move===m.move);assert.ok(child);b=child.board;passes=0;}p=-p;boardAudit(b,p,opening.id,path,j+1);}
  assert.equal(passes,2);assert.deepEqual(b,receipt.result.board);receipts.push([i,sha(path)]);
 }
 const inv=read(`${OLD}/pc-inventory-before.json`).files,manifest=checked(`${OLD}/history-v2/manifest.json`),records=new Map([...hits].map(k=>[k,[]]));
 console.log(JSON.stringify({stage:'outcome-blind-provenance',historicalKeys:hits.size,overlapOccurrences:overlaps.length,games:2048}));
 const lines=createInterface({input:createReadStream(`${OLD}/history-v2/occurrences.jsonl.gz`).pipe(createGunzip()),crlfDelay:Infinity});let lineCount=0;
 for await(const line of lines){if(!line)continue;const o=JSON.parse(line);for(const key of o.keys??[])if(records.has(key))records.get(key).push({...o,path:o.file<inv.length?inv[o.file].path:manifest.localInputs[o.file-inv.length]});if(++lineCount%2000000===0)console.log(JSON.stringify({stage:'historical-role-scan',occurrences:lineCount}));}
 for(const o of read(`${output}/added-occurrences.json`))for(const key of o.keys)if(records.has(key))records.get(key).push({...o,incremental:true});
 const reservationCache=new Map(),rawCache=new Map();function raw(path){if(!rawCache.has(path)){if(rawCache.size>200)rawCache.clear();rawCache.set(path,read(path));}return rawCache.get(path);}
 function accepted(run){if(!reservationCache.has(run)){const p=`${ARCHIVE}/${run}/reservations.json`;if(!existsSync(p))return null;const v=read(p),rows=v.roles?Object.values(v.roles).flat():[...(v.assessment??[]),...(v.games??[])];reservationCache.set(run,rows);}return reservationCache.get(run);}
 function decision(o,key){
  if(o.incremental)return {restricted:o.role==='direct',resolved:true,reason:o.role==='direct'?'verified direct state':'known prior-screen/qualification occurrence'};
  const path=o.path,location=o.location??'';
  if(/\/tasks\/(?:main-)?generation-(?:training-|assessment-)?\d+\.json$/.test(path)){
   const v=raw(`${ARCHIVE}/${path}`),tr=v.result;assert.equal(hash(tr),v.resultHash);assert.equal(hash({job:v.job,runIdentity:v.runIdentity}),v.inputHash);const registry=accepted(path.split('/')[0]);if(!registry)return {resolved:false,reason:'missing accepted registry'};
   const acceptedRoots=registry.filter(r=>r.seed===tr.seed);if(!acceptedRoots.length)return {resolved:true,restricted:false,reason:'raw receipt and complete registry prove rejected generator',seed:tr.seed,attempt:tr.attempt};
   const restricted=acceptedRoots.some(r=>keysFor(r.board).includes(key)||oracleChildren(r.board,r.player).some(c=>keysFor(c.board).includes(key)));
   return {resolved:true,restricted,reason:restricted?'accepted reserved root or child':'incidental accepted-source trajectory convergence; direct fitting panels checked separately'};
  }
  if(/\/(?:frontiers|labels|preferences)\/|\/reservations\.json$/.test(path)||o.role==='direct-scored-child'||/\/job\/state\/board$/.test(location)||/\/state\/board$/.test(location)&&/label|search/.test(path))return {resolved:true,restricted:true,reason:'direct decision/label/assessment/reservation occurrence'};
  if(o.role==='teacher-internal-PV')return {resolved:true,restricted:/step-1$/.test(location),reason:/step-1$/.test(location)?'direct queried alternative':'internal returned teacher PV'};
  if(o.role==='played-game-state')return {resolved:true,restricted:false,reason:'historical played-path convergence'};
  if(o.role==='encoded-history-unknown'&&/\/(?:games|trajectory|moves|keys)\//.test(location)){
   const v=raw(`${ARCHIVE}/${path}`),index=Number(location.match(/\/games\/(\d+)/)?.[1]??0),g=v.games?.[index]??v,opening=v.opening;
   if(opening?.board&&Array.isArray(g.moves??g.trajectory)){let b=opening.board,p=opening.player,found=false;for(const m of g.moves??g.trajectory){const cs=oracleChildren(b,p);if(m.move===null)assert.equal(cs.length,0);else{const c=cs.find(c=>c.move===m.move);assert.ok(c);b=c.board;}p=-p;if(keysFor(b).includes(key))found=true;}if(found)return {resolved:true,restricted:false,reason:'encoded membership independently reconstructed from its own historical played game'};}
  }
  return {resolved:false,restricted:true,reason:'unresolved historical role retained conservatively'};
 }
 const classifications=[];for(const key of hits){const locations=overlaps.filter(x=>x.key===key),nonterminal=locations.some(o=>!o.terminal),os=records.get(key);const evidence=nonterminal?os.map(o=>({...o,classification:decision(o,key)})):os.map(o=>({...o,classification:{resolved:true,restricted:false,reason:'terminal convergence'}}));const prohibited=locations.some(o=>o.directKnown)||nonterminal&&evidence.some(o=>o.classification.restricted),unknown=nonterminal&&(!evidence.length||evidence.some(o=>!o.classification.resolved));classifications.push({key,prohibited,unknown,evidence,newLocations:locations});}
 const violations=classifications.filter(c=>c.prohibited||c.unknown),result={format:'p-confirmation-outcome-blind-provenance-v1',launch:launch.checksum,source:launch.source,games:2048,families:768,sourceInputDigest:hash(sourceInputs),receiptInventory:receipts,receiptInventoryHash:hash(receipts),sourceDisjoint:true,overlaps,classifications,violations,playedCrossFamilyConvergences:convergences,independentClaim:!violations.length,allOutcomesRetained:true,scoreSummariesOpened:false,historicalOccurrenceRows:lineCount,wallMs:performance.now()-started};
 return sealed(`${output}/provenance-audit.json`,result);
}
if(process.argv[1]?.endsWith('/audit.mjs')){const r=await audit(process.argv[2]??OUT);console.log(JSON.stringify({independentClaim:r.independentClaim,violations:r.violations.length,wallMs:r.wallMs}));}
