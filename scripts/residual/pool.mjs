import { Worker } from 'node:worker_threads';
import { existsSync, appendFileSync } from 'node:fs';
import { atomic, read } from '../research/io.mjs';
import { hash, PROTOCOL } from './protocol.mjs';
export class Pool {
  constructor(count,output,runIdentity,{check=()=>{},event=()=>{},telemetry=()=>{}}={}) {
    this.output=output;this.runIdentity=runIdentity;this.check=check;this.event=event;this.telemetry=telemetry;
    this.active=new Map();this.waiters=[];this.slots=Array.from({length:count},()=>({busy:false,worker:null}));
  }
  async task(id,job,{reuse=true}={}) {
    const path=`${this.output}/tasks/${id}.json`,inputHash=hash({job,runIdentity:this.runIdentity});
    if(reuse&&existsSync(path)) {
      const saved=read(path);
      if(saved.inputHash!==inputHash||saved.resultHash!==hash(saved.result)) throw Error(`Task receipt mismatch: ${id}`);
      return saved.result;
    }
    this.check();let slot=this.slots.find(s=>!s.busy);
    if(!slot){await new Promise(ok=>this.waiters.push(ok));return this.task(id,job,{reuse});}
    slot.busy=true;
    if(!slot.worker)slot.worker=new Worker(new URL('./worker.mjs',import.meta.url),{
      // Coordinator-only --expose-gc / --input-type / -e flags are not worker flags.
      execArgv:[],
      resourceLimits:{maxOldGenerationSizeMb:256}});
    this.active.set(id,{id,type:job.type,depth:job.depth??job.root?.depth,start:performance.now()});
    const started=performance.now();this.event('task-start',{id,type:job.type,depth:job.depth??job.root?.depth});
    try {
      const message=await new Promise((ok,bad)=>{
        const worker=slot.worker;
        const done=()=>{clearTimeout(timer);worker.removeListener('message',receive);worker.removeListener('error',error);worker.removeListener('exit',exit);};
        const receive=r=>{done();r.ok?ok(r):bad(Error(r.error));};
        const error=e=>{done();slot.worker=null;bad(e);};
        const exit=code=>{done();slot.worker=null;bad(Error(`Worker exited ${code}`));};
        const timer=setTimeout(()=>{done();worker.terminate();slot.worker=null;bad(Error(`Task cap ${id}`));},PROTOCOL.workerTaskCapMs+5000);
        worker.once('message',receive);worker.once('error',error);worker.once('exit',exit);worker.postMessage(job);
      });
      const receipt={inputHash,runIdentity:this.runIdentity,job,result:message.result,resultHash:hash(message.result),metrics:message.metrics,
        committed:new Date().toISOString(),wallMs:performance.now()-started};
      atomic(path,receipt);this.telemetry({id,...receipt.metrics,wallMs:receipt.wallMs,type:job.type,depth:job.depth??job.root?.depth});
      this.event('task-complete',{id,type:job.type,seconds:receipt.wallMs/1000});return message.result;
    } catch(error) {
      atomic(`${this.output}/failures/${id}.json`,{inputHash,job,error:error.stack,at:new Date().toISOString()});throw error;
    } finally {this.active.delete(id);slot.busy=false;this.waiters.shift()?.();}
  }
  async close(){await Promise.all(this.slots.map(s=>s.worker?.terminate()));}
}
