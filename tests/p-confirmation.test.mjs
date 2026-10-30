import test from 'node:test';
import assert from 'node:assert/strict';
import {PROTOCOL,slots,schedule} from '../scripts/p-confirmation/protocol.mjs';
import {bootstrap,moments,inference,mean} from '../scripts/p-confirmation/statistics.mjs';
import {seededRandom} from '../src/learning.js';
import {studentCritical,pairSummary} from '../scripts/frozen-player/statistics.mjs';
test('confirmation fixes 768 independent slots, all 16 balanced cells and the nested 256-family dual subset',()=>{
 const ss=slots(),rows=schedule();assert.equal(ss.length,768);assert.equal(rows.length,2048);assert.deepEqual(rows,schedule());
 for(let cell=0;cell<16;cell++){const s=ss.filter(r=>r.cell===cell);assert.equal(s.length,48);assert.equal(s.filter(r=>r.dual).length,16);}
 for(const budget of [80,300]){const rs=rows.filter(r=>r.timeMs===budget);assert.equal(rs.length,budget===80?1536:512);for(const family of new Set(rs.map(r=>r.family)))assert.deepEqual(new Set(rs.filter(r=>r.family===family).map(r=>r.color)),new Set([-1,1]));}
 for(let i=0;i<rows.length;i+=2){assert.equal(rows[i].family,rows[i+1].family);assert.equal(rows[i].timeMs,rows[i+1].timeMs);assert.equal(rows[i].color,-rows[i+1].color);}
 assert.equal(PROTOCOL.models.P,'de4b84745589b0384ea3639f879e3c98990e802d176298ff8ef54f681520067f');assert.throws(()=>{PROTOCOL.families=2;});
});
test('tested family bootstrap preserves matched dependence, resamples nontrivially, rejects duplicate and missing values',()=>{
 const rows=Array.from({length:256},(_,family)=>({family,short:family%4/4,long:family%4/4+.25,difference:.25}));
 const b=bootstrap(rows,['short','long','difference']);assert.deepEqual(b,bootstrap(rows,['short','long','difference']));assert.deepEqual(b.difference.interval95,[.25,.25]);assert.ok(b.short.distinct>30);
 assert.ok(Math.abs(b.short.interval95[0]-(mean(rows.map(r=>r.short))-1.96*moments(rows.map(r=>r.short)).standardError))<.008);
 assert.throws(()=>bootstrap([...rows,rows[0]],['short']));assert.throws(()=>bootstrap(rows,['absent']));
});
test('prespecified t procedure has disclosed empirical null calibration at both fixed sample sizes',()=>{
 const random=seededRandom(2026102903),results=[];for(const n of [256,768])for(const distribution of ['symmetric','skew']){let reject=0;const critical=studentCritical(n-1),reps=4000;
  for(let rep=0;rep<reps;rep++){let sum=0,squares=0;for(let i=0;i<n;i++){const u=random(),x=distribution==='symmetric'?(u<.4?0:u<.6?.5:1):(u<2/3?.25:1);sum+=x;squares+=x*x;}const m=sum/n,v=(squares-n*m*m)/(n-1);if(m-critical*Math.sqrt(v/n)>.5)reject++;}
  const rate=reject/reps;assert.ok(rate>.012&&rate<.04,JSON.stringify({n,distribution,rate}));results.push({n,distribution,reps,reject,rate});
 }console.log('Prospective t null-calibration (simulation, not a universal coverage guarantee):',JSON.stringify(results));
 const s=pairSummary(Array.from({length:768},(_,i)=>i%2));assert.ok(Math.abs(s.hoeffdingRadius-Math.sqrt(Math.log(40)/1536))<1e-14);
});
