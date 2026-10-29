import {parentPort} from 'node:worker_threads';
import {generate} from '../residual/data.mjs';
import {collectFrontier,fullWindow} from '../next-residual/frontier.mjs';
import {compile} from '../next-residual/model.mjs';
import {findBestMove} from '../../src/search.js';
import {alternatives} from '../teacher/edax.mjs';
import {replay} from '../teacher/qualification.mjs';
import {solveBoth} from '../teacher/exact.mjs';
parentPort.on('message',async job=>{
 const start=performance.now(),cpu=process.threadCpuUsage();
 try{
  let result;const evaluate=()=>compile(job.model??'B').evaluate;
  if(job.type==='generate')result=generate(job.spec,job.attempt,job.protocol);
  else if(job.type==='frontier')result=collectFrontier(job.root,{evaluate:evaluate()});
  else if(job.type==='search'){
   const {observed,...full}=fullWindow(job.state,job.depth,undefined,()=>{},evaluate());
   const production=findBestMove(job.state.board,job.state.player,job.depth,undefined,{evaluate:evaluate()});
   if(Math.abs(full.score-production.score)>1e-8||!full.rows.some(r=>r.move===production.move&&Math.abs(r.score-full.score)<1e-8))throw Error('Full-window/production mismatch');
   result={full:{...full,observedCount:observed.length},production};
  }else if(job.type==='label'){
   result=await alternatives(job.pin,job.state,job.depth,{timeoutMs:180000,measureNative:true,transcript:job.transcript});replay(job.state,result);
  }else if(job.type==='exact')result=solveBoth(job.state.board,job.state.player,{capMs:180000});
  else throw Error('Unknown frozen-player task');
  parentPort.postMessage({ok:true,result,metrics:{wallMs:performance.now()-start,cpu:process.threadCpuUsage(cpu),rssBytes:process.memoryUsage().rss}});
 }catch(e){parentPort.postMessage({ok:false,error:e.stack});}
});
