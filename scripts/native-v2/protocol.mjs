import {PROTOCOL as previous,slots as previousSlots,schedule as previousSchedule} from '../p-confirmation/protocol.mjs';
export {hash} from '../p-confirmation/protocol.mjs';
export const PROTOCOL={
 ...previous,version:2,namespace:'native-v2-p-v-b-20261030',depthLimit:null,
 engine:{backend:'native',threads:1,ttMiB:16,tt:true,hints:true,depth:0,
 isolation:'Separate persistent process per evaluator; restart both before each game, symmetric model-specific depth 3/5 warmup on the same disclosed roots. No shared TT or cross-game history.'},
 independence:'Prospective claim: new source families, no historical direct roots/children or declared ancestry from occupied 12 onward, under verified available indices. Root admission excludes complete generated nonterminal trajectories and root children, including previous confirmation and both native screens. Early common prefixes below occupied 12 are allowed. Later played transpositions, terminal convergence and unrelated internal-tree states do not redefine source membership. Audit all indexed played overlaps with historical roles; any actual direct-target reuse/unresolved role limits broader board-novelty claims. No retrospective removal, replacement, retuning or promotion. No claim that every internal search state is novel.',
 warmup:'Restart both processes before each game; B and P each search the same first four disclosed engineering roots at fixed depths 3 and 5 using its own evaluator. All warmups outside scored elapsed budgets; B/P execution order alternates with game parity.',
 statistics:{...previous.statistics,bootstrapReps:10000,bootstrapSeed:2026103017,
 sensitivity:'10,000 complete-family percentile resamples; additional seeds +1,+2 for 95% sensitivity; matched budget difference jointly resampled. Student positive-tail quadrature. No subgroup superiority claims.'},
 orderSeed:2026103016,bootstrapSeed:2026103017,
};
export const slots=()=>previousSlots().map(s=>({...s,role:'native-v2-games'}));
// Same balanced 16-cell construction, independently shuffled order.
export function schedule(){
 let families=slots(),state=PROTOCOL.orderSeed>>>0;
 const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/2**32;};
 for(let i=families.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[families[i],families[j]]=[families[j],families[i]];}
 return families.flatMap(s=>(s.dual?((s.cell+s.cycle)%2?[300,80]:[80,300]):[80]).flatMap(timeMs=>[s.firstColor,-s.firstColor].map(color=>({family:s.family,candidate:'P',timeMs,color}))));
}
