#!/usr/bin/env node
// A representative exact-12 endgame amortizes protocol work, unlike a six-empty
// microquery. Keep the earlier full profile files as separate engineering data.
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {build} from '../native/build.mjs';
import {NativeEngine} from '../native/client.mjs';
import {positions} from './positions.mjs';
import {output,read,atomic,measure} from './common.mjs';
const receipts={baseline:read(resolve(output,'profile-baseline-sample/build.json')),final:build({directory:resolve(output,'profile-v2-final'),profile:true})};
await measure('representative-profiles',async()=>{
 const rows=[];
 for(const [tag,receipt] of Object.entries(receipts))for(const [phase,index,depth] of [['opening',2,8],['middle',7,7],['endgame',10,12]]){
  const e=new NativeEngine({receipt}),p=positions()[index];try{
   await e.ready();await e.search(p.board,p.player,{model:'P',depth:3});const file=resolve(output,`profile-v2-${tag}-${phase}.txt`);
   const child=spawn('/usr/bin/sample',[String(e.child.pid),'4','1','-file',file],{stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',b=>error+=b);const sampled=new Promise(ok=>{child.on('error',e=>ok({error:String(e)}));child.on('exit',code=>ok({code,error}));});
   const t=performance.now();let nodes=0,evaluations=0,cpuMs=0,searchMs=0,searches=0;
   while(performance.now()-t<5000){const r=await e.search(p.board,p.player,{model:'P',depth});nodes+=r.nodes;evaluations+=r.evaluations;cpuMs+=r.cpuMs;searchMs+=r.elapsedMs;searches++;}
   rows.push({tag,phase,position:p,depth,nodes,evaluations,cpuMs,searchMs,searches,sampling:await sampled});console.log(JSON.stringify({tag,phase,searches}));
  }finally{e.close();}
 }
 atomic(resolve(output,'representative-profiles.json'),{receipts,rows});
});
