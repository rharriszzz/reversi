// Historical deterministic default/custom selection paths only. No outcomes.
import assert from 'node:assert/strict';
import {seededRandom,proposeWeights,randomOpening} from '../../src/learning.js';
import {DEFAULT_WEIGHTS} from '../../src/features.js';
import {bestMove} from '../../src/search.js';
import {legalMoves,play,nextPlayer} from '../../src/rules.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {sha} from '../native/build.mjs';
const [output]=process.argv.slice(2);assert.ok(output);
const sources=['src/learning.js','src/search.js','src/rules.js','src/features.js','src/fast-features.js'];
for(const p of sources)assert.equal(sha(readFileSync(p)),sha(execFileSync('git',['show',`1f0faa3:${p}`])),`Historical deterministic source differs: ${p}`);
const seed=20261026+104729,rng=seededRandom(seed),candidate=proposeWeights(DEFAULT_WEIGHTS,rng),games=[];
for(let pair=0;pair<4;pair++){
  const opening=randomOpening(rng,6);
  for(const candidateColor of [1,-1]){
    let board=opening.board,player=opening.player;const moves=[];
    while(player!==null){
      const legal=legalMoves(board,player);
      if(!legal.length){player=legalMoves(board,-player).length?-player:null;continue;}
      const weights=player===candidateColor?candidate:DEFAULT_WEIGHTS;
      const choice=bestMove(board,player,2,weights);moves.push({player,move:choice.move});
      board=play(board,player,choice.move);player=nextPlayer(board,player);
    }
    games.push({opening:{board:[...opening.board],player:opening.player},moves,board:[...board],
      role:'unrelated custom-model selection assessment; deterministic historical reconstruction',pair,candidateColor});
  }
}
writeFileSync(output,JSON.stringify({seed,depth:2,openingPairs:4,candidate,
  method:'No outcomes, margins, points, acceptance or learning computed; path reconstruction only',
  sourceHashes:Object.fromEntries(sources.map(p=>[p,sha(readFileSync(p))])),
  sourceSha256:sha(readFileSync(new URL(import.meta.url))),games})+'\n',{flag:'wx'});
console.log(JSON.stringify({historicalPaths:games.length,outcomesComputed:false}));
