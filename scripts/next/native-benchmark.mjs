#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { read, atomic } from '../research/io.mjs';
import { unpack, compile } from '../strong/model.mjs';
import { legalMovesFast } from '../../src/fast-features.js';
import { play } from '../../src/rules.js';
import { randomOpening, seededRandom } from '../../src/learning.js';
import { findBestMove, terminalScore } from '../../src/search.js';
import { oracleChildren, oracleScore } from '../../tests/oracle.mjs';
import { Profiler } from '../strong/telemetry.mjs';
const output=resolve(process.argv[2]??'.local-research/next-native');mkdirSync(output,{recursive:true});
const original=read('.local-research/strong-six-hour-20261027/manifest.json'),path=original.best['long-margin-p4'].path;
const profile=new Profiler(),m=profile.measure('model.read_unpack',()=>unpack(read(path))),compiled=profile.measure('model.compile',()=>compile(m));
const chunks=[],word=v=>{const b=Buffer.alloc(4);b.writeUInt32LE(v);chunks.push(b);};
word(0x52565431);word(m.spec.phases);word(m.spec.phaseStart);word(compiled.records.length);
for(const r of compiled.records){word(r.squares.length);word(r.size);for(const q of r.squares)word(q);chunks.push(Buffer.from(r.table.buffer,r.table.byteOffset,r.table.byteLength));}
writeFileSync(`${output}/tables.bin`,Buffer.concat(chunks));
const build=spawnSync('g++',['-O3','-std=c++17','-Wall','-Wextra','-pedantic','scripts/next/kernel.cpp','-o',`${output}/kernel`],{encoding:'utf8'});if(build.status!==0)throw new Error(build.stderr);
const positions=Array.from({length:48},(_,i)=>randomOpening(seededRandom(2026102900+i),[8,20,32,44,54,58][i%6])).filter(p=>p.player);
let nodes=0,evaluations=0;
function kernel(board,player,depth,alpha=-1e9,beta=1e9){nodes++;const moves=legalMovesFast(board,player);if(!moves.length){if(legalMovesFast(board,-player).length)return -kernel(board,-player,depth,-beta,-alpha);return terminalScore(board,player);}if(depth<=0){evaluations++;return compiled.evaluate(board,player);}let best=-1e9;for(const q of moves){best=Math.max(best,-kernel(play(board,player,q),-player,depth-1,-beta,-alpha));alpha=Math.max(alpha,best);if(alpha>=beta)break;}return best;}
const bits=(b,p)=>b.reduce((v,x,i)=>x===p?v|(1n<<BigInt(i)):v,0n).toString();
const pass=Int8Array.from(('.WBBBBBB'+'BBBBBBBB'.repeat(6)+'BBBBBBB.').split('').map(v=>v==='B'?1:v==='W'?-1:0));
const fixtures=[{board:pass,player:-1},{board:play(pass,1,0),player:-1},{board:Int8Array.from({length:64},(_,i)=>i===0?1:0),player:1},{board:new Int8Array(64),player:-1}];
const fixtureRun=spawnSync(`${output}/kernel`,[`${output}/tables.bin`],{input:`${fixtures.length} 2 1\n`+fixtures.map(p=>`${p.player} ${[...p.board].join(' ')}`).join('\n')+'\n',encoding:'utf8'});assert.equal(fixtureRun.status,0);
for(const line of fixtureRun.stdout.trim().split('\n'))if(line.startsWith('row ')){const [,i,,staticValue,score]=line.split(' '),p=fixtures[Number(i)];assert.equal(Number(score),oracleScore([...p.board],p.player));assert.equal(Number(score),findBestMove(p.board,p.player,2).score);assert.equal(Number(staticValue),compiled.evaluate(p.board,p.player));}
const benchmarks=[];
for(const depth of [1,4,6]) {
 const rows=depth===6?positions.filter((_,i)=>i%6===2).slice(0,4):positions,repeats=depth===1?20:2;
 const input=`${rows.length} ${depth} ${repeats}\n`+rows.map(p=>`${p.player} ${[...p.board].join(' ')}`).join('\n')+'\n';
 // Warm the same JS functions before measuring repeated workloads.
 for(const p of rows)kernel(p.board,p.player,Math.min(depth,2));
 const js=[],native=[];let scores,jsNodes,jsEvaluations;
 for(let rep=0;rep<3;rep++) {
  nodes=0;evaluations=0;const cpu=process.cpuUsage(),t=performance.now();
  for(let k=0;k<repeats;k++)scores=rows.map(p=>kernel(p.board,p.player,depth));
  const c=process.cpuUsage(cpu);js.push({wallMs:performance.now()-t,cpuMs:(c.user+c.system)/1000});jsNodes=nodes;jsEvaluations=evaluations;
  const start=performance.now(),run=spawnSync(`${output}/kernel`,[`${output}/tables.bin`],{input,encoding:'utf8',maxBuffer:4*1024*1024});if(run.status!==0)throw new Error(run.stderr);
  const endToEndMs=performance.now()-start,lines=run.stdout.trim().split('\n');
  for(const line of lines){const [kind,si,...rest]=line.split(' ');if(kind==='row'){const i=Number(si),p=rows[i];assert.equal(rest[0],bits(Object.assign(new Int8Array(64),Object.fromEntries(legalMovesFast(p.board,p.player).map(q=>[q,1]))),1));assert.ok(Math.abs(Number(rest[1])-compiled.evaluate(p.board,p.player))<1e-9);assert.ok(Math.abs(Number(rest[2])-scores[i])<1e-9);assert.equal(findBestMove(p.board,p.player,depth,undefined,{evaluate:compiled.evaluate,legalMoves:legalMovesFast}).score,scores[i]);}
   if(kind==='move'){const i=Number(si),q=Number(rest[0]),p=rows[i],b=play(p.board,p.player,q),oracle=oracleChildren([...p.board],p.player).find(r=>r.move===q);assert.deepEqual([...b],oracle.board);assert.equal(rest[1],bits(b,1));assert.equal(rest[2],bits(b,-1));}
  }
  const stat=lines.at(-1).split(' ').slice(1).map(Number);assert.equal(stat[3],jsNodes);assert.equal(stat[4],jsEvaluations);native.push({wallMs:stat[0],cpuMs:stat[1],loadMs:stat[2],endToEndMs,nodes:stat[3],evaluations:stat[4]});
 }
 benchmarks.push({depth,positions:rows.length,repeats,js,native});
}
await new Promise(resolve=>setImmediate(resolve));const result={ruleFixtures:fixtures.length,model:path,compiler:spawnSync('g++',['--version'],{encoding:'utf8'}).stdout.split('\n')[0],node:process.version,semantics:'ascending square alpha-beta, full-window, passes preserve depth, terminal sentinel, no TT; compared also to production TT scores. Native endToEnd includes spawn/load/text IPC; JS tables already loaded.',benchmarks,profile:profile.snapshot()};atomic(`${output}/results.json`,result);profile.close();console.log(JSON.stringify(result,null,2));
