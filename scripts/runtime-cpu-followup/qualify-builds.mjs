// Run independent flip and same-object state assertions on every 2x2 build.
// Optional sanitizer rebuilds are separate from all measured objects/binaries.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {sha} from '../native/build.mjs';
const out=resolve(process.env.REVERSI_DISPATCH_RUN),sanitize=process.argv.includes('--sanitize');
const cxx=process.env.CXX??'g++-15',records=JSON.parse(readFileSync(resolve(out,'builds.json'))).records;
// Direct helper probes must never bypass the engine's runtime feature guard.
const host=JSON.parse(execFileSync(resolve(out,'A/reversi-native'),[],{input:'1 hello\n',encoding:'utf8',env:{...process.env,REVERSI_CPU_BACKEND:'auto'}}));
assert.ok(Object.values(host.cpuFeatures).every(Boolean),'Enhanced helper qualification is unsupported on this CPU');
const results={};
for(const tag of ['A','B','C','D']) {
 const source=resolve(out,tag),dir=sanitize?resolve(out,'sanitize-'+tag):source;
 mkdirSync(dir,{recursive:true});
 const extra=sanitize?['-O1','-g','-fsanitize=address,undefined','-fno-omit-frame-pointer']:[];
 const common=[...records[tag].driverFlags,...extra,'-I',source];
 const cc=args=>execFileSync(cxx,args,{stdio:['ignore','ignore','pipe']});
 const objects=['engine','engine-enhanced'].map(name=>resolve(dir,name+'.o'));
 if(sanitize)for(const [i,name] of ['engine','engine-enhanced'].entries())cc([...records[tag].units[name],...extra,'-I',source,'-c',resolve(source,name+'.cpp'),'-o',objects[i]]);
 const checks=[];
 for(const [name,input] of [['state','tests/runtime-cpu-state.cpp'],['internals','tests/native-internals.cpp'],['micro','micro.cpp'],['micro-portable','micro-portable.cpp'],['reversi-native','main.cpp']]) {
  const exe=resolve(dir,name),file=input.startsWith('tests/')?input:resolve(source,input);
  if(sanitize||!['state','micro','micro-portable','reversi-native'].includes(name))cc([...common,...objects,file,'-o',exe]);
  const env={...process.env,ASAN_OPTIONS:'detect_leaks=1'};
  if(name.startsWith('micro')) {
   const r=JSON.parse(execFileSync(exe,['--check'],{encoding:'utf8',env}));assert.ok(r.checkedCases>1200000);checks.push({name,cases:r.checkedCases});
  }else if(name==='internals') {
   for(const backend of ['portable','enhanced'])execFileSync(exe,[],{env:{...env,REVERSI_CPU_BACKEND:backend}});
   // Explicitly exercise the enhanced pattern helper, not the portable diagnostic.
   const text=readFileSync(file,'utf8').replace('assert(patterns(board,phase)==sum);','assert(reversi::cpu_enhanced::patterns(board,phase)==sum);');
   const file2=resolve(dir,'internals-enhanced.cpp'),exe2=resolve(dir,'internals-enhanced');
   writeFileSync(file2,'#include "engine.hpp"\nnamespace reversi::cpu_enhanced {double patterns(Board,int);}\n'+text);
   cc([...common,...objects,file2,'-o',exe2]);execFileSync(exe2,[],{env:{...env,REVERSI_CPU_BACKEND:'enhanced'}});checks.push({name,passed:true});
  }else if(name==='reversi-native') {
   for(const backend of ['auto','portable','enhanced']) {
    const hello=JSON.parse(execFileSync(exe,[],{input:'1 hello\n',encoding:'utf8',env:{...env,REVERSI_CPU_BACKEND:backend}}));
    assert.equal(hello.cpuBackend,backend==='portable'?'portable':'x86-popcnt-bmi1-bmi2-lzcnt');
   }
   const r=spawnSync(exe,[],{env:{...env,REVERSI_CPU_BACKEND:'invalid'},encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/REVERSI_CPU_BACKEND/);checks.push({name,passed:true});
  }else {execFileSync(exe,[],{env});checks.push({name,passed:true});}
 }
 results[tag]={passed:true,sanitize,flags:extra,checks,binaryHashes:Object.fromEntries(['state','internals','internals-enhanced','micro','micro-portable','reversi-native'].map(f=>[f,sha(readFileSync(resolve(dir,f)))]))};
 console.log('Qualified '+tag+(sanitize?' ASan/UBSan':''));
}
writeFileSync(resolve(out,sanitize?'sanitizer-qualification.json':'build-qualification.json'),JSON.stringify(results,null,2)+'\n');
