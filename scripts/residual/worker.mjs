import { parentPort } from 'node:worker_threads';
import { generate } from './data.mjs';
import { collectFrontier, fullWindow } from './frontier.mjs';
import { alternatives } from '../teacher/edax.mjs';
import { replay } from '../teacher/qualification.mjs';
import { solveBoth } from '../teacher/exact.mjs';
parentPort.on('message',async job=>{
  const start=performance.now(),cpu=process.threadCpuUsage?.();
  try {
    let result;
    if(job.type==='generate')result=generate(job.spec,job.attempt);
    else if(job.type==='frontier')result=collectFrontier(job.root,{weights:job.weights});
    else if(job.type==='root-search')result=fullWindow(job.state,job.depth,job.weights);
    else if(job.type==='label') {
      result=await alternatives(job.pin,job.state,job.depth,{timeoutMs:job.timeoutMs,measureNative:true,transcript:job.transcript});
      replay(job.state,result);
    } else if(job.type==='exact')result=solveBoth(job.state.board,job.state.player,{capMs:10000});
    else throw Error('Unknown residual worker job');
    parentPort.postMessage({ok:true,result,metrics:{wallMs:performance.now()-start,
      cpu:cpu?process.threadCpuUsage(cpu):null,rssBytes:process.memoryUsage().rss}});
  }catch(error){parentPort.postMessage({ok:false,error:error.stack,metrics:{wallMs:performance.now()-start}});}
});
