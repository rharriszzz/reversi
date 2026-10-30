#!/usr/bin/env node
// Example real complete game; alternatively import choose/playGame for research.
import { NativeEngine } from './client.mjs';
import { playGame } from './game.mjs';
import { randomOpening, seededRandom } from '../../src/learning.js';
const engine=new NativeEngine();
try {
 await engine.ready();const timeMs=Number(process.argv[2]??80),model=process.argv[3]??'P',seed=Number(process.argv[4]??2026103001);
 const opening=randomOpening(seededRandom(seed),8);
 const result=await playGame(engine,{id:`engineering-${seed}`,seed,board:[...opening.board],player:opening.player},{timeMs,model});
 console.log(JSON.stringify(result));
}finally{engine.close();}
