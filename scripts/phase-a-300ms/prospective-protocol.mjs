// New prospective experiment. The completed 80-ms protocol remains unchanged.
import {seededRandom} from '../../src/learning.js';
export {slots,requireRegistration} from '../phase-a-mac/prospective-protocol.mjs';
export const TOURNAMENT=Object.freeze({
 status:'prospective-not-registered',namespace:'phase-a-m4-p-v-b-300ms-v1-20261031',
 authorization:'Reversi — 300-ms P-versus-B Tournament on the M4',
 families:256,games:512,timeMs:300,orderSeed:2026110101,bootstrapSeed:2026110102,
 models:{B:'original-production',P:'de4b84745589b0384ea3639f879e3c98990e802d176298ff8ef54f681520067f'},
 engine:{platform:'darwin-arm64',cpu:'portable',ttMiB:16,tt:true,hints:true,depth:0,threads:1},
 alpha:.05,bootstrapReps:10000,capMinutes:240,contingency:1.35,reportReserveMinutes:15,
 independence:'Frozen programs on independently generated opening families. Exclude all known historical training, development, selection, assessment and reserved openings, D4/color/turn equivalents, complete source ancestry from occupied 12 and root children; also exclude the entire previous M4 tournament and disclosed development positions. Generation and admission use no P/B match outcomes. No interim aggregate analysis, replacements, extension or clean-subset rescue. Subsequent played-position historical novelty is NOT required. Audit historical encounters before aggregate analysis and disclose verified P/L fitting/selection panel encounters separately from unrelated research and unresolved roles. Unidentified roles are limitations, not proof of leakage. This policy applies prospectively only and does not repair any previous failed gate.',
 outcome:'Raw final occupied-disc difference; win/draw/loss 1/.5/0 from P perspective. Legal forced passes; termination at two consecutive passes, including terminal positions with empties. No awarded-empty conversion.',
 statistics:'Primary observation: complete two-color family mean; mean of 256 families. Both one-sided 95% Student and Hoeffding lower bounds must exceed .5. Hoeffding threshold strictly above .5764920885. No pooling experiments or causal time-control interaction claim.',
 student:'t(.95,255) for one-sided 95% lower; also descriptive t(.975,255) two-sided interval. Zero variance is not proof of a constant population.',
 bootstrap:'10,000 stratified whole-family draws, ascending cell and family, 16 draws per cell with replacement; score and margin jointly; seededRandom(2026110102); linear interpolated 2.5/97.5 percentiles. Sensitivity only.',
 warmup:'Fresh separate B/P processes per game; separate 16-MiB-capacity tables. Identical first 16 disclosed native-engineering roots at D3; alternate B/P warmup order. Warmup outside move clocks, inside wall ledger. Single serial search stream.',
 checkpoint:'Durable move prefixes; immutable games and hash-chained complete-pair receipts. Resume verifies complete pairs only; interrupted partial pair retained and blocks replacement/confirmation.',
 diagnostics:'Descriptive stratum and family distributions; search depth/nodes/evaluations/timing by phase; disclosed engineering-root comparisons for matched evaluation costs; illustrative B-success continuations. No additional confirmation tests.',
});
export function schedule(){
 const families=Array.from({length:256},(_,i)=>i),random=seededRandom(TOURNAMENT.orderSeed);
 for(let i=255;i>0;i--){const j=Math.floor(random()*(i+1));[families[i],families[j]]=[families[j],families[i]];}
 return families.flatMap(f=>[f&8?-1:1,f&8?1:-1].map(color=>({family:f,candidate:'P',timeMs:300,color})));
}
