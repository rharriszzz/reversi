#!/usr/bin/env node
// Balanced warm comparisons; mathematical identity checked in every trial.
import { read, atomic } from '../research/io.mjs';
import { EncodingCache } from '../strong/encoding-cache.mjs';
import { createModel } from '../strong/model.mjs';
import { fit } from '../strong/train.mjs';
import { Profiler } from '../strong/telemetry.mjs';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const output=process.argv[2]??'.local-research/next-encoding';mkdirSync(output,{recursive:true});
const games=read('.local-research/next-integrated/data.json').games,labels=read('.local-research/next-integrated/labels.json').labels;
const results=[];
for(let repeat=0;repeat<6;repeat++) {
 const trial={repeat};let reference;
 for(const cached of (repeat%2?[true,false]:[false,true])) {
  const model=createModel('long','rank'),profile=new Profiler(),cache=cached?new EncodingCache():null,cpu=process.cpuUsage(),start=performance.now();
  for(let batch=0;batch<8;batch++)fit(model,games,labels,games,{epochs:6,seed:batch,encodingCache:cache,profile});
  const c=process.cpuUsage(cpu);trial[cached?'cached':'reference']={wallMs:performance.now()-start,cpuMs:(c.user+c.system)/1000,profile:profile.snapshot(),cache:cache?.snapshot()};
  if(reference)assert.deepEqual(model.weights,reference);else reference=Float32Array.from(model.weights);profile.close();
 }
 results.push(trial);
}
atomic(`${output}/results.json`,{results,semantics:'Identical weights/count-dependent encoding; eight successive fits of 64 games, six epochs, balanced trial order. Fresh control models, not the frozen screen models.'});
console.log(JSON.stringify(results.map(r=>({repeat:r.repeat,referenceMs:r.reference.wallMs,cachedMs:r.cached.wallMs}))));
