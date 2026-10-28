// Bounded worker-local cache of geometry only. Learned counts/weights are
// deliberately applied afresh; replay must never reuse stale shrink factors.
import { sparse } from './model.mjs';
export class EncodingCache {
 constructor(limit=16000){this.limit=limit;this.rows=new Map();this.hits=0;this.misses=0;}
 bind(model){const signature=JSON.stringify(model.spec);return board=>{
  const key=signature+':'+board.join(','),found=this.rows.get(key);if(found){this.hits++;return found;}
  this.misses++;const row=sparse(board,model,{raw:true});if(this.limit>0){if(this.rows.size>=this.limit)this.rows.delete(this.rows.keys().next().value);this.rows.set(key,row);}return row;
 };}
 snapshot(){return {entries:this.rows.size,limit:this.limit,hits:this.hits,misses:this.misses};}
}
