// Draft only. No opening generation, result collection, or launch entry point.
import {seededRandom} from '../../src/learning.js';
export const DRAFT = Object.freeze({
  status:'draft-not-registered', namespace:'phase-a-m4-p-v-b-prospective-v1-20261031',
  families:256, games:512, timeMs:80, orderSeed:2026103191, bootstrapSeed:2026103192,
  models:Object.freeze({B:'original-production',P:'de4b84745589b0384ea3639f879e3c98990e802d176298ff8ef54f681520067f'}),
  engine:Object.freeze({platform:'darwin-arm64',cpu:'portable',ttMiB:16,tt:true,hints:true,depth:0,threads:1}),
  alpha:.05, bootstrapReps:10000, capMinutes:120, contingency:1.35, reportReserveMinutes:15,
  historicalInventory:null, executableSha256:null, literalOpenings:null,
  independence:'Strict historical direct-target and assessment prohibition, including unrelated models; unknown roles stay restricted. Complete generated ancestry from occupied 12, roots and legal root children historical/mutually disjoint. No post-outcome replacement or clean-subset rescue. Audit every played path before aggregate scores; any prohibited/unresolved encounter blocks the whole confirmation.',
  statistics:'Mean of 256 complete color-swapped family points; require both Hoeffding and approximate one-sided Student 95% lower bounds > .5; 10,000 whole-family resamples within 16 strata as sensitivity. No interim tests, extension or pooling.',
  warmup:'Separate persistent B/P processes, restarted before each game; same first 16 disclosed native-engineering roots D3 for both models, execution order alternates by game. Warmup excluded from move clocks but included in full runtime.',
});
export function slots(){return Array.from({length:256},(_,family)=>{
  const cell=family%16,cycle=Math.floor(family/16),parity=(cell>>1)&1;
  return {family,cell,cycle,role:'phase-a-prospective-games',slot:family,phase:0,depth:4,
    policy:cell&1?'B4-2%':'B1-12%',occupied:12+parity,parity,player:parity?-1:1,
    reverse:Boolean(cell&4),firstColor:cell&8?-1:1};
});}
export function schedule(){
  const families=slots(),rng=seededRandom(DRAFT.orderSeed);
  for(let i=families.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[families[i],families[j]]=[families[j],families[i]];}
  return families.flatMap(s=>[s.firstColor,-s.firstColor].map(color=>({family:s.family,candidate:'P',timeMs:80,color})));
}
export function requireRegistration(value){
  if(value.status!=='registered'||!value.historicalInventory||!value.executableSha256||!Array.isArray(value.literalOpenings)||value.literalOpenings.length!==256)
    throw Error('Draft protocol cannot authorize scored games; verified coverage, executable and literal openings required');
}
