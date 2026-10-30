// Software CPU-clock sampling in WSL2 plus separately perturbed span accounting.
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {build} from '../native/build.mjs';
import {NativeEngine} from '../native/client.mjs';
const out=resolve('.local-research/windows-pc-20261030');
const fixtures=JSON.parse(readFileSync(`${out}/fixtures.json`));
const perf=process.env.PERF??`${out}/perf-tools/usr/lib/linux-tools-5.15.0-202/perf`;
const rows=[];
for(const cpu of ['portable','native'])for(const [phase,index,depth] of [['opening',1,8],['middle',3,7],['endgame',4,12]]) {
 const receipt=build({cpu,profile:true,directory:resolve(out,`profile-${cpu}`)}),e=new NativeEngine({receipt}),p=fixtures.positions[index];
 try {
  await e.ready();await e.search(p.board,p.player,{model:'P',depth:3});
  const file=`${out}/native-${cpu}-${phase}.perf.data`;
  const sampler=spawn(perf,['record','-o',file,'-e','cpu-clock:u','-F','999','-g','--call-graph','fp','-p',String(e.child.pid),'--','sleep','4'],{stdio:['ignore','ignore','pipe']});let stderr='';sampler.stderr.on('data',b=>stderr+=b);
  const completed=new Promise(ok=>{sampler.on('error',error=>ok({error:String(error)}));sampler.on('exit',code=>ok({code,stderr}));});
  const start=performance.now();let searches=0,nodes=0,evaluations=0,cpuMs=0,coreMs=0;
  while(performance.now()-start<4500){const r=await e.search(p.board,p.player,{model:'P',depth,hints:false});searches++;nodes+=r.nodes;evaluations+=r.evaluations;cpuMs+=r.cpuMs;coreMs+=r.elapsedMs;}
  const status=await completed;
  const report=spawnSync(perf,['report','-i',file,'--stdio','--no-children','--show-nr-samples','--percent-limit','0','--sort','symbol','-t',';'],{encoding:'utf8'});
  writeFileSync(`${out}/native-${cpu}-${phase}.perf.txt`,report.stdout+report.stderr);
  rows.push({cpu,phase,position:p,depth,receipt,searches,nodes,evaluations,cpuMs,coreMs,wallMs:performance.now()-start,status,reportStatus:report.status,report:report.stdout});
  console.log(JSON.stringify({cpu,phase,searches,status}));
 }finally{e.close();}
}
const spans=[];
for(const cpu of ['portable','native']){
 const receipt=build({cpu,instrument:true,directory:resolve(out,`instrument-${cpu}`)}),e=new NativeEngine({receipt});
 try {
  await e.ready();
  for(const [phase,index,depth] of [['opening',1,8],['middle',3,7],['endgame',4,12]]) {
   const p=fixtures.positions[index],before=await e.request('profile');const results=[];
   for(let i=0;i<5;i++)results.push(await e.search(p.board,p.player,{model:'P',depth,hints:false}));
   const after=await e.request('profile');
   spans.push({cpu,phase,depth,receipt,results,names:['legal','flips','features','patterns','TT','ordering'],exclusiveNs:after.ns.map((v,i)=>v-before.ns[i]),calls:after.calls.map((v,i)=>v-before.calls[i])});
  }
 }finally{e.close();}
}
writeFileSync(`${out}/native-profiles.json`,JSON.stringify({perf,rows,spans})+'\n');
