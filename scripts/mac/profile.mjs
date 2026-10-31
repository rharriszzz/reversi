// macOS sample + separate exclusive span diagnostics, no production timing.
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {build,sha} from '../native/build.mjs';
const out=resolve('.local-research/mac-modernization-20261030'),fixtures=JSON.parse(readFileSync(resolve(out,'fixtures.json'))),rows=[],spans=[];
function work(command,args,onReady) {
 return new Promise((ok,no)=>{
  const child=spawn(command,args,{stdio:['ignore','pipe','pipe']});let text='',stderr='',ready=false,side;
  child.stdout.on('data',b=>{text+=b;if(!ready&&text.includes('READY\n')){ready=true;side=onReady?.(child.pid);}});child.stderr.on('data',b=>stderr+=b);
  child.on('error',no);child.on('exit',async status=>{if(status)no(Error(stderr));else try{await side;ok({result:JSON.parse(text.trim().split('\n').at(-1)),stderr});}catch(e){no(e);}});
 });
}
const current=build();
for(const tag of ['baseline','candidate']) {
 const dir=tag==='baseline'?resolve(out,'variant-baseline'):resolve(current.executable,'..');
 const source=tag==='baseline'?resolve(dir,'engine.cpp'):resolve('native/engine.cpp');
 const flags=[...current.flags,'-g','-fno-omit-frame-pointer'];
 for(const instrument of [false,true]) {
  const executable=resolve(out,`profile-${tag}${instrument?'-instrument':''}`);
  execFileSync('c++',[...flags,...(instrument?['-DNATIVE_PROFILE']:[]),'-I',dir,'-I','native',source,'scripts/mac/profile-driver.cpp','-o',executable]);
  const identity={sourceSha256:sha(readFileSync(source)),headerSha256:sha(readFileSync(tag==='baseline'?resolve(dir,'engine.hpp'):'native/engine.hpp')),driverSha256:sha(readFileSync('scripts/mac/profile-driver.cpp')),executableSha256:sha(readFileSync(executable)),flags:[...flags,...(instrument?['-DNATIVE_PROFILE']:[])]};
  for(const [phase,index,depth,mode] of [['opening',1,8,'play'],['middle',3,7,'play'],['endgame',4,12,'play'],['coaching',3,5,'coach']]) {
   const p=fixtures.positions[index],bits=v=>p.board.reduce((a,b,q)=>a|(b===v?1n<<BigInt(q):0n),0n).toString(16);
   const args=[mode,bits(1),bits(-1),String(p.player),String(depth),instrument?'0.3':'4','2'];
   let file=resolve(out,`sample-${tag}-${phase}.txt`);
   const r=await work(executable,args,instrument?null:pid=>new Promise((ok,no)=>{
    const sample=spawn('/usr/bin/sample',[String(pid),'3','1','-file',file],{stdio:['ignore','pipe','pipe']});let log='';sample.stderr.on('data',b=>log+=b);sample.on('error',no);sample.on('exit',code=>code?no(Error(log)):ok());
   }));
   if(instrument)spans.push({tag,phase,position:p,depth,mode,identity,...r});
   else {
    const raw=readFileSync(file,'utf8'),text=raw.split('Sort by top of stack, same collapsed (when >= 5):')[1]?.split('Binary Images:')[0];if(!text)throw Error('No collapsed sample table');
    const selfSamples=[...text.matchAll(/^\s+(.+?)\s+(\d+)\s*$/gm)].map(m=>({symbol:m[1],samples:Number(m[2])}));
    if(!selfSamples.length)throw Error('No self samples');
    rows.push({tag,phase,position:p,depth,mode,identity,selfSamples,totalReportedSelfSamples:selfSamples.reduce((a,r)=>a+r.samples,0),physicalFootprint:raw.match(/Physical footprint:\s+([^\n]+)/)?.[1],...r});
   }
   console.log(JSON.stringify({tag,phase,instrument,complete:true}));
  }
 }
}
writeFileSync(resolve(out,'native-profiles.json'),JSON.stringify({rows,spans,spanNames:['legal','flips','features','patterns','TT','ordering'],scope:'sample collapsed self samples >=5, includes blocked samples; recursive/inlined TT and ordering may be combined. Separate spans perturb timing.'})+'\n');
