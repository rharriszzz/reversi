#!/usr/bin/env node
// Supplement legacy partial snapshots with full legal behavior-game ancestry.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {read,atomic} from '../research/io.mjs';
import {hash} from './protocol.mjs';
import {KeyIndex} from '../residual/index.mjs';
import {keysFor,keyFor} from '../residual/data.mjs';
import {oracleChildren} from '../../tests/oracle.mjs';
import {initialBoard,legalMoves} from '../../src/rules.js';
import {sha} from './execution.mjs';
const [archive,inventoryPath,baseDir,output]=process.argv.slice(2),inv=read(inventoryPath),baseManifest=read(`${baseDir}/manifest.json`),base=KeyIndex.load(`${baseDir}/membership.bin`);
assert.equal(base.digest(),baseManifest.digest);assert.ok(!existsSync(`${output}/manifest.json`));mkdirSync(output,{recursive:true});copyFileSync(`${baseDir}/occurrences.jsonl.gz`,`${output}/occurrences.jsonl.gz`);
const executionSources=Object.fromEntries(['scripts/frozen-player/history-export.mjs','scripts/frozen-player/history-games.mjs','scripts/frozen-player/inventory.py','scripts/frozen-player/merge-index.py','scripts/frozen-player/recover-history-checkpoint.py','scripts/research/core.mjs','scripts/residual/data.mjs','src/rules.js','tests/oracle.mjs'].map(p=>[p,sha(p)]));
const start=performance.now(),extra=new Set(),sources=[],seen=new Set(),aliases=[],byHash=new Map();let chunk='',occurrences=baseManifest.occurrenceCount,games=0,obfs=0;
function flush(){if(chunk){appendFileSync(`${output}/occurrences.jsonl.gz`,gzipSync(chunk));chunk='';}}
function add(board,player,file,location,source,role){const occupied=board.filter(Boolean).length;if(occupied<12)return;const keys=keysFor(board);for(const k of keys)if(!base.has(k))extra.add(k);const terminal=!legalMoves(board,1).length&&!legalMoves(board,-1).length;
 chunk+=JSON.stringify({keys,actual:keyFor(board,player),file,location,source,role,player,occupied,terminal})+'\n';occurrences++;if(chunk.length>1048576)flush();}
function visit(v,file,location=''){
 if(!v||typeof v!=='object')return;
 if(Array.isArray(v)){for(let i=0;i<v.length;i++)if(typeof v[i]==='object')visit(v[i],file,`${location}/${i}`);return;}
 if(Array.isArray(v.states)&&Array.isArray(v.terminal)&&Array.isArray(v.moves)){
  let board=[...initialBoard()],player=1,passes=0;const states=new Set([`${player}:${board}`]),ancestry=[];
  for(const [i,s] of v.moves.entries()){
   if(s.player!==player){assert.equal(oracleChildren(board,player).length,0,'Legacy omitted pass must be forced');assert.ok(oracleChildren(board,-player).length);player=-player;states.add(`${player}:${board}`);add(board,player,file,`${location}/inferred-pass-before-${i}`,v.id??null,'legacy-forced-pass');}
   assert.equal(s.player,player,`historical behavior turn ${file}/${location}`);assert.ok(passes<2);const children=oracleChildren(board,player);
   if(s.move===null){assert.equal(children.length,0);passes++;}else{const c=children.find(c=>c.move===s.move);assert.ok(c,'historical behavior legal');board=c.board;passes=0;}
   player=-player;states.add(`${player}:${board}`);if(board.filter(Boolean).length>=12){add(board,player,file,`${location}/replayed/${i}`,v.id??null,`behavior-${v.split??'unknown'}-ancestry`);ancestry.push(keyFor(board,player));}
  }
  assert.deepEqual(board,v.terminal);assert.ok(!oracleChildren(board,1).length&&!oracleChildren(board,-1).length);
  for(const s of [...v.states,...(v.roots??[]),...(v.prefixes??[])])assert.ok(states.has(`${s.player}:${s.board}`),'Historical sample belongs to full legal behavior game');
  sources.push({file,location,id:v.id,seed:v.seed,split:v.split,ancestry});games++;
 }
 for(const [k,x] of Object.entries(v))if(typeof x==='object'&&k!=='states'&&k!=='roots'&&k!=='prefixes'&&k!=='moves'&&k!=='history')visit(x,file,`${location}/${k}`);
}
for(const [i,r] of inv.files.entries()){
 if(r.kind==='symlink')continue;
 if(byHash.has(r.sha256)){aliases.push([i,byHash.get(r.sha256)]);continue;}byHash.set(r.sha256,i);
 if(r.path.endsWith('.json')){
  const text=readFileSync(`${archive}/${r.path}`,'utf8');if(text.includes('"states"')&&text.includes('"moves"')&&text.includes('"terminal"'))visit(JSON.parse(text),i);
 }else if(r.path.endsWith('.obf')){
  for(const [j,line] of readFileSync(`${archive}/${r.path}`,'utf8').split('\n').entries()){
   const m=line.match(/^([XO-]{64})\s+([XO]);/);if(m){add([...m[1]].map(x=>x==='X'?1:x==='O'?-1:0),m[2]==='X'?1:-1,i,`obf/${j}`,null,'external-engineering-fixture');obfs++;}
  }
 }
 if(i%10000===0)console.log(JSON.stringify({file:i,games,extra:extra.size,seconds:(performance.now()-start)/1000}));
}
flush();const delta=KeyIndex.from(extra),merged=Buffer.allocUnsafe(base.bytes.length+delta.bytes.length);let i=0,j=0,k=0;
while(i<base.size||j<delta.size){let bytes,index;const cmp=i<base.size&&j<delta.size?base.bytes.compare(delta.bytes,j*32,(j+1)*32,i*32,(i+1)*32):0;
 if(j===delta.size||i<base.size&&cmp<0){bytes=base.bytes;index=i++;}else if(i===base.size||cmp>0){bytes=delta.bytes;index=j++;}else{bytes=base.bytes;index=i++;j++;}bytes.copy(merged,k++*32,index*32,(index+1)*32);
}
const index=new KeyIndex(merged.subarray(0,k*32));index.save(`${output}/membership.bin`);atomic(`${output}/behavior-source-registry.json`,{sources,aliases});
const {checksum,...oldBody}=baseManifest;const body={...oldBody,executionSources,baseExportChecksum:checksum,baseExport:baseDir,keys:index.size,digest:index.digest(),occurrenceCount:occurrences,behaviorGames:games,obfFixtures:obfs,behaviorAdditionalKeys:extra.size,behaviorRegistrySha256:sha(`${output}/behavior-source-registry.json`),occurrencesSha256:sha(`${output}/occurrences.jsonl.gz`),supplementMs:performance.now()-start,
 nonJsonCoverage:'OBF boards added. Compiled data, binaries, plots, logs and source text are inventoried dependencies; accepted queries/targets reside in parsed JSON. The sole .tmp checkpoint is zero bytes, no scientific content.'};
atomic(`${output}/manifest.json`,{...body,checksum:hash(body)});console.log(JSON.stringify({complete:true,games,keys:index.size,seconds:body.supplementMs/1000}));
