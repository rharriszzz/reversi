import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {writeFileSync,readFileSync} from 'node:fs';
import {build} from '../scripts/native/build.mjs';
import {microSource} from '../scripts/runtime-cpu/support.mjs';
const compiler=process.env.CXX??'c++';
const gcc=spawnSync(compiler,['--version'],{encoding:'utf8'}).stdout??'';
const eligible=process.platform==='linux'&&process.arch==='x64'&&gcc.includes('Free Software Foundation')&&!gcc.includes('clang');
test('two CPU backends retain engine state, mailbox flips, TT rollover and guarded selection',{skip:!eligible},()=>{
 const receipt=build({cpu:'dispatch',sanitize:!!process.env.NATIVE_SANITIZE,directory:resolve(process.env.NATIVE_SANITIZE?'.local-research/runtime-cpu-test-sanitize':'.local-research/runtime-cpu-test')}),dir=dirname(receipt.executable);
 const common=[...receipt.flags,...receipt.baselineFlags,'-I',dir,'-I','native'];
 const objects=[resolve(dir,'portable.o'),resolve(dir,'enhanced.o')];
 const internals=resolve(dir,'internals');
 execFileSync(compiler,[...common,...objects,'tests/native-internals.cpp','-o',internals]);
 const hello=backend=>JSON.parse(execFileSync(receipt.executable,[],{input:'1 hello\n',encoding:'utf8',env:{...process.env,REVERSI_CPU_BACKEND:backend}}));
 const auto=hello('auto'),supported=Object.values(auto.cpuFeatures).every(Boolean);
 assert.equal(auto.cpuBackend,supported?'x86-popcnt-bmi1-bmi2-lzcnt':'portable');
 assert.equal(hello('portable').cpuBackend,'portable');assert.equal(auto.tableBytes,10485760);
 for(const backend of ['portable',...(supported?['enhanced']:[])]) {
  execFileSync(internals,[],{env:{...process.env,REVERSI_CPU_BACKEND:backend}});
  if(backend==='enhanced') {
   const extra=resolve(dir,'internals-enhanced.cpp'),exe=resolve(dir,'internals-enhanced');
   const original=readFileSync('tests/native-internals.cpp','utf8').replace('assert(patterns(board,phase)==sum);','assert(reversi::cpu_enhanced::patterns(board,phase)==sum);');
   writeFileSync(extra,'#include \"engine.hpp\"\nnamespace reversi::cpu_enhanced {double patterns(Board,int); }\n'+original);
   execFileSync(compiler,[...common,...objects,extra,'-o',exe]);execFileSync(exe,[],{env:{...process.env,REVERSI_CPU_BACKEND:backend}});
  }
  const source=resolve(dir,`micro-${backend}.cpp`),executable=resolve(dir,`micro-${backend}`);
  writeFileSync(source,microSource(backend==='enhanced'));
  execFileSync(compiler,[...common,...objects,source,'-o',executable]);
  const result=JSON.parse(execFileSync(executable,['--check'],{encoding:'utf8'}));
  assert.ok(result.checkedCases>1200000);assert.deepEqual(result.rows,[]);
 }
 const state=resolve(dir,'state');
 execFileSync(compiler,[...common,...objects,'tests/runtime-cpu-state.cpp','-o',state]);
 execFileSync(state);
 const invalid=spawnSync(receipt.executable,[],{env:{...process.env,REVERSI_CPU_BACKEND:'invalid'},encoding:'utf8'});
 assert.equal(invalid.status,1);assert.match(invalid.stderr,/REVERSI_CPU_BACKEND/);
 if(!supported) {
  const denied=spawnSync(receipt.executable,[],{env:{...process.env,REVERSI_CPU_BACKEND:'enhanced'},encoding:'utf8'});
  assert.equal(denied.status,1);assert.match(denied.stderr,/unsupported/);
 }
});
