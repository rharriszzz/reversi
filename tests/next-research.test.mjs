import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { shortlist, budgetPlan } from '../scripts/strong/selection.mjs';
import { Progress, compactEpoch, historyChunk } from '../scripts/strong/telemetry.mjs';
const metric=(id,cost,accuracy,regret)=>({id,speed:{microseconds:cost},ranking:{exact:{pairAccuracy:accuracy,regret},search:{pairAccuracy:.7}}});
test('small ranking difference cannot exclude fast long patterns, diversity and domination audited',()=>{
 const result=shortlist([metric('linear-rank-p4',2,.67,4),metric('long-margin-p4',.8,.6664,3.4),metric('hybrid-rank-p4',7,.68,3.5),metric('short-rank-p4',4,.5,7)]);
 assert.ok(result.frontier.includes('long-margin-p4'));assert.ok(result.ids.includes('long-margin-p4'));assert.ok(result.ids.some(id=>id.startsWith('hybrid')));assert.ok(!result.frontier.includes('short-rank-p4'));
});
test('conservative plan uses slowest repetitions, explicit 35 percent overhead and safety; rejects infeasible',()=>{
 const p=budgetPlan(21600000,120000,{20:[3000,4000],80:[7000,8500],300:[23000,30000]});
 assert.equal(p.slower[300],30000);assert.equal(p.overhead,1.35);assert.equal(p.safetyMs,900000);assert.ok(p.learningEnd<21600000-p.confirmationMs-p.safetyMs);
 assert.throws(()=>budgetPlan(600000,1,{20:[3000],80:[8000],300:[30000]}),/infeasible/);
});
test('event logs distinguish actual new positions, long fitting, checkpoint and immutable detail',()=>{
 const dir=mkdtempSync(join(tmpdir(),'reversi telemetry ')),lines=[];
 try {const p=new Progress(dir,{write:line=>lines.push(line)});p.set({stage:'learning',substage:'fit',task:'long-margin',positions:40,epoch:'3/6',note:'no new training positions expected'});p.emit('checkpoint',{checkpoint:'test'});p.close();
 const events=readFileSync(join(dir,'telemetry.jsonl'),'utf8').trim().split('\n').map(JSON.parse);assert.equal(events[0].newPositions,40);assert.equal(events[1].newPositions,0);assert.ok(lines.every(l=>l.includes('ETA stage=unknown')));assert.match(lines[0],/epoch=3\/6/);
 const rows=[{epoch:1,mse:2,byPolicy:{large:true},ranking:{exact:{regret:3},search:{},records:[1,2]}}],path=historyChunk(dir,'fit-1',rows);assert.deepEqual(JSON.parse(readFileSync(path)).rows,rows);assert.ok(!('byPolicy' in compactEpoch(rows[0])));assert.ok(!('records' in compactEpoch(rows[0]).ranking));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('cached raw encoding preserves trained weights, counts and metrics across changing shrink counts',async()=>{
 const { EncodingCache }=await import('../scripts/strong/encoding-cache.mjs');
 const { createModel,pack,unpack }=await import('../scripts/strong/model.mjs');
 const { fit }=await import('../scripts/strong/train.mjs');
 const { generate,searchLabel }=await import('../scripts/strong/data.mjs');
 const games=[generate({seed:913141,index:1,split:'test'})],labels=[searchLabel(games[0].states[8],3)];
 for(const family of ['long','linear']){
  const a=createModel(family,'rank'),b=unpack(pack(a)),cache=new EncodingCache(2000);
  for(let repeat=0;repeat<2;repeat++){
   const reports=[];
   const x=fit(a,games,labels,games,{epochs:2,seed:repeat}),y=fit(b,games,labels,games,{epochs:2,seed:repeat,encodingCache:cache,progress:row=>reports.push(row)});
   assert.equal(reports[0].positions,0);assert.equal(reports.at(-1).positions,y.examples*y.curve.length);
   assert.deepEqual(a.weights,b.weights);assert.deepEqual(a.counts,b.counts);assert.deepEqual(x.loss,y.loss);
  }
  assert.ok(cache.hits>0);assert.ok(cache.rows.size<=cache.limit);
 }
});
