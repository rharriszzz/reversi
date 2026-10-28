import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parse,provenBoundary,identity,verifyExperimental,alternatives,query} from '../scripts/teacher/edax.mjs';
import {preflightIdentity,verifyPreflight,extremeFixtures} from '../scripts/teacher/bound-preflight.mjs';
import {read,atomic,sourceDigest} from '../scripts/research/io.mjs';
import {hash} from '../scripts/teacher/qualification-core.mjs';
import {solveBoth} from '../scripts/teacher/exact.mjs';
import {play,legalMoves} from '../src/rules.js';
import {replay} from '../scripts/teacher/qualification.mjs';
const line=(bound,score,pv='d3')=>`  1|   11  ${bound}${score>=0?'+':''}${score}        0:00.010          6235     623500 ${pv}`;
test('native extrema require exact windows or a correctly directed proof at the global boundary',()=>{
 for(const x of [-64,-63,63,64])assert.equal(parse(line(' ',x),1,[11])[0].score,x);
 for(const [b,s] of [['>',64],['<',-64]])assert.equal(parse(line(b,s),1,[11])[0].score,s);
 for(const [b,s] of [['>',63],['<',-63],['<',64],['>',-64],['?',64]])assert.throws(()=>parse(line(b,s),1,[11]));
 assert.equal(provenBoundary('<',64),false);assert.throws(()=>parse(line(' ',63,'d3 garbage'),1,[11]));assert.throws(()=>parse(line(' ',63),1,[12]));assert.throws(()=>parse(line(' ',65),1,[11]));
});
test('synthetic extrema distinguish raw odd terminal margins from awarded even terminal scores',()=>{
 const fixtures=extremeFixtures();for(const s of fixtures){const r=solveBoth(s.board,s.player);assert.ok(r.raw.exact&&r.awarded.exact);}
 assert.equal(solveBoth(fixtures[0].board,1).raw.value,63);assert.equal(solveBoth(fixtures[0].board,1).awarded.value,64);
 assert.equal(solveBoth(fixtures[4].board,1).raw.value,63);assert.equal(solveBoth(fixtures[5].board,-1).raw.value,-63);
});
test('adapter preflight is bound to its tested source files and teacher identity',()=>{
 const dir=mkdtempSync(join(tmpdir(),'bound-proof-'));try{const pin={binarySha:'a'},path=join(dir,'proof.json');atomic(path,{passed:true,identity:hash(preflightIdentity(pin))});assert.equal(verifyPreflight(path,pin,{requireReady:false}).passed,true);assert.throws(()=>verifyPreflight(path,{binarySha:'b'},{requireReady:false}),/mismatch/);atomic(path,{passed:false,identity:hash(preflightIdentity(pin))});assert.throws(()=>verifyPreflight(path,pin),/mismatch/);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('executable source identities include the native patch',()=>{
 const dir=mkdtempSync(join(tmpdir(),'bound-source-'));try{for(const p of ['src/a.js','scripts/a.patch','tests/a.js','docs/data/a.json','package.json'])atomic(join(dir,p),p.endsWith('.json')?{}:'x');const a=sourceDigest(dir);atomic(join(dir,'scripts/a.patch'),'y');assert.notEqual(sourceDigest(dir),a);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('separate repaired native build resolves disclosed saturation and preserves exact alternatives',async()=>{
 if(!process.env.REVERSI_BOUND_TEST)return;
 const buildFile='.local-research/teacher/edax-fixed-v2/build.json',meta=read(buildFile),pin=identity(meta.binary,'.local-research/teacher/edax/bin/data/eval.dat',{buildFile}),s=read('tests/fixtures/edax-bound.json');
 assert.ok(verifyExperimental(buildFile,meta.binary));const r=await alternatives(pin,s,12,{measureNative:true});assert.deepEqual(r.rows.map(x=>x.value),[-63,-61,-63,-63]);assert.ok(r.rows.every(x=>x.bound==='exact-window'));replay(s,r);
 const child=[...play(s.board,s.player,4)],q=await query(pin,[{board:child,player:1},{board:child,player:-1}],11);assert.deepEqual(q.rows.map(x=>x.score),[63,-63]);
 const leaf=read('tests/fixtures/edax-bound-leaf.json').state;assert.equal((await query(pin,[leaf],1)).rows[0].score,-64);assert.equal(solveBoth(leaf.board,leaf.player).awarded.value,-64);
 for(const s of extremeFixtures()){const r=await alternatives(pin,s,Math.max(2,s.board.filter(x=>!x).length)),ref=solveBoth(s.board,s.player).awarded;if(ref.rows.length)assert.deepEqual(r.rows.map(x=>[x.move,x.value||0]),ref.rows.map(x=>[x.move,x.value||0]));else assert.equal(r.rows[0].value,ref.value);replay(s,r);if(s.id.startsWith('forced-pass'))assert.ok(r.rows[0].normalizedPass);}
});

test('V4 admission reserves every role freshly without reading old assessment outcomes and resumes exactly',async()=>{
 const {reserveData}=await import('../scripts/teacher/qualification-data.mjs');const {PROTOCOL}=await import('../scripts/teacher/qualification-core.mjs');const {mkdirSync}=await import('node:fs');const {verifyTrajectory}=await import('../scripts/teacher/qualification-import.mjs');
 const dir=mkdtempSync(join(tmpdir(),'fresh-v4-'));try{
  for(const name of ['strong-six-hour-20261027','six-hour-20261027','next-frozen-screen-20261028','teacher-audit-v1-20261028'])atomic(`${dir}/.local-research/${name}/manifest.json`,{seed:1});mkdirSync(`${dir}/.local-research/teacher-audit-v1-20261028/tasks`);atomic(`${dir}/docs/data/teacher-audit-20261028.json`,{summary:{examples:[]}});
  const protocol={...PROTOCOL,namespace:'fresh-v4-test',costPerPhase:2,assessmentPerPhase:2,exactCostPerEmpty:1,exactAssessmentPerEmpty:1,assessmentOddPerPhase:1},output=`${dir}/.local-research/current`;
  const r=await reserveData(dir,output,()=>{},()=>{},{protocol});assert.equal(r.import,null);assert.deepEqual(Object.values(r.roles).map(a=>a.length),[8,8,2,2]);assert.equal(r.oddIds.length,4);
  for(const roots of Object.values(r.roles))for(const s of roots)verifyTrajectory(s,read(`${output}/trajectories/${s.id}.json`),protocol.namespace);
  assert.equal((await reserveData(dir,output,()=>{},()=>{},{protocol})).digest,r.digest);
  const saved=read(`${output}/admission-progress.json`);saved.attempts++;atomic(`${output}/admission-progress.json`,saved);await assert.rejects(reserveData(dir,output,()=>{},()=>{},{protocol}),/checkpoint identity/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('independent mailbox horizon oracle agrees on exact endings and truncated native alternatives',async()=>{
 if(!process.env.REVERSI_BOUND_TEST)return;const {spawnSync}=await import('node:child_process');const {trajectory}=await import('../scripts/teacher/validate.mjs');const buildFile='.local-research/teacher/edax-fixed-v2/build.json',meta=read(buildFile),pin=identity(meta.binary,'.local-research/teacher/edax/bin/data/eval.dat',{buildFile});
 for(let i=0;i<6;i++){const s=trajectory(824910+i).find(x=>x.board.filter(v=>!v).length===6),text=s.board.map(x=>x===1?'X':x===-1?'O':'-').join('');for(const d of [3,6]){const r=spawnSync('.local-research/edax-bound-20261028/horizon-oracle',['.local-research/teacher/edax/bin/data/eval.dat',text,s.player===1?'X':'O',String(d)],{encoding:'utf8',timeout:5000});assert.equal(r.status,0,r.stderr);const o=JSON.parse(r.stdout),n=await alternatives(pin,s,d);assert.deepEqual(n.rows.map(x=>[x.move,x.value||0]),o.rows.map(x=>[x.move,x.value||0]));if(d===6)assert.deepEqual(o.rows.map(x=>[x.move,x.value||0]),solveBoth(s.board,s.player).awarded.rows.map(x=>[x.move,x.value||0]));}}
});
