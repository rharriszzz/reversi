#!/usr/bin/env node
import {read,atomic} from './common.mjs';
import {players,playGame} from './game.mjs';
const [job,prefix,result,mode]=process.argv.slice(2),input=read(job),engines=await players(input.receipt);
try{const game=await playGame(engines,input.opening,{color:1,timeMs:5,resume:mode==='resume'?read(prefix):null,checkpoint:p=>{atomic(prefix,p);if(mode==='interrupt')throw Error('QUALIFICATION_CHECKPOINT');}});atomic(result,game);}catch(e){if(e.message==='QUALIFICATION_CHECKPOINT')process.exitCode=73;else throw e;}finally{Object.values(engines).forEach(e=>e.close());}
