// Fresh OLD-development query replay; never a fresh scientific label.
import { existsSync } from 'node:fs';
import { Pool } from './pool.mjs';
import { parallel } from '../teacher/qualification-core.mjs';
import { read,atomic } from '../research/io.mjs';
import { hash } from './protocol.mjs';
export async function qualifyTwo(output,runIdentity,{check,event,telemetry}) {
  const path=`${output}/scaling.json`;
  if(existsSync(path)){const r=read(path);if(r.runIdentity!==runIdentity)throw Error('Scaling identity mismatch');return r;}
  const original=read(`${output}/tasks/engineering-label-training-0-0-12.json`),trials=[];
  for(const n of [1,2])for(let repetition=0;repetition<2;repetition++){
    check();const pool=new Pool(n,output,runIdentity,{check,event,telemetry}),start=performance.now();
    try{await parallel([0,1,2,3],n,async i=>{
      const job={...original.job,transcript:`${output}/raw/scaling-${n}-${repetition}-${i}.json`};
      const result=await pool.task(`engineering-scaling-${n}-${repetition}-${i}`,job);
      if(hash(result.rows)!==hash(original.result.rows))throw Error('Scaling replay changed a qualified development query');
    });}finally{await pool.close();}
    trials.push({workers:n,repetition,ms:performance.now()-start});
  }
  const one=trials.filter(t=>t.workers===1).map(t=>t.ms),two=trials.filter(t=>t.workers===2).map(t=>t.ms);
  const safeSpeedup=Math.max(1,Math.min(...one)/Math.max(...two)),result={runIdentity,trials,safeSpeedup,useful:safeSpeedup>=1.1};
  atomic(path,result);event('fresh-scaling-qualified',result);return result;
}
