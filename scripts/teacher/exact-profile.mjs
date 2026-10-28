#!/usr/bin/env node
// Instrumented engineering profile. Timed benchmarks use the uninstrumented oracle.
import {readFileSync,mkdirSync} from 'node:fs';
import {solveReference} from './reference-exact.mjs';
import {atomic} from '../research/io.mjs';
const output=process.argv[2],input=process.argv[3];mkdirSync(output,{recursive:true});
const positions=JSON.parse(readFileSync(input,'utf8'));
const steps=[-11,-10,-9,-1,1,9,10,11];
const results=[];
for(const state of positions){
 const seen=new Set(),stats={calls:0,cutoffs:0,alternatives:[],scanMs:0,applyCopyMs:0,logicalArrays:0,repeatedPositions:0,uniqueTrackingLimit:200000,trackingSaturated:false};
 const children=(board,player)=>{
  const start=performance.now();stats.calls++;const key=board.join(',')+'/'+player;
  if(seen.has(key))stats.repeatedPositions++;else if(seen.size<stats.uniqueTrackingLimit)seen.add(key);else stats.trackingSaturated=true;
  const mailbox=Array(100).fill(2);for(let i=0;i<64;i++)mailbox[11+(i>>3)*10+(i&7)]=board[i];
  const result=[];stats.logicalArrays+=2;let applyMs=0;
  for(let move=0;move<64;move++){
   const at=11+(move>>3)*10+(move&7);if(mailbox[at]!==0)continue;
   const flips=[];stats.logicalArrays++;
   for(const step of steps){let cursor=at+step;while(mailbox[cursor]===-player)cursor+=step;if(mailbox[cursor]!==player)continue;for(let pos=at+step;pos!==cursor;pos+=step)flips.push(pos);}
   if(!flips.length)continue;
   const t=performance.now(),next=[...mailbox];next[at]=player;for(const f of flips)next[f]=player;
   result.push({move,board:Array.from({length:64},(_,i)=>next[11+(i>>3)*10+(i&7)])});stats.logicalArrays+=2;applyMs+=performance.now()-t;
  }
  stats.applyCopyMs+=applyMs;stats.scanMs+=performance.now()-start-applyMs;return result;
 };
 for(const awarded of [false,true]){const start=performance.now(),cpu=process.cpuUsage();let result,error;try{result=solveReference(state.board,state.player,awarded,start+2000,{children,trace:stats});}catch(e){error=e.message;}const c=process.cpuUsage(cpu);results.push({id:state.id,awarded,result,error,wallMs:performance.now()-start,cpuMs:(c.user+c.system)/1000,stats:{...stats,alternatives:[...stats.alternatives],unique:seen.size},memory:process.memoryUsage()});}
}
atomic(`${output}/profile.json`,results);console.log(JSON.stringify(results.map(x=>({id:x.id,awarded:x.awarded,error:x.error,nodes:x.result?.nodes,wallMs:x.wallMs,stats:x.stats}))));
