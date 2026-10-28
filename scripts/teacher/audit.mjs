#!/usr/bin/env node
import {existsSync,mkdirSync,readFileSync,openSync,closeSync,unlinkSync,appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {identity,alternatives,sha} from './edax.mjs';
import {validate,solve,trajectory} from './validate.mjs';
import {atomic,read,sourceDigest,instrumentIO} from '../research/io.mjs';
import {Progress,Profiler} from '../strong/telemetry.mjs';
import {historicalKeys} from '../strong/run.mjs';
import {canonical} from '../research/core.mjs';
import {seededRandom} from '../../src/learning.js';
import {legalMoves,play,counts,initialBoard} from '../../src/rules.js';
import {findBestMove} from '../../src/search.js';
import {legalMovesFast} from '../../src/fast-features.js';
const args=Object.fromEntries(process.argv.slice(2).filter((_,i)=>i%2===0).map((v,i)=>[v.slice(2),process.argv.slice(2)[2*i+1]]));
const output=resolve(args.output??'.local-research/teacher-audit'),repository=resolve(args.repository??'.');mkdirSync(output,{recursive:true});
const pin=identity(args.binary??'.local-research/teacher/edax/bin/lEdax-x86-64-v3',args.eval??'.local-research/teacher/edax/bin/data/eval.dat');
const smoke=args.smoke==='yes',mode=args.mode??'pilot',digest=sourceDigest(repository),start=performance.now();
const lock=`${output}/writer.lock`;if(existsSync(lock)){const pid=read(lock).pid;try{process.kill(pid,0);throw Error(`Active writer ${pid}`);}catch(e){if(e.code!=='ESRCH')throw e;}unlinkSync(lock);}const fd=openSync(lock,'wx');closeSync(fd);atomic(lock,{pid:process.pid});
const progress=new Progress(output),profiler=new Profiler();instrumentIO(profiler);
let state=existsSync(`${output}/manifest.json`)?read(`${output}/manifest.json`):{version:1,source:digest,pin,seed:2026102901,protocol:{strata:[[12,19],[20,35],[36,47],[48,55]],perStratum:smoke?2:250,representativePerStratum:smoke?1:125,depth:8,deeperDepth:10,stabilityFraction:.25,stabilityMinimum:.9,disagreementMinimum:100,representativeEarlyMinimum:30,exactAnchors:smoke?2:128,capMs:7200000,reportMarginMs:600000},elapsedMs:0,status:'created'};
if(state.source!==digest||state.pin.binarySha!==pin.binarySha||state.pin.evalSha!==pin.evalSha)throw Error('Frozen source/teacher mismatch');
const baseElapsed=state.elapsedMs;const checkpoint=()=>{state.elapsedMs=baseElapsed+performance.now()-start;state.lastCheckpoint=new Date().toISOString();atomic(`${output}/manifest.json`,state);progress.update({checkpoint:state.lastCheckpoint});};
const cap=()=>{if(baseElapsed+performance.now()-start>state.protocol.capMs-state.protocol.reportMarginMs)throw Error('Stage A computation cap; reserved reporting margin');};
async function receipt(name,fn){const p=`${output}/tasks/${name}.json`;if(existsSync(p))return read(p);cap();const r=await profiler.measure(name.split('-')[0],fn);atomic(p,r);return r;}
const bChoice=(s,d)=>findBestMove(s.board,s.player,d,undefined,{legalMoves:legalMovesFast});
function sample(index,stratum,hard){const rng=seededRandom(state.seed+index*7919),[lo,hi]=state.protocol.strata[stratum],occupied=lo+Math.floor(rng()*(hi-lo+1));let board=[...initialBoard()],player=1,passes=0;const history=[];
 while(passes<2&&counts(board).empty>64-occupied){const moves=legalMovesFast(board,player);if(!moves.length){passes++;player=-player;continue;}passes=0;const move=counts(board).empty>52||rng()<.12?moves[Math.floor(rng()*moves.length)]:bChoice({board,player},1).move;board=[...play(board,player,move)];player=-player;if(counts(board).empty<=52)history.push(canonical(board,player));}
 const s={board,player,index,stratum,group:hard?'disagreement':'representative',key:canonical(board,player),history};if(legalMovesFast(board,player).length<2)return null;
 const b1=bChoice(s,1),b3=bChoice(s,3);if(hard&&b1.move===b3.move)return null;return {...s,b1,b3};}
const best=r=>Math.max(...r.rows.map(x=>x.value));const tops=r=>r.rows.filter(x=>x.value===best(r)).map(x=>x.move);
try{if(state.status==='complete'){console.log('Stage A already complete; no computation repeated.');}else{state.status='running';state.pid=process.pid;checkpoint();
 progress.set({stage:'validation',substage:'exact-oracle',task:'32 six-empty roots, forced pass, terminal and symmetry checks'});
 state.validation=await receipt('validation',()=>validate(pin,output));checkpoint();
 progress.set({stage:'admission',substage:'historical-exclusion',task:'load prior complete trajectories and published alternatives'});
 let used;if(existsSync(`${output}/exclusions.json`))used=new Set(read(`${output}/exclusions.json`).keys);else{const h=historicalKeys(repository,['.local-research/strong-six-hour-20261027','.local-research/six-hour-20261027','.local-research/next-frozen-screen-20261028'].map(p=>resolve(repository,p)));state.exclusionAudit=h.audit;used=h.keys;atomic(`${output}/exclusions.json`,{keys:[...used]});}
 if(!existsSync(`${output}/roots.json`)){const roots=[];let index=0,rejected=0;for(let phase=0;phase<4;phase++)for(const hard of [false,true]){const n=hard?state.protocol.perStratum-state.protocol.representativePerStratum:state.protocol.representativePerStratum;for(let k=0;k<n;){cap();const s=sample(index++,phase,hard);if(index>100000)throw Error('Admission exhausted');if(!s||s.history.some(key=>used.has(key))||used.has(s.key)){rejected++;continue;}roots.push(s);for(const key of s.history)used.add(key);used.add(s.key);k++;if(roots.length%50===0)progress.emit('admitted',{accepted:roots.length,rejected});}}atomic(`${output}/roots.json`,{roots,rejected,attempts:index});}
 const roots=read(`${output}/roots.json`).roots;
 progress.set({stage:'pilot',substage:'label-cost',task:'three repeated 8/10-ply all-alternative batches across four phases',total:3});
 const pilot=[];for(let rep=0;rep<3;rep++){const t=performance.now();let nodes=0,labelMs=0;for(let phase=0;phase<4;phase++){const s=roots.filter(s=>s.stratum===phase)[rep%state.protocol.perStratum];for(const d of [8,10]){const r=await receipt(`pilot-${rep}-${phase}-${d}`,()=>alternatives(pin,s,d,{transcript:`${output}/raw/pilot-${rep}-${phase}-${d}.json`}));labelMs+=r.wallMs;nodes+=r.rows.reduce((a,r)=>a+r.nodes,0);}}pilot.push({rep,wallMs:labelMs,coordinatorWallMs:performance.now()-t,nodes,rss:process.memoryUsage().rss});progress.emit('pilot-completed',pilot.at(-1));}
 // B depth-six cost measured separately and included, rather than assuming free.
 const bt=performance.now();for(const s of roots.filter((s,i)=>i%Math.max(1,Math.floor(roots.length/12))===0))bChoice(s,6);
 state.pilot={trials:pilot,bDepth6TwelveMs:performance.now()-bt};
 const slow=Math.max(...pilot.map(r=>r.wallMs));state.pilot.projectedMs=1.35*(slow/4*roots.length+state.pilot.bDepth6TwelveMs/12*roots.length)+600000;checkpoint();
 if(mode!=='audit'){state.status='pilot-complete';checkpoint();console.log(JSON.stringify(state.pilot));}
 else{if(state.pilot.projectedMs>state.protocol.capMs-state.elapsedMs)throw Error('Pilot forecast cannot fit fixed audit plus margin');
 const results=[];progress.set({stage:'audit',substage:'all-alternatives',task:'Edax D8 with fixed quarter D10 subset; B depths 1/3/6',total:roots.length});
 for(let i=0;i<roots.length;i++){const s=roots[i],r=await receipt(`root-${i}`,async()=>{const b6=bChoice(s,6),teacher=await alternatives(pin,s,8,{transcript:`${output}/raw/root-${i}-8.json`}),deep=i%4===0?await alternatives(pin,s,10,{transcript:`${output}/raw/root-${i}-10.json`}):null;return {state:s,b6,teacher,deep};});results.push(r);if((i+1)%25===0){checkpoint();progress.update({completed:i+1,positions:i+1,task:`all alternatives; root ${i+1}/${roots.length}`});progress.emit('batch-completed');}}
 progress.set({stage:'anchors',substage:'exact-eight-empty',task:'128 independent mailbox roots and all Edax alternatives',total:state.protocol.exactAnchors});const anchors=[];
 for(let i=0;i<state.protocol.exactAnchors;i++){anchors.push(await receipt(`anchor-${i}`,async()=>{let s;for(let j=0;!s;j++){const candidate=trajectory(state.seed+900000+i*1000+j).find(s=>counts(s.board).empty===8);if(candidate&&!used.has(canonical(candidate.board,candidate.player)))s=candidate;cap();}const ref=solve(s.board,s.player),teacher=await alternatives(pin,s,8,{transcript:`${output}/raw/anchor-${i}.json`});if(teacher.rows.some(r=>ref.rows.length?r.value!==ref.rows.find(x=>x.move===r.move)?.value:r.value!==ref.value))throw Error('Exact anchor mismatch');return {state:s,reference:ref,teacher};}));if((i+1)%16===0){checkpoint();progress.update({completed:i+1});progress.emit('anchors-completed');}}
 const checked=results.filter(r=>r.deep),stable=checked.filter(r=>tops(r.teacher).every(m=>tops(r.deep).includes(m))),disagreements=stable.filter(r=>!tops(r.deep).includes(r.b6.move)),early=disagreements.filter(r=>r.state.stratum<2&&r.state.group==='representative');
 state.summary={roots:results.length,depthChecked:checked.length,stable:stable.length,stability:stable.length/checked.length,stableDisagreements:disagreements.length,representativeEarlyDisagreements:early.length,anchors:anchors.length,criteria:{stability:stable.length/checked.length>=.9,disagreements:disagreements.length>=100,representativeEarly:early.length>=30},byStratum:state.protocol.strata.map((range,i)=>({range,n:results.filter(r=>r.state.stratum===i).length,checked:checked.filter(r=>r.state.stratum===i).length,stable:stable.filter(r=>r.state.stratum===i).length,disagreements:disagreements.filter(r=>r.state.stratum===i).length})),examples:disagreements.slice(0,10)};
 // Replay both candidate continuations; save bounded independent re-searches.
 for(let i=0;i<state.summary.examples.length;i++){const r=state.summary.examples[i];r.continuations=[];for(const move of [tops(r.deep)[0],r.b6.move]){const row=r.deep.rows.find(x=>x.move===move);let board=[...play(r.state.board,r.state.player,move)],player=-r.state.player;for(const m of row.pv){const moves=legalMoves(board,player);if(m===null){if(moves.length)throw Error('Illegal PV pass');player=-player;continue;}if(!moves.includes(m))throw Error('Illegal PV move');board=[...play(board,player,m)];player=-player;}const recheck=await alternatives(pin,{board,player},8,{transcript:`${output}/raw/example-${i}-${move}.json`});r.continuations.push({move,pv:row.pv,leaf:{board,player},recheck});}}
 atomic(`${output}/results.json`,{summary:state.summary,pin,protocol:state.protocol,pilot:state.pilot,profile:profiler.snapshot()});state.status='complete';checkpoint();console.log(JSON.stringify({...state.summary,examples:state.summary.examples.length}));}
}}catch(e){state.status='stopped';state.error=e.stack;checkpoint();console.error(e);process.exitCode=1;}finally{progress.close();profiler.close();unlinkSync(lock);}
