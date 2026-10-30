import {WasmEngine} from '../src/wasm-engine.js';
import {findBestMove} from '../src/search.js';
import {evaluators} from '../.local-research/wasm-20261030/js-reference.js';
let engine;let queue=Promise.resolve();
self.onmessage=({data})=>{queue=queue.then(async()=>{
 const {id,op,p,model='B',depth=4,timeMs,n=100000}=data;
 try {
  let result;
  if(op==='init'){
   const start=performance.now();engine=await WasmEngine.create();
   result={initializationMs:performance.now()-start,memoryBytes:engine.memoryBytes};
  }else if(op==='search')result=engine.search(p.board,p.player,{model,depth:timeMs?undefined:depth,timeMs:timeMs??0,hints:false});
  else if(op==='javascript')result=findBestMove(p.board,p.player,timeMs?14:depth,undefined,{evaluate:evaluators[model],...(timeMs?{timeMs}:{})});
  else if(op==='static')result=engine.evalbench(p.board,p.player,model,n);
  else if(op==='js-static'){
   const start=performance.now();let checksum=0;for(let i=0;i<n;i++)checksum+=evaluators[model](p.board,p.player);
   result={checksum,evaluations:n,elapsedMs:performance.now()-start};
  }else if(op==='boundary'){
   let checksum=0;const start=performance.now();for(let i=0;i<n;i++)checksum+=engine.inspect(p.board,p.player,model).evaluation;
   result={checksum,requests:n,elapsedMs:performance.now()-start};
  }else if(op==='profile'){
   const start=performance.now();let searches=0,nodes=0;while(performance.now()-start<2500){const r=engine.search(p.board,p.player,{model,depth,hints:false});searches++;nodes+=r.nodes;}
   result={searches,nodes,elapsedMs:performance.now()-start};
  }else throw Error('Unknown benchmark operation');
  self.postMessage({id,result});
 }catch(error){self.postMessage({id,error:String(error.stack??error)});}
 });};
