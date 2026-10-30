import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {PROTOCOL,schedule,slots} from '../scripts/native-v2/protocol.mjs';
import {analyze} from '../scripts/native-v2/statistics.mjs';
import {build} from '../scripts/native/build.mjs';
import {positions} from '../scripts/native-v2/positions.mjs';
import {players,playGame,replay} from '../scripts/native-v2/game.mjs';
const receipt=build({directory:resolve('.local-research/native-v2-experiment-test')});
test('native v2 registration balances source policies, actual turns, colors and nested timing dependence',()=>{
 const specs=slots(),rows=schedule();assert.equal(rows.length,2048);assert.equal(specs.length,768);
 for(const ms of [80,300])for(let cell=0;cell<16;cell++){
  const xs=rows.filter(r=>r.timeMs===ms&&specs[r.family].cell===cell);assert.equal(xs.length,ms===80?96:32);
  for(const f of new Set(xs.map(r=>r.family)))assert.deepEqual(xs.filter(r=>r.family===f).map(r=>r.color).sort(),[-1,1]);
 }
 const fake=rows.map(r=>({...r,points:r.family%4/4,margin:r.family%4-2,outcome:Math.sign(r.family%4-2)})),a=analyze(fake);
 assert.equal(a.difference.mean,0);assert.equal(a.conditions[80].n,768);assert.equal(a.conditions[300].n,256);assert.ok(a.conditions[80].bootstrap.score.distinct>1);
 assert.throws(()=>analyze(fake.slice(1)));assert.equal(PROTOCOL.depthLimit,null);
});
test('native B/P isolated games survive actual coordinator exit, replay and reject prefix tampering',async()=>{
 const d=mkdtempSync(join(tmpdir(),'reversi-v2-')),job=join(d,'job.json'),prefix=join(d,'prefix.json'),result=join(d,'result.json'),opening=positions()[15];
 try{
  writeFileSync(job,JSON.stringify({receipt,opening}));
  const args=['scripts/native-v2/restart-probe.mjs',job,prefix,result];
  const first=spawnSync(process.execPath,[...args,'interrupt'],{encoding:'utf8'});assert.equal(first.status,73,first.stderr);
  const saved=JSON.parse(readFileSync(prefix));assert.equal(saved.moves.length,1);
  const second=spawnSync(process.execPath,[...args,'resume'],{encoding:'utf8'});assert.equal(second.status,0,second.stderr);
  const g=JSON.parse(readFileSync(result));assert.deepEqual(replay(opening,g.moves,{complete:true}).board,g.board);assert.ok(g.moves.some(m=>m.model==='B'));assert.ok(g.moves.some(m=>m.model==='P'));
  const engines=await players(receipt);try{assert.notEqual(engines.B.child.pid,engines.P.child.pid);await assert.rejects(playGame(engines,opening,{timeMs:5,resume:{...saved,player:-saved.player}}));}finally{Object.values(engines).forEach(e=>e.close());}
 }finally{rmSync(d,{recursive:true,force:true});}
});
