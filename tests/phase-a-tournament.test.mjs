import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {TOURNAMENT,DRAFT,slots,schedule,requireRegistration} from '../scripts/phase-a-mac/prospective-protocol.mjs';
import {generate,verifyTrajectory} from '../scripts/residual/data.mjs';
import {sealed,checked} from '../scripts/phase-a-mac/tournament-common.mjs';
test('new authorization preserves stopped draft and balances actual turn and paired color',()=>{
 assert.equal(DRAFT.capMinutes,120);assert.equal(TOURNAMENT.capMinutes,180);assert.throws(()=>requireRegistration(TOURNAMENT));
 const counts=new Map();for(const s of slots()){const actual=s.reverse?-s.player:s.player,k=[s.policy,s.parity,actual,s.firstColor].join(':');counts.set(k,(counts.get(k)??0)+1);}
 assert.equal(counts.size,16);assert.ok([...counts.values()].every(n=>n===16));assert.equal(new Set(schedule().map(c=>c.family)).size,256);
});
test('disclosed generator is reproducible and rejects corrupt source path',()=>{
 for(const spec of slots().slice(0,4)){
  const protocol={namespace:TOURNAMENT.namespace+'-disclosed-test',strata:[[12,19]],commonPrefixBoundary:12};
  const a=generate(spec,spec.family,protocol),b=generate(spec,spec.family,protocol);delete a.wallMs;delete b.wallMs;assert.deepEqual(a,b);if(a.root)verifyTrajectory(a);
  const bad=structuredClone(a);bad.moves[0].move=0;assert.throws(()=>verifyTrajectory(bad));
 }
});
test('complete pair atomic receipt survives actual process exit and tampering fails closed',()=>{
 const dir=mkdtempSync(resolve(tmpdir(),'phase-a-pair-')),path=resolve(dir,'pair.json'),module=new URL('../scripts/phase-a-mac/tournament-common.mjs',import.meta.url).href;
 try{execFileSync(process.execPath,['--input-type=module','-e',`import {sealed} from ${JSON.stringify(module)};sealed(${JSON.stringify(path)},{fixture:true,pair:0,games:['a','b'],previous:null});`]);
  const p=checked(path);assert.deepEqual(p.games,['a','b']);sealed(path,{fixture:true,pair:0,games:['a','b'],previous:null});
  writeFileSync(path,readFileSync(path,'utf8').replace('"a"','"changed"'));assert.throws(()=>checked(path));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('family statistics use alpha .05 and retain 16 balanced bootstrap strata',async()=>{
 const {summarize}=await import('../scripts/phase-a-mac/tournament-statistics.mjs');
 const rows=slots().map(s=>({family:s.family,cell:s.cell,score:.5,margin:0})),s=summarize(rows);
 assert.equal(s.mean,.5);assert.equal(s.studentOneSided95Lower,.5);assert.ok(s.hoeffdingOneSided95Lower<.5);assert.deepEqual(s.scoreBootstrap95,[.5,.5]);
 assert.throws(()=>summarize([...rows.slice(1),rows[1]]));
 const varied=rows.map(r=>({...r,score:[0,.25,.5,.75,1][r.family%5],margin:r.family%5-2}));assert.deepEqual(summarize(varied),summarize(varied));
});
