// One correctness batch per backend/model, against the qualified PC references.
// This is not a timing campaign; production-smoke.mjs supplies the brief clocks.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NativeEngine} from '../native/client.mjs';
import {sha} from '../native/build.mjs';
const file='docs/data/runtime-cpu-followup/search.json',reference=JSON.parse(readFileSync(file));
const positions=JSON.parse(readFileSync('docs/data/fast-flips-mac/positions.json'));
const fields={nodes:'nodes',evaluations:'evaluations',ttProbes:'probes',ttHits:'hits',ttBoundHits:'boundHits',ttCollisions:'collisions',ttReplacements:'replacements',cutoffs:'cutoffs',ttCutoffs:'ttCutoffs',ttStores:'stores',ttRejectedStores:'rejectedStores',firstMoveCutoffs:'firstMoveCutoffs'};
const original=process.env.REVERSI_CPU_BACKEND,rows=[];let queries=0;
try {
 for(const backend of ['auto','portable'])for(const model of 'BLP') {
  process.env.REVERSI_CPU_BACKEND=backend;const engine=new NativeEngine();
  try {
   const hello=await engine.ready();assert.equal(hello.cpuBackend,backend==='auto'?'x86-popcnt-bmi1-bmi2-lzcnt':'portable');
   {
    const expected=reference.rootReferences['mixed48-'+model];let nodes=0,evaluations=0;
    // The archived fixed-work driver starts a separate Engine per model and
    // performs two full warmup batches. Match its TT population before checking
    // hits/collisions, which also count entries left by previous generations.
    for(let warmup=0;warmup<2;warmup++)for(const [i,p] of positions.entries())await engine.search(p.board,p.player,{model,depth:expected[i].depth,hints:false});
    for(const [i,p] of positions.entries()) {
     const r=await engine.search(p.board,p.player,{model,depth:expected[i].depth,hints:false}),v=expected[i];
     for(const key of ['score','depth','exact'])assert.equal(r[key],v[key]);
     assert.equal(r.move,v.move<0?null:v.move);
     for(const [key,metric] of Object.entries(fields))assert.equal(r[key],v.metrics[metric],`${backend}/${model}/${p.id}/${key}`);
     nodes+=r.nodes;evaluations+=r.evaluations;queries++;
    }
    rows.push({backend,model,nodes,evaluations,roots:48});
   }
  }finally{engine.close();}
 }
}finally{if(original===undefined)delete process.env.REVERSI_CPU_BACKEND;else process.env.REVERSI_CPU_BACKEND=original;}
console.log(JSON.stringify({passed:true,queries,warmupBatches:2,referenceFile:file,referenceSha256:sha(readFileSync(file)),counterFields:fields,rows}));
