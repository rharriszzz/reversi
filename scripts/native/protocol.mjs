import { hash } from '../next-residual/protocol.mjs';
export {hash};
export const PROTOCOL=Object.freeze({
 version:2,namespace:'native-engineering-strength-clock-r2-20261030',model:'P',depthLimit:14,ttMiB:16,
 pairs80:256,pairs300:128,games:768,subset300:'families 0..127, predetermined before outcomes',
 openings:'uniform legal random prefix; target occupied 16+(family mod 4); at least two legal choices; entire ancestry from occupied 12 excluded against available hashed historical index and all previously admitted families',
 scope:'Engineering strength screen. No new training, no independent production-promotion claim. Historical index has previously disclosed role limitations; incidental late convergence remains possible.',
 order:'family ascending; budgets [80,300] for first 128 then [80]; native colors [1,-1] for even family, reversed for odd family',
 statistics:{unit:'complete two-color opening family',bootstrapReps:10000,seed:2026103013,interval:'two-sided paired Student 95%; bootstrap percentile sensitivity; two primary controls use one-sided alpha .025 each, descriptive matched 300-minus-80 contrast',optionalStopping:false,numericalTail:'same Student test; positive survival-density quadrature with u=1/x, 32768 Simpson intervals; independent analytic/Python checks'},
 capMs:4*3600000,contingency:1.35,reportingReserveMs:20*60000,auditAllowanceMs:10*60000,
 warmup:'each process: disclosed engineering roots, depths 3 and 5, P on both backends; before each pair reference P depth 3 and native P depth 3 on fixed engineering middle root',
 cancellation:'kill native process; discard unfinished request; retain durable per-move game checkpoint',
 timing:'same elapsed budget; fresh Date.now UTC deadline sent at client entry (at most 1 ms conservative timestamp quantization); native converts once to remaining steady-clock duration; output transport counted in observed overruns; native clock checked every 64 nodes',
 frozen:true,training:false,promotion:false,
});
export function schedule() {
 const rows=[];
 for(let family=0;family<256;family++)for(const timeMs of family<128?[80,300]:[80])for(const nativeColor of family%2?[-1,1]:[1,-1])rows.push({game:rows.length,family,timeMs,nativeColor});
 return rows;
}
