// Brief fixed-work follow-up; no tournament, profiling or experimental builds.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NativeEngine} from '../native/client.mjs';
import {sha} from '../native/build.mjs';
const bytes=readFileSync('docs/data/fast-flips-mac/positions.json');
assert.equal(sha(bytes),'a8deadc89f811e02da19910a702b073de12707ef19895a10f7d9861d088dcfee');
const positions=JSON.parse(bytes),reference=JSON.parse(readFileSync('docs/data/fast-flips-mac/final-search.json'));
const e=new NativeEngine(),rows=[];
try {
  await e.ready();
  for(let rep=-1;rep<3;rep++)for(const model of ['B','P']) {
    const start=performance.now();let coreMs=0,cpuMs=0,nodes=0;
    for(const [i,p] of positions.entries()) {
      const expected=reference.rootReferences[`mixed48-${model}`][i];
      const r=await e.search(p.board,p.player,{model,depth:expected.depth,hints:false});
      for(const key of ['score','depth','exact'])assert.equal(r[key],expected[key]);
      assert.equal(r.move,expected.move<0?null:expected.move);
      assert.equal(r.nodes,expected.metrics.nodes);assert.equal(r.evaluations,expected.metrics.evaluations);
      coreMs+=r.elapsedMs;cpuMs+=r.cpuMs;nodes+=r.nodes;
    }
    if(rep>=0)rows.push({rep,model,roots:positions.length,outerWallMs:performance.now()-start,coreMs,cpuMs,nodes});
  }
  console.log(JSON.stringify({passed:true,workloadSha256:sha(bytes),native:e.receipt,rows,method:'Mixed48 matched published horizons/scores/nodes/evaluations, one full warmup and three batches per B/P; core and IPC-inclusive wall are separate.'}));
}finally{e.close();}
