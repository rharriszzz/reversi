#!/usr/bin/env node
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { read,atomic,sourceDigest } from '../research/io.mjs';
import { identity } from '../teacher/edax.mjs';
import { verifyPreflight } from '../teacher/bound-preflight.mjs';
import { Pool } from './pool.mjs';
import { game } from './games.mjs';
import { hash,PROTOCOL } from './protocol.mjs';
import { preferences,generate } from '../residual/data.mjs';
import { childEncoding,normalizePairs,objective,zero } from './linear.mjs';
import { encodePairs,csr,objective as patternObjective } from './model.mjs';
import { jointBootstrap } from './statistics.mjs';
const [oldArg,outArg,engineeringArg]=process.argv.slice(2),old=resolve(oldArg),output=resolve(outArg),engineering=resolve(engineeringArg);
const reservations=read(`${old}/reservations.json`),L=read(`${engineering}/L.json`),P=read(`${engineering}/P.json`),q=read('.local-research/teacher-qualification-v4r1-20261028/manifest.json');
const pin=identity(q.pin.binary,q.pin.evalFile,{buildFile:q.pin.experimental.buildFile});
if(q.status!=='complete'||!Object.values(q.gates).every(Boolean)||hash(pin)!==hash(q.pin))throw Error('Teacher not qualified');verifyPreflight(q.adapterPreflightPath,pin);
const runIdentity=hash({kind:'development-only-next-residual-pilot-v1',L:L.checksum,P:P.checksum,pin,source:sourceDigest('.')});
const workers=Math.min(2,read(`${output}/preflight.json`).workers),pool=new Pool(workers,output,runIdentity);
const report={kind:'development-only-integrated-pilot-v1',runIdentity,pin,workers,roots:[],gameCosts:[],models:{L:L.checksum,P:P.checksum}};
const start=performance.now();
try {
  for(const root of reservations.roles.training.slice(0,16)) {
    const begin=performance.now(),panels={};
    for(const selector of ['B','L'])panels[selector]=await pool.task(`engineering-frontier-${root.id}-${selector}`,{type:'frontier',root,model:selector==='B'?'B':L});
    const parents=[...new Map(Object.values(panels).flatMap(f=>f.parents).map(p=>[p.key,p])).values()],labels=[];
    for(let i=0;i<parents.length;i++) {
      const parent=parents[i],entry={};for(const depth of [10,12])entry[depth]=await pool.task(`engineering-label-${root.id}-${i}-${depth}`,{
        type:'label',pin,state:{board:parent.board,player:parent.player},depth,timeoutMs:PROTOCOL.queryCapMs,transcript:`${output}/raw/engineering-${root.id}-${i}-${depth}.json`});labels.push(entry);
      if(64-parent.occupied<=10)entry.independent=await pool.task(`engineering-exact-${root.id}-${i}`,{type:'exact',state:{board:parent.board,player:parent.player}});
    }
    const panelLabels=Object.fromEntries(['B','L'].map(k=>[k,panels[k].parents.map(p=>labels[parents.findIndex(q=>q.key===p.key)])]));
    const groups=Object.fromEntries(['B','L'].map(k=>[k,preferences(root,panels[k],panelLabels[k])]));
    // Encoding/finite losses and whole-source bootstrap exercise the complete path.
    for(const selector of ['B','L']) {
      objective(L.correction,normalizePairs([groups[selector]]));
      const encoded=encodePairs([groups[selector]],()=>panels[selector],L);patternObjective(P.coefficients,csr(encoded.groups));
    }
    const rootLabel={};for(const depth of [10,12])rootLabel[depth]=await pool.task(`engineering-rootlabel-${root.id}-${depth}`,{type:'label',pin,state:{board:root.board,player:root.player},depth,timeoutMs:PROTOCOL.queryCapMs,transcript:`${output}/raw/engineering-root-${root.id}-${depth}.json`});
    const searches=[];
    for(const depth of [4,6])for(const [name,model] of Object.entries({B:'B',L,P})) {
      const result=await pool.task(`engineering-search-${root.id}-${depth}-${name}`,{type:'root-search',state:{board:root.board,player:root.player},depth,model});
      searches.push({name,depth,wallMs:result.wallMs,nodes:result.nodes,evaluations:result.evaluations});
    }
    report.roots.push({id:root.id,phase:root.phase,policy:root.policy,depth:root.depth,generationMs:read(`${old}/trajectories/${root.id}.json`).wallMs,
      frontierMs:Object.values(panels).reduce((s,f)=>s+f.wallMs,0),parents:parents.length,
      labelMs:labels.reduce((s,ls)=>s+ls[10].wallMs+ls[12].wallMs,0),rootLabelMs:rootLabel[10].wallMs+rootLabel[12].wallMs,
      searches,wallMs:performance.now()-begin});
    console.log(JSON.stringify({stage:'pilot-root',...report.roots.at(-1)}));
  }
  await pool.close();
  const allGames=reservations.roles.games;
  for(const timeMs of [80,300])for(let index=0;index<2;index++) {
    const opening=allGames[index],path=`${output}/engineering-game-${timeMs}-${index}.json`;
    if(existsSync(path)){const saved=read(path);if(saved.runIdentity!==runIdentity)throw Error('Pilot game identity mismatch');report.gameCosts.push(saved);continue;}
    const games=[],begin=performance.now();
    for(const color of index%2?[-1,1]:[1,-1]){
      const partial=`${output}/engineering-game-partial-${timeMs}-${index}-${color}.json`;
      games.push(await game(opening,L,'B',color,timeMs,{resume:existsSync(partial)?read(partial):null,checkpoint:s=>atomic(partial,s)}));
    }
    const cost={runIdentity,timeMs,index,wallMs:performance.now()-begin,games};atomic(path,cost);report.gameCosts.push(cost);
    console.log(JSON.stringify({stage:'pilot-pair',timeMs,index,wallMs:cost.wallMs}));
  }
  // Independent completed receipt is re-read with a fresh pool before passing.
  const recoveryPool=new Pool(1,output,runIdentity),r=reservations.roles.training[0];
  await recoveryPool.task(`engineering-frontier-${r.id}-L`,{type:'frontier',root:r,model:L});await recoveryPool.close();
  report.statistics=jointBootstrap(report.roots.map(r=>({...r,lossDelta:.1})),['lossDelta']);
  report.elapsedMs=performance.now()-start;report.passed=true;report.checksum=hash(report);atomic(`${engineering}/pilot.json`,report);
  console.log(JSON.stringify({passed:true,workers,elapsedMs:report.elapsedMs}));
}finally{await pool.close();}
