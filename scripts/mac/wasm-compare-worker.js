import {WasmEngine} from '../../src/wasm-engine.js';
const engines={};let queue=Promise.resolve();
self.onmessage=({data})=>{queue=queue.then(async()=>{
 try {
  let result;
  if(data.op==='init') {
   engines.baseline=await WasmEngine.create({expected:data.baseline});engines.final=await WasmEngine.create();
   result=Object.fromEntries(Object.entries(engines).map(([tag,e])=>[tag,{actualBuildIdentity:e.module.UTF8ToString(e.module._rv_build_id()),memoryBytes:e.memoryBytes}]));
  }else {
   const e=engines[data.tag];result=e.search(data.p.board,data.p.player,{model:data.model,depth:data.depth,hints:false});
   // The production adapter is for its committed manifest. Explicit alternate
   // qualification builds are identified here by their actual ABI build string.
   result.buildIdentity=e.module.UTF8ToString(e.module._rv_build_id());
  }
  self.postMessage({id:data.id,result});
 }catch(error){self.postMessage({id:data.id,error:String(error.stack??error)});}
 });};
