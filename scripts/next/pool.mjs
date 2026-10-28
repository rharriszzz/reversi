import { Worker } from 'node:worker_threads';
import { existsSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { atomic, read } from '../research/io.mjs';
export class Pool {
 constructor(count,output,progress=null){this.output=output;this.progress=progress;this.trackTasks=true;this.slots=Array.from({length:count},()=>({worker:new Worker(new URL('../strong/worker.mjs',import.meta.url),{resourceLimits:{maxOldGenerationSizeMb:320}}),busy:false}));}
 async run(id,job,{timeoutMs=120000,progressFields={}}={}) {
  const path=`${this.output}/tasks/${id}.json`,hash=createHash('sha256').update(JSON.stringify(job)).digest('hex');
  if(existsSync(path)){const receipt=read(path);if(receipt.hash!==hash)throw new Error('Task payload mismatch');return receipt.result;}
  const slot=this.slots.find(s=>!s.busy);if(!slot)throw new Error('Pool oversubscribed');slot.busy=true;
  this.progress?.set({task:id,substage:job.type,model:job.model??job.candidate??'-',epoch:'-',processedPositions:'-',eta:'unknown (no comparable completed operation)',batch:job.index??'-',note:job.type==='fit'?'fitting active; no new training positions expected until fitting finishes':job.type==='pair'?'two games, colors reversed; searches isolated':job.type==='generate'?'generating complete games':'computing references or development metrics',...progressFields});
  const start=performance.now();
  try {return await new Promise((resolve,reject)=>{
   const cleanup=()=>{clearTimeout(timer);slot.worker.off('message',onMessage);slot.worker.off('error',onError);slot.worker.off('exit',onExit);};
   const onError=e=>{cleanup();reject(e);},onExit=code=>onError(new Error(`worker exit ${code}`));
   const onMessage=message=>{if(message.id!==id)return;if(message.progress){const {positions,...fields}=message.progress;this.progress?.update({...fields,processedPositions:positions});return;}
    cleanup();if(!message.ok){reject(new Error(message.error));return;}
    const result={...message.result,profile:message.profile};atomic(path,{id,hash,result,wallMs:performance.now()-start});
    appendFileSync(`${this.output}/worker-profiles.jsonl`,JSON.stringify({id,type:job.type,wallMs:performance.now()-start,profile:message.profile})+'\n');
    if(this.trackTasks){this.completed=(this.completed??0)+1;this.progress?.update({completed:this.completed});}
    this.progress?.emit('completed',{task:id,taskWallMs:performance.now()-start});resolve(result);
   };
   const timer=setTimeout(()=>{slot.worker.terminate();onError(new Error(`task ${id} exceeded predeclared cap`));},timeoutMs);
   slot.worker.on('message',onMessage);slot.worker.on('error',onError);slot.worker.on('exit',onExit);slot.worker.postMessage({id,job});
  });}finally{slot.busy=false;}
 }
 async batch(jobs){const results=[];for(let i=0;i<jobs.length;i+=this.slots.length){const outcomes=await Promise.allSettled(jobs.slice(i,i+this.slots.length).map(j=>this.run(j.id,j.job)));for(const r of outcomes){if(r.status!=='fulfilled')throw r.reason;results.push(r.value);}}return results;}
 async close(){await Promise.allSettled(this.slots.map(s=>s.worker.terminate()));}
}
