// Deterministic historical engineering recipes; no engine search or outcomes.
import {readFileSync,writeFileSync} from 'node:fs';
import {seededRandom,randomOpening} from '../../src/learning.js';
import {initialBoard,legalMoves,play} from '../../src/rules.js';
import {sha} from '../native/build.mjs';
const [output]=process.argv.slice(2);if(!output)throw Error('Fresh output required');
const rows=[];
function add(board,player,source,location){
 rows.push({board:[...board],player,role:'reconstructed historical engineering fixture; no fitting inferred',source,location});
 for(const p of [1,-1])for(const move of legalMoves(board,p))rows.push({board:[...play(board,p,move)],player:-p,role:'derived engineering alternative; no fitting inferred',source,location:`${location}/child-${p}-${move}`});
}
for(const [seed,lateSeed,n] of [[0x464c5154,0x464c5200,24],[0x464c5751,0x464c5752,12]]){
 const rng=seededRandom(seed);
 for(let q=0;q<64;q++)for(const empty of [1,2,3]){
  const b=Array.from({length:64},()=>rng()<.5?1:-1);b[q]=0;
  for(let i=1;i<empty;i++){let k;do{k=Math.floor(rng()*64);}while(!b[k]);b[k]=0;}
  for(const p of [1,-1])add(b,p,`seed-${seed}`,`${q}/${empty}`);
 }
 for(let i=0;i<n;i++){const p=randomOpening(seededRandom(lateSeed+i),54+i%6);add(p.board,p.player??1,`seed-${lateSeed+i}`,'late-root');}
}
for(let game=0;game<32;game++){
 const rng=seededRandom(0x4e510000+game);let b=[...initialBoard()],p=1,passes=0,ply=0;
 while(passes<2){
  add(b,p,`native-qualification-seed-${0x4e510000+game}`,`step-${ply++}`);
  const legal=legalMoves(b,p);if(!legal.length){passes++;p=-p;continue;}passes=0;
  b=[...play(b,p,legal[Math.floor(rng()*legal.length)])];p=-p;
 }
}
const sources=['scripts/fast-flips/qualify.mjs','scripts/runtime-cpu/qualify.mjs','scripts/runtime-cpu-followup/qualify.mjs','scripts/fast-flips/production-wasm-qualify.mjs','scripts/native/qualify.mjs','src/learning.js','src/rules.js'];
const result={role:'disclosed-engineering-reconstruction',method:'Same deterministic seeded recipes; no engine searches, games or new scientific seed namespace',sourceHashes:Object.fromEntries(sources.map(p=>[p,sha(readFileSync(p))])),positions:rows};
writeFileSync(output,JSON.stringify(result)+'\n',{flag:'wx'});
console.log(JSON.stringify({historicalEngineeringRows:rows.length,searches:0}));
