// Separate-process engineering probe. Exit immediately after a durable move.
import { atomic,read } from '../research/io.mjs';
import { frozenModels } from './models.mjs';
import { playGame } from './game.mjs';
const [input,checkpointPath,resultPath,mode]=process.argv.slice(2),job=read(input),models=frozenModels();
const result=await playGame(job.opening,models[job.candidate],job.color,job.timeMs,{
  resume:mode==='resume'?read(checkpointPath):null,
  checkpoint:s=>{atomic(checkpointPath,s);if(mode==='interrupt')process.exit(73);},
});
atomic(resultPath,result);
