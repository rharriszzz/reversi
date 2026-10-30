import assert from 'node:assert/strict';
import {readdirSync,existsSync} from 'node:fs';
import {OUT,OLD,read,checked,sealed,sha,atomic} from './common.mjs';
import {hash} from './protocol.mjs';
import {keysFor,verifyTrajectory} from '../residual/data.mjs';
import {KeyIndex} from '../residual/index.mjs';
import {oracleChildren} from '../../tests/oracle.mjs';
import {replayTeacher} from '../frozen-player/analyze.mjs';
import {terminal,admissionKeys} from '../frozen-player/execution.mjs';
import {frozenModels} from '../frozen-player/models.mjs';
export const ARCHIVE='.local-research/pc-import-20261029';
export function loadExclusions(output){const h=checked(`${output}/history.json`),base=KeyIndex.load(`${OLD}/history-v2/membership.bin`),eng=KeyIndex.load(`${OLD}/preflight-final/engineering-keys.bin`),added=KeyIndex.load(`${output}/added-keys.bin`);assert.equal(base.digest(),h.baseDigest);assert.equal(eng.digest(),h.engineeringDigest);assert.equal(added.digest(),h.addedDigest);return {h,has:k=>base.has(k)||eng.has(k)||added.has(k),base,eng,added};}
export function buildHistory(output=OUT){if(existsSync(`${output}/history.json`))return checked(`${output}/history.json`);
 const start=performance.now(),manifest=checked(`${OLD}/history-v2/manifest.json`),pre=checked(`${OLD}/preflight-final/preflight.json`),verification=checked(`${OLD}/scientific/verification.json`),adjudication=checked(`${OLD}/scientific/prospective-role-audit-v2.json`),models=frozenModels();
 assert.ok(verification.passed&&adjudication.prospectiveDirectStateSeparation);assert.equal(manifest.checksum,'1241916a1f4743b58228e7a2f3e32cccbb16f4ebcbd84b950154e24d09cf1351');
 assert.equal(sha(`${OLD}/pc-inventory-qualified.json`),manifest.inventorySha256);
 assert.deepEqual(read(`${ARCHIVE}/residual-constraint-pattern-screen-v1-20261029/engineering-v2/P.json`),models.P);
 const keys=new Set(),direct=new Set(),occurrences=[],inputs=[],seeds=new Set([...manifest.seeds,...pre.seeds]);
 function add(board,role,path,location,source=null){if(!Array.isArray(board)||board.length!==64||!board.every(v=>[-1,0,1].includes(v))||board.filter(Boolean).length<12)return;const ks=keysFor(board),isTerminal=terminal(board);for(const k of ks){keys.add(k);if(role==='direct'&&!isTerminal)direct.add(k);}occurrences.push({keys:ks,role,path,location,source,terminal:isTerminal,occupied:board.filter(Boolean).length});}
 function visit(v,path,loc=''){if(!v||typeof v!=='object')return;if(Array.isArray(v)){if(v.length===64&&v.every(x=>[-1,0,1].includes(x))){add(v,'disclosed',path,loc);return;}v.forEach((x,i)=>visit(x,path,`${loc}/${i}`));return;}
  if(v.seed!==undefined)seeds.add(v.seed);for(const [k,x] of Object.entries(v))visit(x,path,`${loc}/${k}`);
 }
 function file(path){inputs.push([path,sha(path)]);const v=read(path);visit(v,path);return v;}
 const oldReservation=file(`${OLD}/scientific/reservations.json`);
 for(const root of oldReservation.roots){add(root.board,'direct',`${OLD}/scientific/reservations.json`,root.id,root.id);for(const c of oracleChildren(root.board,root.player))add(c.board,'direct',`${OLD}/scientific/reservations.json`,`${root.id}/child-${c.move}`,root.id);}
 for(const dir of [`${OLD}/scientific/trajectories`,`${OLD}/scientific/frontiers`,`${OLD}/scientific/admission/tasks`,`${OLD}/preflight-final/attempts`])if(existsSync(dir))for(const name of readdirSync(dir).filter(n=>n.endsWith('.json'))){const path=`${dir}/${name}`,v=file(path);if(dir.endsWith('/frontiers')){for(const f of v){for(const p of f.parents){add(p.board,'direct',path,'parent');for(const c of p.children)add(c.board,'direct',path,'child');}for(const l of f.lines)add(l.endpoint.board,'direct',path,'endpoint');}}}
 for(const name of readdirSync(`${OLD}/scientific/tasks`).filter(n=>n.endsWith('.json'))){const path=`${OLD}/scientific/tasks/${name}`,r=file(path);assert.equal(hash(r.result),r.resultHash);assert.equal(hash({job:r.job,runIdentity:r.runIdentity}),r.inputHash);
  if(r.job.type==='label')replayTeacher(r.job.state,r.result,(b,p,role,move,step)=>add(b,role==='teacher-internal-PV'?'internal-PV':'direct',path,`PV/${move}/${step}`));
  else if(r.job.state){add(r.job.state.board,'direct',path,'query');for(const c of oracleChildren(r.job.state.board,r.job.state.player))add(c.board,'direct',path,`query-child-${c.move}`);}
 }
 function played(opening,g,path){let b=opening.board,p=opening.player;add(b,'played',path,'start');for(const [i,m] of g.moves.entries()){assert.equal(m.player,p);const children=oracleChildren(b,p);if(m.move===null)assert.equal(children.length,0);else{const c=children.find(c=>c.move===m.move);assert.ok(c);b=c.board;}p=-p;add(b,'played',path,`move-${i}`);}assert.deepEqual(b,g.board);}
 for(const [i,c] of oldReservation.schedule.entries()){const path=`${OLD}/scientific/games/game-${i}.json`,r=checked(path);inputs.push([path,sha(path)]);assert.equal(hash(r.result),r.resultHash);played(oldReservation.roots.find(r=>r.id===`games-${c.family}`),r.result,path);}
 const qualificationReports=readdirSync(output).filter(n=>n.startsWith('qualification')&&existsSync(`${output}/${n}/report.json`)).map(n=>`${output}/${n}/report.json`);
 for(const path of [`${OLD}/engineering-final/qualification.json`,...qualificationReports]){const q=file(path);for(const g of q.games)played(g.opening,g.game??g,path);for(const tr of q.admissionPilot?.attempts??[])if(tr.root)for(const c of oracleChildren(tr.root.board,tr.root.player))add(c.board,'disclosed',path,`engineering-generator-child-${c.move}`);}
 // Actual L/P fitting/development states: conservative complete decision panels.
 const fitting=read(`${ARCHIVE}/residual-frontier-v1r2-20261028/reservations.json`).roles;let trainingSources=0;
 for(const role of ['training','development'])for(const r of fitting[role]){const path=`${ARCHIVE}/residual-frontier-v1r2-20261028/frontiers/${r.id}.json`,f=read(path).result;inputs.push([path,sha(path)]);add(r.board,'direct',path,'fitting-root',r.id);for(const p of f.parents){add(p.board,'direct',path,'fitting-parent',r.id);for(const c of p.children)add(c.board,'direct',path,'fitting-child',r.id);}trainingSources++;}
 assert.equal(trainingSources,2000);const added=KeyIndex.from(keys),directIndex=KeyIndex.from(direct);added.save(`${output}/added-keys.bin`);directIndex.save(`${output}/known-direct-keys.bin`);atomic(`${output}/added-occurrences.json`,occurrences);
 return sealed(`${output}/history.json`,{format:'p-confirmation-incremental-history-v1',baseManifest:manifest.checksum,baseDigest:manifest.digest,engineeringDigest:pre.engineeringDigest,previousVerification:verification.checksum,previousAdjudication:adjudication.checksum,addedKeys:added.size,addedDigest:added.digest(),knownDirectKeys:directIndex.size,knownDirectDigest:directIndex.digest(),trainingSources,inputs,seeds:[...seeds],occurrencesSha:sha(`${output}/added-occurrences.json`),wallMs:performance.now()-start,note:'Historical PC archive and old run read only; no 21 GiB rebuild. Includes completed exploratory screen and qualification. All source attempts remain local; role-specific analysis distinguishes incidental convergence from prohibited direct states.'});
}
