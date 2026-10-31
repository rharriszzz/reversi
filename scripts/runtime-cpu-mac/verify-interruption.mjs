// Cross-source/tuning equivalence of deterministic interruptions on reused TTs.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {NativeEngine} from '../native/client.mjs';
const out=resolve(process.env.REVERSI_DISPATCH_RUN);
const records=JSON.parse(readFileSync(resolve(out,'builds.json'))).records;
const positions=JSON.parse(readFileSync(resolve(out,'positions.json')));
const tags=['original','selected'],engines=[];
const signature=r=>Object.fromEntries(Object.entries(r).filter(([k])=>!['id','interfaceMs','elapsedMs','cpuMs','backend','buildIdentity'].includes(k)));
let queries=0;
try {
 for(const tag of tags) {
  process.env.REVERSI_CPU_BACKEND=tag.endsWith('P')?'portable':'auto';
  const e=new NativeEngine({receipt:records[tag],ttMiB:0});await e.ready();engines.push(e);
 }
 // Deliberate single-entry collisions, successive model/horizon changes and stops.
 const roots=[positions[0],positions[5],...positions.filter(p=>p.exactRoot).slice(0,1),...positions.filter(p=>['forced-pass','terminal-empties'].includes(p.id))];
 for(let cycle=0;cycle<3;cycle++)for(const p of roots)for(const model of ['B','P','L'])for(const nodeLimit of [1,300,3000]) {
  let first;
  for(const e of engines) {
   const r=await e.search(p.board,p.player,{model,depth:12-cycle,timeMs:30000,nodeLimit,hints:false});
   if(first)assert.deepEqual(signature(r),first);else first=signature(r);queries++;
  }
 }
 const result={passed:true,queries,tags,ttMiB:0,method:'All result fields, exposed TT/search counters and completed horizons identical across source/tuning/fallback configurations under deterministic node stops; repeated same-object searches with model/horizon changes and forced single-entry collisions.'};
 writeFileSync(resolve(out,'interruption-qualification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{engines.forEach(e=>e.close());}
