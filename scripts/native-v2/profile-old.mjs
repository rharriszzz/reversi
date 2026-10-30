#!/usr/bin/env node
import {resolve} from 'node:path';
import {copyFileSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {NativeEngine} from '../native/client.mjs';
import {sha} from '../native/build.mjs';
import {positions} from './positions.mjs';
import {output,read,atomic,measure} from './common.mjs';
const dir=resolve(output,'profile-baseline-instrument');mkdirSync(dir,{recursive:true});
for(const f of ['engine.cpp','engine.hpp','main.cpp'])writeFileSync(resolve(dir,f),execFileSync('git',['show',`b05e903:native/${f}`]));
copyFileSync(resolve(output,'build-final/frozen.hpp'),resolve(dir,'frozen.hpp'));
const baseline=read(resolve(output,'baseline/build/build.json')),executable=resolve(dir,'reversi-native'),flags=[...baseline.flags,'-g','-fno-omit-frame-pointer','-DNATIVE_PROFILE'];
execFileSync(process.env.CXX??'c++',[...flags,'-I',dir,resolve(dir,'engine.cpp'),resolve(dir,'main.cpp'),'-o',executable]);
const receipt={...baseline,flags,executable,executableSha256:sha(readFileSync(executable))};
await measure('baseline-exclusive-instrumentation',async()=>{
 const rows=[];
 for(const [phase,index,depth] of [['opening',2,8],['middle',7,7],['endgame',13,10]]){
  const e=new NativeEngine({receipt}),p=positions()[index];try{
   await e.ready();let nodes=0,cpuMs=0,searchMs=0,searches=0;const t=performance.now();
   while(performance.now()-t<3000){const r=await e.search(p.board,p.player,{model:'P',depth,timeMs:1000});nodes+=r.nodes;cpuMs+=r.cpuMs;searchMs+=r.elapsedMs;searches++;}
   rows.push({phase,position:p,depth,nodes,cpuMs,searchMs,searches,counters:await e.request('profile')});
  }finally{e.close();}
 }
 atomic(resolve(output,'profile-baseline-instrument.json'),{receipt,rows,instrument:true,parts:['legal','flips','features','patterns','TT','ordering']});
});
