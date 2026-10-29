#!/usr/bin/env node
// Additional read-only audit; never mutates the frozen exclusion index/sample.
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { read,atomic } from '../research/io.mjs';
import { trajectoryKeys,keysFor } from '../residual/data.mjs';
import { KeyIndex } from '../residual/index.mjs';
import { play } from '../../src/rules.js';
import { hash } from './protocol.mjs';
import { pilotGameKeys } from './exclusions.mjs';
const output=resolve(process.argv[2]),old=resolve('.local-research/residual-frontier-v1r2-20261028'),reservations=read(`${output}/reservations.json`),state=read(`${output}/manifest.json`);
const all=pilotGameKeys(read(`${old}/pilot-results.json`),read(`${output}/engineering-v2/pilot.json`),read(`${old}/reservations.json`));
const frozen=KeyIndex.load(`${output}/historical-index.bin`),missing=new Set([...all.keys].filter(k=>!frozen.has(k))),collisions=[];
for(const root of [...reservations.assessment,...reservations.games]){
 const tr=read(`${output}/trajectories/${root.id}.json`),frontier=root.role==='games'?null:read(`${output}/frontiers/${root.id}.json`).result;
 for(const key of trajectoryKeys(tr,frontier))if(missing.has(key))collisions.push({source:root.id,role:root.role,key,where:'reserved trajectory/frontier'});
}
for(const file of readdirSync(`${output}/tasks`).filter(f=>f.startsWith('main-')&&f.endsWith('.json'))){const r=read(`${output}/tasks/${file}`);if(r.job.type!=='label')continue;const source=file.match(/assessment-\d+/)[0];
 for(const row of r.result.rows){let board=r.job.state.board,player=r.job.state.player;
  for(const move of [row.move,...row.pv]){if(move!==null)board=[...play(board,player,move)];player=-player;
   for(const key of keysFor(board))if(missing.has(key))collisions.push({source,role:'teacher-PV',key,receipt:file});}
 }
}
const result={kind:'additional-engineering-game-exclusion-audit-v1',runIdentity:state.runIdentity,games:all.games,allKeys:all.keys.size,
 missingFromFrozenIndex:missing.size,missingKeyDigest:hash([...missing].sort()),collisions,passed:!collisions.length,
 scope:'Saved games from both integrated pilots. Original index, reservations, all 256 sources, labels, models, gates and assessment remain byte-identical. Existing historical-PV independence failure is unchanged.',at:new Date().toISOString()};
result.checksum=hash(result);atomic(`${output}/pilot-game-exclusion-audit.json`,result);console.log(JSON.stringify(result));
