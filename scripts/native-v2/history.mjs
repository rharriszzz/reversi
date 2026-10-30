import assert from 'node:assert/strict';
import {readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {loadExclusions} from '../p-confirmation/history.mjs';
import {KeyIndex} from '../residual/index.mjs';
import {keysFor} from '../residual/data.mjs';
import {oracleChildren} from '../../tests/oracle.mjs';
import {positions} from './positions.mjs';
import {output,read,checked,sealed,atomic,hash} from './common.mjs';
import {sha} from '../frozen-player/execution.mjs';
const old='.local-research/p-independent-confirmation-v1-20261029';
export function loadHistory(){const prior=loadExclusions(old),h=checked(resolve(output,'history.json')),extra=KeyIndex.load(resolve(output,'history-extra.bin'));assert.equal(extra.digest(),h.extraDigest);return {h,prior,extra,has:k=>prior.has(k)||extra.has(k)};}
export function buildHistory(){
 if(existsSync(resolve(output,'history.json')))return loadHistory();
 const prior=loadExclusions(old),keys=new Set(),occurrences=[],inputs=[],seeds=new Set(prior.h.seeds);
 const terminal=b=>!oracleChildren(b,1).length&&!oracleChildren(b,-1).length;
 function add(b,role,path,location){if(b.filter(Boolean).length<12||terminal(b))return;const ks=keysFor(b);ks.forEach(k=>keys.add(k));occurrences.push({keys:ks,role,path,location,occupied:b.filter(Boolean).length});}
 function file(p){inputs.push([p,sha(p)]);return read(p);}
 function played(opening,moves,path){let b=opening.board,p=opening.player;add(b,'previous-played-path',path,'start');for(const [i,m] of moves.entries()){assert.equal(m.player,p);const cs=oracleChildren(b,p);if(m.move===null)assert.equal(cs.length,0);else{const c=cs.find(c=>c.move===m.move);assert.ok(c);b=c.board;}p=-p;add(b,'previous-played-path',path,`move-${i}`);}}
 const reservation=file(`${old}/reservation.json`);
 for(const root of reservation.roots){seeds.add(root.seed);const path=`${old}/trajectories/${root.id}.json`,tr=file(path);assert.equal(hash(tr),root.trajectoryHash);for(const [i,s] of tr.history.entries())add(s.board,'declared-source-ancestry',path,String(i));add(root.board,'previous-reserved-root',path,'root');for(const c of oracleChildren(root.board,root.player))add(c.board,'previous-reserved-child',path,`child-${c.move}`);}
 for(const [i,c] of reservation.schedule.entries()){const path=`${old}/games/game-${i}.json`,r=file(path);played(reservation.roots[c.family],r.result.moves,path);}
 for(const directory of ['.local-research/native-engine-20261030','.local-research/native-engine-20261030-r2']){
  if(!existsSync(`${directory}/registration.json`))throw Error(`Missing previous native screen: ${directory}`);
  const reg=file(`${directory}/registration.json`);
  for(const r of reg.openings){seeds.add(r.seed);for(const [i,s] of r.history.entries())add(s.board,'declared-source-ancestry',`${directory}/registration.json`,`${r.id}/${i}`);add(r.board,'previous-reserved-root',directory,r.id);for(const c of oracleChildren(r.board,r.player))add(c.board,'previous-reserved-child',directory,`${r.id}/child-${c.move}`);}
  for(const c of reg.schedule){const path=`${directory}/games/game-${c.game}.json`,r=file(path);played(reg.openings[c.family],r.result.moves,path);}
 }
 for(const [i,g] of file(resolve(output,'pilot-games.json')).entries())played(g.opening,g.result.moves,`v2-pilot-${i}`);
 for(const p of positions())add(p.board,'disclosed-engineering-root','scripts/native-v2/positions.mjs',p.id);
 const extra=KeyIndex.from(keys);extra.save(resolve(output,'history-extra.bin'));atomic(resolve(output,'history-extra-occurrences.json'),occurrences);
 sealed(resolve(output,'history.json'),{version:1,priorHistory:prior.h.checksum,baseDigest:prior.h.baseDigest,engineeringDigest:prior.h.engineeringDigest,addedDigest:prior.h.addedDigest,extraDigest:extra.digest(),extraSize:extra.size,seeds:[...seeds],inputs,occurrencesSha:sha(resolve(output,'history-extra-occurrences.json')),note:'Verified prior indices reused read-only; adds all completed confirmation/source paths and both native screens. No original corpus rebuild or mutation.'});
 return loadHistory();
}
