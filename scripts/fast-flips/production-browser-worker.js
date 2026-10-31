import {WasmEngine} from '../../src/wasm-engine.js';
const engines={};
self.onmessage=async({data})=>{
 try {
  if(data.op==='init') {
   engines.original=await WasmEngine.create({expected:data.originalExpected});engines.selected=await WasmEngine.create({expected:data.expected});
   self.postMessage({id:data.id,result:Object.fromEntries(Object.entries(engines).map(([tag,e])=>[tag,e.module.UTF8ToString(e.module._rv_build_id())]))});return;
  }
  const e=engines[data.tag];
  const one=p=>data.mode==='coach'?e.analyze(p.board,p.player,6,data.model):e.search(p.board,p.player,{model:data.model,depth:p.depth,hints:false});
  for(const p of data.positions)one(p);
  const start=performance.now();let coreMs=0,nodes=0,evaluations=0,roots=[];
  for(let rep=0;rep<data.repeats;rep++) {
   roots=[];
   for(const p of data.positions) {
    const r=one(p);coreMs+=r.elapsedMs;nodes+=r.nodes;evaluations+=r.evaluations;
    const keys=['score','move','depth','exact','nodes','evaluations','ttProbes','ttHits','ttBoundHits','ttCollisions','ttReplacements','cutoffs','ttCutoffs','ttStores','ttRejectedStores','firstMoveCutoffs'];
    const row=Object.fromEntries(keys.map(k=>[k,r[k]]));
    if(r.results)row.alternatives=r.results.map(x=>({move:x.move,score:x.score,exact:x.exact,pv:x.pv}));
    roots.push(row);
   }
  }
  self.postMessage({id:data.id,result:{wallMs:performance.now()-start,coreMs,nodes,evaluations,roots,repeats:data.repeats}});
 }catch(error){self.postMessage({id:data.id,error:String(error.stack??error)});}
};
