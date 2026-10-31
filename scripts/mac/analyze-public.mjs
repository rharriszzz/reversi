// Recompute registered family statistics from committed packed game evidence.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {pairSummary} from '../frozen-player/statistics.mjs';
import {bootstrap,mean} from '../p-confirmation/statistics.mjs';
const read=name=>JSON.parse(readFileSync(`docs/data/${name}`));
const verification=read('mac-public-verification-20261030.json');assert.equal(verification.passed,true);
const data=read('mac-backend-games-20261030.json'),registration=read('mac-backend-registration-20261030.json');
for(const budgetMs of [80,300]) {
 const games=data.games.filter(g=>g.budgetMs===budgetMs);assert.equal(games.length,128);
 const points=g=>{const margin=g.board.reduce((a,v)=>a+v,0)*g.nativeColor;return margin>0?1:margin<0?0:.5;};
 const pairs=Array.from({length:64},(_,family)=>{
  const gs=games.filter(g=>g.family===family);assert.deepEqual(gs.map(g=>g.nativeColor).sort(),[-1,1]);
  return {family,score:mean(gs.map(points)),margin:mean(gs.map(g=>g.board.reduce((a,v)=>a+v,0)*g.nativeColor))};
 });
 const summary=pairSummary(pairs.map(p=>p.score)),resampled=bootstrap(pairs,['score','margin'],{reps:registration.bootstrapReplicates,seed:registration.bootstrapSeed+budgetMs});
 const expected=data.analysis.conditions.find(c=>c.budgetMs===budgetMs);
 for(const k of ['mean','sd','standardError','approximate95'])assert.deepEqual(summary[k],expected[k]);
 assert.deepEqual(resampled,expected.bootstrap);
 assert.equal(games.filter(g=>points(g)===1).length,expected.wins);assert.equal(games.filter(g=>points(g)===.5).length,expected.draws);assert.equal(games.filter(g=>points(g)===0).length,expected.losses);
}
const result={passed:true,games:256,familiesPerBudget:64,bootstrapReplicates:registration.bootstrapReplicates,scope:'Public boards/colors reproduce all W/D/L, paired means, Student intervals and registered seeded bootstrap intervals exactly.'};
writeFileSync('docs/data/mac-statistical-verification-20261030.json',JSON.stringify(result)+'\n');console.log(JSON.stringify(result));
