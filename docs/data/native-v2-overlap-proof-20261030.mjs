#!/usr/bin/env node
// Focused proof of the direct DEVELOPMENT overlap; never deletes a source/game.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {keysFor} from '../../scripts/residual/data.mjs';
import {hash} from '../../scripts/native-v2/protocol.mjs';
import {sha} from '../../scripts/frozen-player/execution.mjs';
import {oracleChildren} from '../../tests/oracle.mjs';
const out='.local-research/native-v2-20261030',read=p=>JSON.parse(readFileSync(p)),reg=read(`${out}/registration.json`),audit=read(`${out}/provenance-audit.json`),hits=audit.classifications.filter(c=>c.directLP);
assert.equal(hits.length,2);const location=hits[0].newLocations[0];assert.ok(hits.every(c=>c.newLocations.every(l=>l.family===156&&l.step===6&&l.occupied===18)));
const game=read(`${out}/games/game-1444.json`),root=reg.openings[156];assert.equal(game.condition.family,156);
let board=root.board,player=root.player;for(const m of game.result.moves.slice(0,6)){assert.equal(m.player,player);const cs=oracleChildren(board,player);if(m.move===null)assert.equal(cs.length,0);else{const c=cs.find(c=>c.move===m.move);assert.ok(c);board=c.board;}player=-player;}
const base='.local-research/pc-import-20261029/residual-frontier-v1r2-20261028',path=`${base}/frontiers/development-50.json`,frontier=read(path),parent=frontier.result.parents[1];assert.equal(hash(frontier.result),frontier.resultHash);
const prior=read('.local-research/p-independent-confirmation-v1-20261029/history.json'),oldInput=prior.inputs.find(([p])=>p===path);assert.ok(oldInput);assert.equal(sha(path),oldInput[1]);
assert.deepEqual(keysFor(board).sort(),keysFor(parent.board).sort());assert.deepEqual(hits.map(c=>c.key).sort(),keysFor(board).sort());
const files=[[path,sha(path)]];
for(const depth of [10,12]){const p=`${base}/tasks/label-development-50-p1-d${depth}.json`,r=read(p);assert.equal(hash(r.result),r.resultHash);assert.equal(hash({job:r.job,runIdentity:r.runIdentity}),r.inputHash);assert.deepEqual(keysFor(r.job.state.board).sort(),keysFor(parent.board).sort());files.push([p,sha(p)]);}
const report={registration:reg.checksum,provenance:audit.checksum,family:156,game:1444,step:6,occupied:18,board,player,historicalBoard:parent.board,historicalPlayer:parent.player,keys:keysFor(board),role:'Known direct old development-query parent, independently labeled D10/D12 and included in verified development panels. Not reclassified as an unrelated internal node; no claim of gradient-training reuse.',files,priorVerifiedFrontierHash:oldInput[1],broaderIndependentConfirmationClaim:false,allGamesRetained:true};
writeFileSync('docs/data/native-v2-overlap-proof-20261030.json',JSON.stringify(report)+'\n');console.log(JSON.stringify({verified:true,role:report.role,game:1444,step:6,occupied:18}));
