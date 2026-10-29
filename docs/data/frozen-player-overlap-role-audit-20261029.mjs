#!/usr/bin/env node
// Outcome-blind provenance adjudication. Does not open scores, model selection,
// new game margins, or summary.json. Original conservative audit remains unchanged.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {read,atomic} from '../../scripts/research/io.mjs';
import {sha} from '../../scripts/frozen-player/execution.mjs';
import {hash} from '../../scripts/frozen-player/protocol.mjs';
import {keysFor,verifyTrajectory} from '../../scripts/residual/data.mjs';
import {oracleChildren} from '../../tests/oracle.mjs';
const [archiveArg,scienceArg,historyArg,outputArg]=process.argv.slice(2),archive=resolve(archiveArg),science=resolve(scienceArg),history=resolve(historyArg);
const audit=read(`${science}/overlap-audit.json`),manifest=read(`${history}/manifest.json`),old='residual-frontier-v1r2-20261028';
const reservations=new Map(),targets=new Set(),targetSources=[];
function reserved(run){if(!reservations.has(run)){const r=read(`${archive}/${run}/reservations.json`);reservations.set(run,'roles' in r?Object.values(r.roles).flat():[...r.assessment,...r.games]);}return reservations.get(run);}
// Complete actual L/P training/development decision panels, not intended roles
// on unsuccessful generator attempts. All alternatives are retained as a
// conservative direct-state superset of the informative fitted pair children.
const roles=read(`${archive}/${old}/reservations.json`).roles;
for(const role of ['training','development'])for(const root of roles[role]){
 const f=read(`${archive}/${old}/frontiers/${root.id}.json`).result;
 for(const b of [root.board,...f.parents.flatMap(p=>[p.board,...p.children.map(c=>c.board)])])for(const k of keysFor(b))targets.add(k);
 targetSources.push({id:root.id,role,seed:root.seed,frontierHash:hash(f)});
}
assert.equal(roles.training.length,1600);assert.equal(roles.development.length,400);
const directPattern=/\/(?:frontiers|labels)\/|(?:label-|transfer-).*\.json$/;
const rows=[],unknown=[],prohibited=[];
for(const classification of audit.classifications){
 const played=audit.overlaps.filter(r=>r.key===classification.key&&r.role==='played-path'&&!r.terminal);
 if(!played.length)continue;
 const evidence=[];
 for(const occurrence of classification.occurrences){
  const {path,location,role}=occurrence,run=path.split('/')[0];
  if(/\/tasks\/(?:main-)?generation-(?:training-|assessment-)?\d+\.json$/.test(path)){
   const receipt=read(`${archive}/${path}`),tr=receipt.result;
   assert.equal(receipt.resultHash,hash(tr));assert.equal(receipt.inputHash,hash({job:receipt.job,runIdentity:receipt.runIdentity}));
   if(tr.root)verifyTrajectory(tr);
   const accepted=reserved(run).filter(r=>r.seed===tr.seed);assert.equal(accepted.length,0,'A supposedly rejected attempt was actually accepted');
   let board;
   const historyMatch=location.match(/\/history\/(\d+)\/board$/),childMatch=location.match(/\/reserved-root-child-(\d+)$/);
   if(historyMatch)board=tr.history[Number(historyMatch[1])].board;
   else if(childMatch)board=oracleChildren(tr.root.board,tr.root.player).find(c=>c.move===Number(childMatch[1])).board;
   else throw Error(`Unsupported generator location ${location}`);
   assert.ok(keysFor(board).includes(classification.key));
   evidence.push({path,location,sha256:sha(`${archive}/${path}`),seed:tr.seed,attempt:tr.attempt,intendedRole:tr.spec.role,accepted:false,
    actualRole:childMatch?'hypothetical child of rejected generator root':'history of rejected generation attempt',
    scientificSignificance:'Not an accepted L/P training/development source, fitting target, locked assessment root, or old unused opening reservation. It was retained in the broad exclusion index but the new played path converged to it.'});
  }else if(path==='strong-six-hour-20261027/tasks/pair-confirmation-linear-rank-p4-t80-162.json'){
   const r=read(`${archive}/${path}`),game=r.games[1],opening=r.opening;assert.ok(opening?.board);
   let board=opening.board,player=opening.player,found=0;
   for(const step of game.moves??game.trajectory){
    if(step.player!==undefined)assert.equal(step.player,player);
    if(step.move===null)assert.equal(oracleChildren(board,player).length,0);else{const c=oracleChildren(board,player).find(c=>c.move===step.move);assert.ok(c);board=c.board;}
    player=-player;if(keysFor(board).includes(classification.key))found++;
   }
   assert.ok(found);assert.equal(oracleChildren(board,1).length,0);assert.equal(oracleChildren(board,-1).length,0);assert.equal(board.reduce((s,v)=>s+v,0),game.margin);
   if(role==='encoded-history-unknown')assert.ok(/^\/games\/1\/keys\/\d+$/.test(location),'Encoded role must belong to this legally replayed game, not a separate training registry');
   evidence.push({path,location,sha256:sha(`${archive}/${path}`),actualRole:role==='encoded-history-unknown'?'derived membership of the same played confirmation game':'played confirmation-game state',
    scientificSignificance:'Known historical played-path convergence at one empty; not an unresolved training role. The same board is legally reconstructed from its own opening and moves.'});
  }else{
   unknown.push({key:classification.key,path,location,role});evidence.push({path,location,actualRole:'unresolved',scientificSignificance:'Conservative claim restriction retained'});
  }
 }
 const directTraining=targets.has(classification.key),otherDirect=classification.occurrences.some(r=>directPattern.test(r.path));
 const row={key:classification.key,newLocations:played.map(({source,location,step,occupied,actual})=>({source,location,step,occupied,actual})),actualLPorDevelopmentDirectState:directTraining,otherDirectStateEvidence:otherDirect,evidence};
 if(directTraining||otherDirect)prohibited.push(row);rows.push(row);
}
const body={kind:'frozen-player-prospective-role-adjudication-v1',outcomeBlind:true,
 scientificPolicy:'Original prospective policy: prohibit direct fitting/scored-state reuse; report incidental internal/played convergence and terminal convergence; retain every source/game. No old experiment is rehabilitated.',
 initialConservativeGameClaim:audit.independence.gameClaim,initialAuditSha256:sha(`${science}/overlap-audit.json`),historicalManifest:manifest.checksum,
 actualTargetPanelSources:targetSources.length,actualTargetPanelDigest:hash(targetSources),actualDirectStateKeys:targets.size,actualDirectStateDigest:hash([...targets].sort()),
 rows,unknown,prohibited,prospectiveDirectStateSeparation:!unknown.length&&!prohibited.length&&audit.independence.sourceDisjoint,
 allOutcomesRetained:true,originalConservativeArtifactUnchanged:true,
 scope:'The first automatic classifier used generator-intended roles, and treated a derived confirmation-game key as unknown. Raw reservation/target provenance resolves these false direct-target flags. This does not claim every internal, rejected-generation or terminal board is novel.'};
const result={...body,checksum:hash(body)};atomic(outputArg,result);console.log(JSON.stringify({keys:rows.length,unknown:unknown.length,prohibited:prohibited.length,prospectiveDirectStateSeparation:result.prospectiveDirectStateSeparation,checksum:result.checksum}));
