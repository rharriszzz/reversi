import {WasmEngine} from '../../src/wasm-engine.js';
let engine;let queue=Promise.resolve();
self.onmessage=({data})=>{queue=queue.then(async()=>{
 try {
  let result;
  if(data.op==='init'){engine=await WasmEngine.create({ttMiB:16});result={initializationMs:engine.initializationMs,memoryBytes:engine.memoryBytes};}
  else if(data.op==='search')result=engine.search(data.board,data.player,{model:'P',timeMs:data.budgetMs,hints:true});
  else if(data.op==='warmup')result=engine.search(data.board,data.player,{model:'P',depth:3,hints:true});
  else throw Error('Unknown backend engineering operation');
  self.postMessage({id:data.id,result});
 }catch(error){self.postMessage({id:data.id,error:String(error.stack??error)});}
 });};
