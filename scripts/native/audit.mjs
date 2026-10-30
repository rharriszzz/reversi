#!/usr/bin/env node
// Independent mailbox replay; full schedule/source/receipt validation first.
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { oracleChildren } from '../../tests/oracle.mjs';
import { initialBoard } from '../../src/rules.js';
import { sha } from './build.mjs';
import { hash,schedule,PROTOCOL } from './protocol.mjs';
import { analyze } from './statistics.mjs';
import { measure,output,atomic,read } from './measure.mjs';
await measure('audit-analysis',async()=>{
 const reg=read(resolve(output,'registration.json')),{checksum,...body}=reg;assert.equal(hash(body),checksum);assert.deepEqual(reg.protocol,PROTOCOL);assert.deepEqual(reg.schedule,schedule());
 for(const [p,digest] of Object.entries(reg.sources)){assert.equal(sha(readFileSync(p)),digest);assert.equal(sha(readFileSync(resolve(output,'snapshot',p))),digest);}
 assert.equal(sha(readFileSync(reg.receipt.executable)),reg.receipt.executableSha256);
 const families=new Set(),ancestry=new Set();
 for(const opening of reg.openings) {
  let b=[...initialBoard()],p=1;for(const m of opening.moves) {assert.equal(m.player,p);const children=oracleChildren(b,p);if(m.move===null)assert.equal(children.length,0);else {const c=children.find(c=>c.move===m.move);assert.ok(c);b=c.board;}p=-p;}
  assert.deepEqual(b,opening.board);assert.equal(p,opening.player);assert.equal(b.filter(Boolean).length,opening.target);families.add(opening.family);
 }
 assert.equal(families.size,256);
 const games=[],receiptDigests=[];
 for(const c of reg.schedule) {
  const path=resolve(output,`games/game-${c.game}.json`),record=read(path),{checksum,...rbody}=record;assert.equal(hash(rbody),checksum);assert.deepEqual(record.condition,c);assert.equal(record.registration,reg.checksum);assert.equal(hash(record.result),record.resultHash);
  const g=record.result,o=reg.openings[c.family];assert.deepEqual(g.opening,o);assert.equal(g.nativeColor,c.nativeColor);assert.equal(g.timeMs,c.timeMs);assert.equal(g.model,'P');
  const identity=hash({opening:o,model:'P',modelIdentity:reg.receipt.models.P,build:reg.receipt.fingerprint,nativeColor:c.nativeColor,timeMs:c.timeMs,depth:14});assert.equal(g.identity,identity);
  let board=o.board,player=o.player,passes=0;
  for(const m of g.moves) {
   assert.equal(m.player,player);const children=oracleChildren(board,player);
   if(m.move===null){assert.equal(children.length,0);passes++;}
   else {const child=children.find(x=>x.move===m.move);assert.ok(child);assert.equal(m.occupied,board.filter(Boolean).length);board=child.board;passes=0;
    assert.equal(m.backend,player===c.nativeColor?'native':'javascript');assert.equal(m.modelIdentity,reg.receipt.models.P);assert.ok(m.depth>=0&&m.depth<=14);assert.ok(m.nodes>=m.evaluations);assert.ok(m.elapsedMs>=0&&m.measuredMs>=0);
    if(m.backend==='native')assert.equal(m.buildIdentity,reg.receipt.fingerprint);
   }player=-player;assert.ok(passes<=2);
  }
  assert.equal(passes,2);assert.deepEqual(board,g.board);assert.equal(g.margin,(board.reduce((n,v)=>n+v,0)*c.nativeColor)||0);assert.equal(g.outcome,Math.sign(g.margin));assert.equal(g.points,(1+Math.sign(g.margin))/2);
  receiptDigests.push({game:c.game,sha256:sha(readFileSync(path)),checksum:record.checksum});games.push({...g,...c});
 }
 const result={format:'native-search-strength-v1',registration:reg.checksum,receipt:reg.receipt,verification:{passed:true,games:768,reservations:256,independentMailboxReplay:true,sourceSnapshotVerified:true,receiptDigests},statistics:analyze(games)};
 atomic(resolve(output,'summary.json'),result);
 // Compact public paths + aggregate telemetry; raw full per-move receipts stay
 // local. Enough to independently reproduce game outcomes and paired statistics.
 atomic(resolve(output,'public-games.json'),{registration:reg.checksum,games:games.map(g=>({game:g.game,family:g.family,nativeColor:g.nativeColor,timeMs:g.timeMs,opening:{board:g.opening.board,player:g.opening.player},moves:g.moves.map(m=>({player:m.player,move:m.move})),board:g.board,margin:g.margin,outcome:g.outcome,points:g.points}))});
 console.log(JSON.stringify({passed:true,conditions:result.statistics.conditions,matched:result.statistics.matched}));
});
