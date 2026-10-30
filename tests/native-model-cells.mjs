// Exhaust every generated constant, including Float32 signed zeros, without
// changing or instrumenting the production search executable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname,join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from '../scripts/native/build.mjs';
import { frozenModels } from '../scripts/frozen-player/models.mjs';
import { compile } from '../scripts/next-residual/model.mjs';
import { DEFAULT_WEIGHTS,FEATURE_NAMES } from '../src/features.js';

test('all 21,870 native Float32 cells and all 63 double weights are bit-identical to frozen JS exports',()=>{
 const receipt=build(),directory=mkdtempSync(join(tmpdir(),'reversi model cells '));
 try {
  const source=join(directory,'cells.cpp'),exe=join(directory,process.platform==='win32'?'cells.exe':'cells');
  writeFileSync(source,`#include "frozen.hpp"\n#include <iostream>\n#include <iomanip>\n#include <cstring>\n#include <cstdint>\nint main(){std::cout<<std::hex<<std::setfill('0');for(float v:frozen::table0){uint32_t b;std::memcpy(&b,&v,4);std::cout<<std::setw(8)<<b<<'\\n';}for(float v:frozen::table1){uint32_t b;std::memcpy(&b,&v,4);std::cout<<std::setw(8)<<b<<'\\n';}for(const auto& m:frozen::weights)for(const auto& p:m)for(double v:p){uint64_t b;std::memcpy(&b,&v,8);std::cout<<std::setw(16)<<b<<'\\n';}}\n`);
  const compiler=spawnSync(process.env.CXX??'c++',['-O3','-std=c++17','-ffp-contract=off','-fno-fast-math','-I',dirname(receipt.executable),source,'-o',exe],{encoding:'utf8'});
  assert.equal(compiler.status,0,compiler.stderr);
  const run=spawnSync(exe,[],{encoding:'utf8',maxBuffer:1024*1024});assert.equal(run.status,0,run.stderr);
  const models=frozenModels(),expected=[];
  for(const table of compile(models.P).tables){const view=new DataView(table.buffer,table.byteOffset,table.byteLength);for(let i=0;i<table.length;i++)expected.push(view.getUint32(i*4,true).toString(16).padStart(8,'0'));}
  const scratch=Buffer.alloc(8);
  for(const weights of [DEFAULT_WEIGHTS,models.L.weights,models.P.linear.weights])for(const phase of ['opening','middle','endgame'])for(const feature of Object.keys(FEATURE_NAMES)){scratch.writeDoubleLE(weights[phase][feature]);expected.push(scratch.readBigUInt64LE().toString(16).padStart(16,'0'));}
  assert.equal(expected.length,21870+63);assert.deepEqual(run.stdout.trim().split(/\r?\n/),expected);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
