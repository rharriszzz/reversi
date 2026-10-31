// Test-only Safari WebDriver boundary; searches use the production adapter/core.
import {WasmEngine,manifest} from '../src/wasm-engine.js';
let engine;let queue=Promise.resolve();
self.onmessage=({data})=>{queue=queue.then(async()=>{
 try {
  let result;const {op,p,model='P',depth=3}=data;
  if(op==='init'||op==='reinit'){
   engine?.close();engine=await WasmEngine.create({ttMiB:data.ttMiB??16});
   result={initializationMs:engine.initializationMs,memoryBytes:engine.memoryBytes,buildIdentity:manifest.fingerprint,models:manifest.models};
  }else if(op==='inspect')result=engine.inspect(p.board,p.player,model);
  else if(op==='search')result=engine.search(p.board,p.player,{model,depth:data.timeMs?undefined:depth,timeMs:data.timeMs??0,nodeLimit:data.nodeLimit??0,hints:false,tt:data.tt??true});
  else if(op==='analyze')result=engine.analyze(p.board,p.player,depth,model);
  else if(op==='windows')result=engine.windows(p.board,p.player,model,depth,data.alpha,data.beta,data.tt??true);
  else if(op==='close'){engine.close();engine.close();result={closed:true};}
  else if(op==='wrong-abi'){
   const invalid=await WasmEngine.create({expected:{...manifest,abi:999}});invalid.close();throw Error('Wrong ABI unexpectedly accepted');
  }else if(op==='wrong-model'){
   const invalid=await WasmEngine.create({expected:{...manifest,models:{...manifest.models,P:'wrong-model'}}});invalid.close();throw Error('Wrong model unexpectedly accepted');
  }else throw Error('Unknown Safari qualification operation');
  self.postMessage({id:data.id,result});
 }catch(error){self.postMessage({id:data.id,error:String(error.message??error)+'\n'+String(error.stack??'')});}
 });};
