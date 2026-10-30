import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {NativeEngine} from '../native/client.mjs';
import {positions} from '../native-v2/positions.mjs';
const dir='.local-research/wasm-20261030',data=JSON.parse(readFileSync(`${dir}/native-experiment.json`)),rows=[];
for(const tag of ['baseline','both'])for(const [phase,index,depth] of [['opening',2,8],['middle',7,7],['endgame',10,12]]) {
 const e=new NativeEngine({receipt:data.receipts[tag]}),p=positions()[index];
 try {
  await e.ready();const file=`${dir}/native-${tag}-${phase}.sample.txt`;
  const child=spawn('/usr/bin/sample',[String(e.child.pid),'3','1','-file',file],{stdio:'ignore'});
  const sampled=new Promise(resolve=>child.on('exit',resolve));
  const t=performance.now();let searches=0,nodes=0,elapsedMs=0;
  while(performance.now()-t<3500){const r=await e.search(p.board,p.player,{model:'P',depth,hints:false});searches++;nodes+=r.nodes;elapsedMs+=r.elapsedMs;}
  rows.push({tag,phase,index,depth,searches,nodes,elapsedMs,sampleExit:await sampled});
 }finally{e.close();}
}
writeFileSync(`${dir}/native-profiles.json`,JSON.stringify(rows,null,2));
