import {hash} from '../frozen-player/protocol.mjs';
import {seededRandom} from '../../src/learning.js';
export {hash};
function freeze(x){for(const v of Object.values(x))if(v&&typeof v==='object')freeze(v);return Object.freeze(x);}
export const PROTOCOL=freeze({
 version:1,namespace:'p-independent-confirmation-v1-20261029',
 models:{B:'original-production',P:'de4b84745589b0384ea3639f879e3c98990e802d176298ff8ef54f681520067f'},
 families:768,dualFamilies:256,games:2048,timeMs:[80,300],depthLimit:14,
 cells:'policy bit 0; occupied parity bit 1; simultaneous color/turn reversal bit 2; first P color bit 3; 48 cycles',
 subset:'cycle modulo 3 equals 0: 16 families in every cell, fixed before admission',
 orderSeed:2026102901,bootstrapSeed:2026102902,bootstrapReps:10000,
 sampling:'Original complete B1/12% and B4/2% trajectories; occupied 12/13; both-turn D4/color canonical exclusions from occupied 12 onward, root and every legal child; ascending attempts; no outcome replacement',
 independence:'Reuse verified historical index plus all previous-screen reservations, attempts, frontiers, teacher roots/children/PVs, timed roots, played paths, and new disclosed qualification games. No shared admitted ancestry from occupied 12. Incidental played/internal or terminal convergence is reported; direct target/assessment reuse or unresolved provenance blocks claims.',
 warmup:'Same 16 disclosed prior roots, B then P, ordinary depth 3, before each color pair; no per-leaf clocks',
 statistics:{unit:'complete color-swapped opening-family pair',primary:80,durability:300,alphaEach:.025,
 test:'One-sample Student t on family scores against .5; approximate one-sided 97.5% lower bound. Bonferroni across two budgets controls familywise .05; primary failure cannot be rescued.',
 bootstrap:'Percentile two-sided 95% whole-family sensitivity intervals; joint matched-family resamples for 300-minus-80; same draw retains both budgets; no pooling budgets as independent',
 bounded:'mean - sqrt(log(1/.025)/(2*n)); independent bounded family scores [0,1], stable timing regime; simultaneous Bonferroni .05',
 decision:'Both t lower bounds >.5, both bootstrap lower endpoints >.5, and integrity required for credible conventional two-budget evidence; report separately whether both Hoeffding bounds >.5. Disagreement explicit. No automatic promotion.',
 subgroups:'Policy/parity/turn scores and phase telemetry descriptive only; no additional superiority tests; moves are not strength samples'},
 resources:{capMs:8*3600000,contingency:1.35,reportReserveMs:20*60000,diskGiB:75,reserveGiB:1.5},
 stopping:'Fixed samples, no interim significance testing. Stop only for correctness, provenance, resource or execution integrity; retain completed receipts and prefixes; no replacement, extension, retraining, optimization or promotion.',
});
export function slots(){return Array.from({length:768},(_,family)=>{
 const cell=family%16,cycle=Math.floor(family/16),parity=(cell>>1)&1;
 return {family,cell,cycle,role:'confirmation-games',slot:family,phase:0,depth:4,
 policy:cell&1?'B4-2%':'B1-12%',occupied:12+parity,parity,player:parity?-1:1,
 reverse:Boolean(cell&4),firstColor:cell&8?-1:1,dual:cycle%3===0};
});}
export function schedule(){const families=slots(),random=seededRandom(PROTOCOL.orderSeed);
 for(let i=families.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[families[i],families[j]]=[families[j],families[i]];}
 return families.flatMap(s=>(s.dual?((s.cell+s.cycle)%2?[300,80]:[80,300]):[80]).flatMap(timeMs=>
  [s.firstColor,-s.firstColor].map(color=>({family:s.family,candidate:'P',timeMs,color}))));
}
