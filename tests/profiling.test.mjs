import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {validateProfile,hotspots,addressTree,callTree,visibleChildren,differential,speedscope} from '../profiling/model.js';
// Synthetic accounting fixtures only; never shown as measured example data.
const frame=(name,address,start,end,unresolved=false)=>({name,symbol:name,module:unresolved?'Unresolved':'engine',address,relativeAddress:address,start,end,unresolved});
function ip(){return {version:1,id:'test',kind:'ip',method:'hardware-ip',workloadId:'fixed',workloadFingerprint:'same-board-and-work',buildId:'test',event:{name:'cycles',unit:'cycles',trigger:'PMU overflow',period:10},timestamps:{provenance:'Unit-test fixture'},frames:[frame('A','0x100','0x100','0x120'),frame('B','0x124','0x120','0x140'),{name:'unknown',module:'Unresolved',address:'0xfff',unresolved:true}],samples:[[0,0,10,'P'],[1,0,10,'P'],[2,1,10,'P'],[3,2,10,'E']],accounting:{samples:4,weight:40,unresolvedWeight:10,lost:null,discarded:2}};}
function stack(){const p=ip();p.kind='stacks';p.method='hardware-raw-stacks';p.stacks=[[0,1,0,1],[0],[2],[]];p.samples=[[0,0,10,'P'],[1,1,10,'P'],[2,2,10,'E'],[3,3,10,'P']];p.accounting.unresolvedWeight=20;return p;}
const totalSelf=n=>n.self+n.children.reduce((x,c)=>x+totalSelf(c),0);
test('IP event mass, unresolved observations and display Other are conserved',()=>{
 const p=validateProfile(ip()),rows=hotspots(p);assert.equal(rows.reduce((x,r)=>x+r.self,0),40);assert.equal(rows.find(r=>r.name==='A').self,20);
 const tree=addressTree(p);assert.equal(tree.weight,40);assert.equal(totalSelf(tree),40);const children=visibleChildren(tree,.9);assert.equal(children.length,1);assert.match(children[0].name,/Other/);assert.equal(children[0].weight,40);assert.equal(children[0].children.length,2);
 assert.throws(()=>callTree(p),/actual sampled/);assert.throws(()=>speedscope(p),/calling stacks/);
});
test('recursion, empty stacks and overlapping inclusive rows have coherent costs',()=>{
 const p=validateProfile(stack()),rows=hotspots(p);assert.equal(rows.reduce((x,r)=>x+r.self,0),40);assert.equal(rows.find(r=>r.name==='A').inclusive,20);assert.equal(rows.find(r=>r.name==='B').inclusive,10);assert.equal(rows.find(r=>r.name==='B').self,10);
 const tree=callTree(p);assert.equal(tree.weight,40);assert.equal(totalSelf(tree),40);assert.equal(tree.self,10);assert.equal(tree.children.find(n=>n.name==='A').children[0].children[0].name,'A');
 const s=speedscope(p);assert.deepEqual(s.profiles[0].samples[0],[0,1,0,1]);assert.equal(s.profiles[0].weights.reduce((a,b)=>a+b),40);assert.equal(s.profiles[0].unit,'none');
});
test('containment uses half-open bounds and supports full-width address strings',()=>{
 for(const address of ['0x0ff','0x120']){const p=ip();p.frames[0].relativeAddress=address;assert.throws(()=>validateProfile(p),/outside/);}
 const logical=ip();Object.assign(logical.frames[0],{symbol:'inline logical function',name:'inline logical function',containingSymbol:'A',inlined:true});assert.equal(addressTree(logical).children.find(c=>c.name==='engine').children.find(c=>c.name==='A').name,'A');
 const p=ip();Object.assign(p.frames[0],{address:'0xffffffffffffff00',relativeAddress:'0xffffffffffffff00',start:'0xfffffffffffffe00',end:'0xffffffffffffffff'});assert.doesNotThrow(()=>validateProfile(p));
});
test('differential normalization is invariant to sampling density, and rejects mismatches',()=>{
 const a=ip(),b=structuredClone(a);b.samples=b.samples.map(s=>[s[0],s[1],s[2]*5,s[3]]);b.accounting.weight*=5;b.accounting.unresolvedWeight*=5;
 assert.ok(differential(a,b).every(r=>r.delta===0));b.workloadFingerprint='different-board';assert.throws(()=>differential(a,b),/matched/);b.workloadFingerprint=a.workloadFingerprint;b.event.name='L1D miss';assert.throws(()=>differential(a,b),/matched/);
 assert.throws(()=>differential(a,a,true),/real stacks/);
});
test('malformed references, weights, timestamps, denominators and fabricated IP stacks fail visibly',()=>{
 const edits=[p=>p.samples[0][1]=99,p=>p.samples[0][2]=-1,p=>p.samples[0][2]=Infinity,p=>p.samples[0][0]=-1,p=>p.samples[2][0]=0,p=>delete p.timestamps,p=>p.accounting.weight++,p=>p.accounting.samples++,p=>p.accounting.unresolvedWeight=0,p=>p.accounting.lost=-1,p=>p.accounting.discarded=-1,p=>p.stacks=[]];
 for(const edit of edits){const p=ip();edit(p);assert.throws(()=>validateProfile(p));}
 const p=stack();p.stacks[0].push(80);assert.throws(()=>validateProfile(p),/frame reference/);
 const bounded=ip();bounded.timestamps={provenance:'Test boundaries',originTraceNs:10,endTraceNs:12};assert.throws(()=>validateProfile(bounded),/outside capture/);
});
test('a missing IP retains unresolved mass without fabricating an address',()=>{const p=ip();p.frames[2].address=null;validateProfile(p);assert.equal(p.accounting.unresolvedWeight,10);p.frames[0].address=null;assert.throws(()=>validateProfile(p),/remain unresolved/);});
test('flat address records without timestamps remain valid and do not acquire time or callers',()=>{
 const p=ip();p.samples.forEach(s=>s[0]=null);delete p.timestamps;validateProfile(p);const tree=addressTree(p);assert.equal(tree.count,4);assert.equal(p.stacks,undefined);assert.equal(p.timestamps,undefined);
});
test('committed real captures balance with the same accounting used by every view',()=>{
 const path=new URL('../docs/data/profiling/manifest.json',import.meta.url);assert.ok(existsSync(path),'Commit qualified example captures');const m=JSON.parse(readFileSync(path));assert.ok(m.profiles.length>=4);
 for(const meta of m.profiles){const p=validateProfile(JSON.parse(readFileSync(new URL('../docs/data/profiling/'+meta.file,import.meta.url))));assert.equal(p.accounting.samples,meta.samples);assert.equal(addressTree(p).weight,p.accounting.weight);assert.equal(hotspots(p).reduce((x,r)=>x+r.self,0),p.accounting.weight);if(p.kind==='stacks')assert.equal(totalSelf(callTree(p)),p.accounting.weight);}
});
test('committed benchmark populations, throughput and paired effect denominators match full trials',()=>{
 const b=JSON.parse(readFileSync(new URL('../docs/data/profiling/benchmarks.json',import.meta.url)));
 const mean=a=>a.reduce((s,x)=>s+x,0)/a.length,median=a=>{a=[...a].sort((x,y)=>x-y);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;};
 const close=(a,c)=>assert.ok(Math.abs(a-c)<=1e-9*Math.max(1,Math.abs(c)));
 assert.equal(b.trials.length,564);assert.equal(b.captureStatistics.length,480);
 for(const g of b.groups){
  const rows=b.trials.filter(r=>r.workload===g.workloadId&&r.tag===g.buildId&&r.mode===g.mode);
  assert.equal(g.wall.n,rows.length);assert.deepEqual(g.wall.values,rows.map(r=>r.result.wallSeconds));close(g.wall.median,median(g.wall.values));close(g.wall.mean,mean(g.wall.values));
  close(g.nodesPerSecond,g.metrics.nodes/g.wall.median);close(g.evaluationsPerSecond,g.metrics.evaluations/g.wall.median);
  for(const r of rows){assert.deepEqual(r.result.metrics,g.metrics);assert.equal(r.result.repeats,g.repeats);assert.equal(r.result.ipAttempts,0);}
  if(g.mode==='plain')continue;
  const controls=b.trials.filter(r=>r.workload===g.workloadId&&r.tag===g.buildId&&r.mode==='plain');
  for(const [field,key] of [['wallSeconds','wallEffect'],['workloadCpuSeconds','cpuEffect']]){
   const logs=rows.map(r=>Math.log(r.result[field]/controls.find(c=>c.rep===r.rep).result[field]));close(g[key].percent,100*Math.expm1(mean(logs)));assert.equal(g[key].n,logs.length);assert.ok(g[key].low<=g[key].percent&&g[key].percent<=g[key].high);
  }
 }
});
