#!/usr/bin/env node
import {python} from '../python.mjs';
// Read-only historical extraction. Unknown roles remain conservatively restricted.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,appendFileSync,existsSync,mkdirSync,statSync,truncateSync,readdirSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {read,atomic} from '../research/io.mjs';
import {hash} from './protocol.mjs';
import {sha} from './execution.mjs';
import {frozenModels} from './models.mjs';
import {KeyIndex} from '../residual/index.mjs';
import {keysFor,keyFor,verifyTrajectory} from '../residual/data.mjs';
import {canonical} from '../research/core.mjs';
import {legalMoves,play,initialBoard} from '../../src/rules.js';
import {oracleChildren} from '../../tests/oracle.mjs';
import {pilotGameKeys} from '../next-residual/exclusions.mjs';
const [archiveArg,inventoryArg,outputArg]=process.argv.slice(2),archive=resolve(archiveArg),output=resolve(outputArg);
assert.ok(!output.startsWith(archive+'/'));mkdirSync(output,{recursive:true});
assert.ok(!existsSync(`${output}/manifest.json`),'Export already complete; never overwrite');
const started=performance.now(),inventory=read(inventoryArg),files=inventory.files;
const paths=new Map(files.map((r,i)=>[r.path,i]));let aliases=[],parsed=[],errors=[],references=[],counts={},seeds=new Set(),extra=new Set(),chunks=0,firstFile=0;
let occurrenceCount=0,chunk='',cache=new Map(),trajectories=0,pvs=0,receipts=0,gameReplays=0;
if(!existsSync(`${output}/occurrences.jsonl.gz`))writeFileSync(`${output}/occurrences.jsonl.gz`,'');
mkdirSync(`${output}/key-chunks`,{recursive:true});
function flushKeys(){if(extra.size){KeyIndex.from(extra).save(`${output}/key-chunks/${String(chunks++).padStart(6,'0')}.bin`);extra=new Set();}}
function addKey(k){if(!base.has(k))extra.add(k);if(extra.size>=200000)flushKeys();}
function flush(){if(chunk){appendFileSync(`${output}/occurrences.jsonl.gz`,gzipSync(chunk));chunk='';}}
function emit(row){chunk+=JSON.stringify(row)+'\n';occurrenceCount++;if(chunk.length>1048576)flush();}
const seenHash=new Map(),baseDir='residual-constraint-pattern-screen-v1-20261029',base=KeyIndex.load(`${archive}/${baseDir}/historical-index.bin`);
const baseMeta=read(`${archive}/${baseDir}/historical-index.json`);assert.equal(base.digest(),baseMeta.digest);
for(let i=1;i<base.size;i++)assert.ok(base.bytes.compare(base.bytes,(i-1)*32,i*32,i*32,(i+1)*32)>0,'Strictly sorted base');
// The legacy membership remains an additional conservative restriction; it
// never gets an invented favorable role. Raw evidence supplies occurrence roles.
function record(board,player,file,location,role,source=null){
 if(!Array.isArray(board)||board.length!==64||!board.every(v=>[-1,0,1].includes(v)))return;
 const occupied=board.filter(Boolean).length;if(occupied<12)return;
 const text=board.join(','),old=cache.get(text);let keys,terminal;
 if(old){({keys,terminal}=old);}else{
  keys=keysFor(board);terminal=!legalMoves(board,1).length&&!legalMoves(board,-1).length;
  if(cache.size>=100000)cache=new Map();cache.set(text,{keys,terminal});
 }
 for(const k of keys)addKey(k);
 const actual=player===1?keys[0]:player===-1?keys[1]:null;
 emit({keys,actual,file,location,role,source,player:player??null,occupied,terminal});counts[role]=(counts[role]??0)+1;
}
function encoded(text,file,location,role,source){
 if(/^[012]{64}$/.test(text)){const k=hash(text);addKey(k);emit({keys:[k],file,location,role:'encoded-history-unknown',source});}
 else if(/^-?1:[01,\-]+$/.test(text)){
  const [p,b]=text.split(':'),board=b.includes(',')?b.split(',').map(Number):(b.match(/-1|[01]/g)??[]).map(Number);
  record(board,Number(p),file,location,role,source);
 }
}
function pv(state,result,file,location,source){
 if(!state?.board||!Array.isArray(result?.rows)||!result.rows.every(r=>Array.isArray(r.pv)&&'move' in r))return;
 for(const row of result.rows){let board=[...state.board],player=state.player,step=0,passes=0;
  for(const move of [...(row.move===null?[]:[row.move]),...row.pv]){
   const children=oracleChildren(board,player);
   if(move===null){assert.equal(children.length,0,`historical PV pass ${files[file]?.path} ${location}`);passes++;assert.ok(passes<=2);}
   else {const c=children.find(c=>c.move===move);assert.ok(c,`historical PV ${location} ${move}`);assert.ok(passes<2);board=c.board;passes=0;}
   player=-player;record(board,player,file,`${location}/move-${row.move}/step-${++step}`,'teacher-internal-PV',source);
  }pvs++;
 }
}
function game(opening,result,file,location,source){
 if(!opening?.board||!Array.isArray(result?.moves)||!result.moves.every(s=>s&&typeof s==='object'&&'player' in s&&'move' in s))return;
 let board=[...opening.board],player=opening.player,passes=0;
 for(const [i,s] of result.moves.entries()){
  assert.equal(s.player,player);assert.ok(passes<2);
  const children=oracleChildren(board,player);
  if(s.move===null){assert.equal(children.length,0);passes++;}else{const c=children.find(c=>c.move===s.move);assert.ok(c,`historical game ${location}`);board=c.board;passes=0;}
  player=-player;record(board,player,file,`${location}/replayed/${i}`,'played-game-state',source);
 }
 if(result.board)assert.deepEqual(board,result.board);gameReplays++;
}
function visit(v,file,loc='',context={role:'unknown-conservatively-restricted',source:null,player:null}){
 if(typeof v==='string'){encoded(v,file,loc,context.role,context.source);return;}
 if(!v||typeof v!=='object')return;
 if(Array.isArray(v)){
  if(v.length===64&&v.every(x=>[-1,0,1].includes(x))){record(v,context.player,file,loc,context.role,context.source);return;}
  if(v.length===8&&v.every(x=>typeof x==='string'&&/^[.BW]{8}$/.test(x))){record(v.join('').split('').map(x=>x==='B'?1:x==='W'?-1:0),context.player,file,loc,context.role,context.source);return;}
  for(let i=0;i<v.length;i++)visit(v[i],file,`${loc}/${i}`,context);return;
 }
 const c={...context,source:v.id??v.rootId??context.source,player:[1,-1].includes(v.player)?v.player:context.player};
 if(v.seed!==undefined)seeds.add(v.seed);
 if(v.role)c.role=`historical-${v.role}`;
 if(v.spec?.role)c.role=`historical-${v.spec.role}`;
 if(v.job?.spec?.role)c.role=`historical-${v.job.spec.role}`;
 if(v.job&&v.resultHash){assert.equal(hash(v.result),v.resultHash,'historical result digest');assert.equal(hash({job:v.job,runIdentity:v.runIdentity}),v.inputHash,'historical input digest');receipts++;}
 else if(v.inputHash&&v.input&&v.runIdentity){assert.equal(hash({input:v.input,runIdentity:v.runIdentity}),v.inputHash);receipts++;}
 if(v.moves&&v.history&&v.root&&v.spec){if(v.root){verifyTrajectory(v);for(const child of oracleChildren(v.root.board,v.root.player))record(child.board,-v.root.player,file,`${loc}/reserved-root-child-${child.move}`,'reserved-root-child',v.id??v.spec.role);}trajectories++;}
 if(v.job?.type==='label')pv(v.job.state,v.result,file,`${loc}/job-label`,c.source);
 if(v.input){const s=v.input.s??v.input.state;if(s)pv(s,v.result,file,`${loc}/input-label`,c.source);}
 if(v.state){pv(v.state,v.result??v.teacher,file,`${loc}/state-label`,c.source);pv(v.state,v.deep,file,`${loc}/state-deep`,c.source);for(const [d,r] of Object.entries(v.depths??{}))pv(v.state,r,file,`${loc}/depths/${d}`,c.source);}
 if(v.opening){game(v.opening,v,file,loc,c.source);for(const [i,g] of (v.games??[]).entries())game(v.opening,g,file,`${loc}/games/${i}`,c.source);}
 for(const [k,x] of Object.entries(v)){
  if(k==='board'&&Array.isArray(x)){
   record(x,c.player,file,`${loc}/board`,c.role,c.source);
   // Direct queried/root alternatives are excluded even when not serialized.
   if([1,-1].includes(c.player)&&v.rows)
    for(const child of oracleChildren(x,c.player))record(child.board,-c.player,file,`${loc}/derived-child-${child.move}`,'direct-scored-child',c.source);
  }else visit(x,file,`${loc}/${k}`,c);
 }
}
// Exact artifact and published audit anchors, without running any optimizer.
const models=frozenModels();for(const n of ['L','P'])assert.deepEqual(read(`${archive}/${baseDir}/engineering-v2/${n}.json`),models[n]);
const audits={};for(const name of [baseDir]){
 const a=read(`${archive}/${name}/audit.json`);const {checksum,...body}=a;assert.equal(hash(body),checksum);audits[name]=a;
}
assert.equal(audits[baseDir].runIdentity,'361277f1de3bd638fe29250a15e9fe6f54cf6fafac2a2f2db9c4cbf1a991b1c2');
assert.equal(read(`${archive}/${baseDir}/reservations.json`).checksum,'72f95d130f9478f7cf99778c1d17e0bf9262a8e10a48811b8e1bd5254fec13c4');
const old='residual-frontier-v1r2-20261028';assert.equal(read(`${archive}/${old}/manifest.json`).runIdentity,'601ea969f0a43fbbe5d0ac87e805e0fbb08a4fde976121ed2d7fe7753397bfe0');assert.equal(read(`${archive}/${old}/reservations.json`).digest,'c86d121af8f1209b9b58341dc5cc83fed296b46d0b82410518c5a0c98867c212');const played=pilotGameKeys(read(`${archive}/${old}/pilot-results.json`),read(`${archive}/${baseDir}/engineering-v2/pilot.json`),read(`${archive}/${old}/reservations.json`));
const missing=[...played.keys].filter(k=>!base.has(k)).sort();assert.equal(missing.length,1326);assert.equal(hash(missing),'0c1011c931c31823c115d945ec9a681156ebf348a984fca41b29c90a9d97fe9e');for(const k of played.keys)addKey(k);
if(existsSync(`${output}/checkpoint.json`)){const c=read(`${output}/checkpoint.json`);({aliases,parsed,references,counts,chunks,occurrenceCount,trajectories,pvs,receipts,gameReplays}=c);seeds=new Set(c.seeds);firstFile=c.nextFile;extra=new Set();assert.ok(Number.isSafeInteger(c.occurrenceBytes),'Checkpoint requires disclosed gzip boundary recovery');truncateSync(`${output}/occurrences.jsonl.gz`,c.occurrenceBytes);for(const name of readdirSync(`${output}/key-chunks`))if(Number(name.split('.')[0])>=chunks)unlinkSync(`${output}/key-chunks/${name}`);}
for(const [file,row] of files.entries()){
 if(row.kind==='symlink'||!(/\.(json|jsonl)$/.test(row.path)))continue;
 // Snapshot source JSON is immutable copied code/fixtures, still inventoried;
 // the live committed fixtures/publications are added separately below.
 const prior=seenHash.get(row.sha256);if(prior!==undefined){if(file>=firstFile)aliases.push([file,prior]);continue;}seenHash.set(row.sha256,file);if(file<firstFile)continue;
 try{
  if(row.path.endsWith('.jsonl')){
   // Telemetry/events contain no new scientific boards; parse line-by-line for
   // full format coverage and any embedded board/seed identities.
   const text=readFileSync(`${archive}/${row.path}`,'utf8');let i=0;for(const line of text.split('\n')){if(line.trim())visit(JSON.parse(line),file,`line/${i}`);i++;}
  }else {const v=read(`${archive}/${row.path}`);visit(v,file);
   if(row.path.endsWith('/manifest.json'))for(const field of ['data','labels'])for(const ps of Object.values(v[field]??{}))for(const p of Array.isArray(ps)?ps:[]){
    if(typeof p!=='string')continue;const marker='/.local-research/',relative=p.includes(marker)?p.split(marker).slice(1).join(marker):null;
    if(relative){assert.ok(paths.has(relative),`Missing ${field} ${p}`);references.push([file,field,paths.get(relative)]);}
   }
  }parsed.push(file);
 }catch(e){errors.push({file,path:row.path,error:e.message});atomic(`${output}/errors.json`,errors);throw e;}
 if(parsed.length%1000===0){flush();flushKeys();atomic(`${output}/checkpoint.json`,{nextFile:file+1,occurrenceBytes:statSync(`${output}/occurrences.jsonl.gz`).size,aliases,parsed,references,counts,chunks,occurrenceCount,trajectories,pvs,receipts,gameReplays,seeds:[...seeds]});console.log(JSON.stringify({parsed:parsed.length,files:files.length,extra:extra.size,occurrences:occurrenceCount,seconds:(performance.now()-started)/1000,rss:process.memoryUsage().rss}));}
}
// Current public fixtures, disclosed benchmark and engineering evidence.
const localInputs=['scripts/machine-benchmark/positions.json','docs/data/next-residual-results-20261029.json','.local-research/frozen-player-screen-v1-20261029/engineering/qualification.json'];
for(const [i,p] of localInputs.entries())visit(read(p),files.length+i,p,{role:'disclosed-engineering',source:p});
flush();flushKeys();
const {execFileSync}=await import('node:child_process');
const combined=JSON.parse(execFileSync(python,['scripts/frozen-player/merge-index.py',`${output}/membership.bin`,`${archive}/${baseDir}/historical-index.bin`,`${output}/key-chunks`],{encoding:'utf8',maxBuffer:1000000}));
const index=KeyIndex.load(`${output}/membership.bin`);
const training=read(`${archive}/${old}/reservations.json`).roles;
const groups=role=>training[role].map(r=>read(`${archive}/${old}/preferences/${r.id}.json`).group);
const corpusHash=hash({training:groups('training'),development:groups('development')});assert.equal(corpusHash,models.L.metadata.corpusHash);assert.equal(corpusHash,models.P.metadata.corpusHash);
const body={format:'frozen-player-historical-export-v1',archive,inventorySha256:createHash('sha256').update(readFileSync(inventoryArg)).digest('hex'),
 base:{keys:base.size,digest:base.digest(),role:'legacy-unknown-conservatively-restricted'},keys:index.size,digest:index.digest(),deltaChunks:chunks,merge:combined,
 files:files.length,parsed,aliases,errors,references,counts,occurrenceCount,trajectories,pvs,receipts,gameReplays,seeds:[...seeds],localInputs,
 occurrencesSha256:sha(`${output}/occurrences.jsonl.gz`),
 corpusHash,models:{L:models.L.checksum,P:models.P.checksum},audits,missingPilotKeysAdded:1326,wallMs:performance.now()-started,maxRssBytes:process.resourceUsage().maxRSS*1024,
 policy:'All occurrences retained with file/location and alias expansion. Unknown historical roles conservatively restricted; no unknown identity is asserted oracle-only. Membership includes all legacy identities. Prospective terminal convergence is separately reported.'};
atomic(`${output}/manifest.json`,{...body,checksum:hash(body)});console.log(JSON.stringify({complete:true,keys:index.size,occurrenceCount,seconds:body.wallMs/1000}));
