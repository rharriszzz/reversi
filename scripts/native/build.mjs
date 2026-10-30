#!/usr/bin/env node
// Reconstruct frozen identities first; never train or read a private model.
import { mkdirSync, writeFileSync, readFileSync, existsSync, renameSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { frozenModels } from '../frozen-player/models.mjs';
import { compile, GEOMETRIES } from '../next-residual/model.mjs';
import { DEFAULT_WEIGHTS, FEATURE_NAMES } from '../../src/features.js';
export const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export const sha=b=>createHash('sha256').update(b).digest('hex');
export function frozenHeader() {
    const models=frozenModels(),compiled=compile(models.P),keys=Object.keys(FEATURE_NAMES);
    const weights=['B','L','P'].map(m=>['opening','middle','endgame'].map(p=>keys.map(k=>(m==='B'?DEFAULT_WEIGHTS:models[m==='P'?'L':m].weights)[p][k])));
    const float=v=>Object.is(v,-0)?'-0.0f':`${v.toExponential(9)}f`;
    const header=`// Generated from verified frozen coefficients. Do not edit.\n#pragma once\nnamespace frozen {\ninline constexpr const char* identities[3]={"original-production","${models.L.checksum}","${models.P.checksum}"};\ninline constexpr double weights[3][3][7]=${JSON.stringify(weights).replaceAll('[','{').replaceAll(']','}')};\ninline constexpr int squares[16][8]={${GEOMETRIES.map(g=>`{${[...g.squares].join(',')}}`).join(',')}};\ninline constexpr int lengths[16]={${GEOMETRIES.map(g=>g.squares.length).join(',')}};\n${compiled.tables.map((t,i)=>`inline constexpr float table${i}[${t.length}]={${[...t].map(float).join(',')}};`).join('\n')}\n}\n`;
    return {header,models,weights};
}
export function nativeDirectory(cpu=process.env.NATIVE_CPU??'portable') {
  if(!['portable','native','popcnt'].includes(cpu))throw Error('NATIVE_CPU must be portable, native or popcnt');
  if(cpu==='popcnt'&&!['x64','ia32'].includes(process.arch))throw Error('NATIVE_CPU=popcnt requires x86');
  return cpu==='native'?'.local-research/native-host':cpu==='popcnt'?'.local-research/native-popcnt':'.local-research/native';
}
function acquireBuildLock(directory) {
  const lock=resolve(directory,'.build-lock'),start=Date.now();
  for(;;) {
    try {mkdirSync(lock);writeFileSync(resolve(lock,'pid'),String(process.pid));return ()=>rmSync(lock,{recursive:true,force:true});}
    catch(error) {
      if(error.code!=='EEXIST')throw error;
      // Reclaim only a lock whose recorded owner has definitely exited.
      try {
        const pid=Number(readFileSync(resolve(lock,'pid'),'utf8'));
        if(Number.isInteger(pid)&&pid>0) {
          try {process.kill(pid,0);}catch(e){if(e.code==='ESRCH'){rmSync(lock,{recursive:true,force:true});continue;}}
        }
      }catch(e){if(e.code!=='ENOENT')throw e;}
      if(Date.now()-start>120000)throw Error(`Native build lock timed out: ${lock}`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,25);
    }
  }
}
export function build({cpu=process.env.NATIVE_CPU??'portable',directory=resolve(root,nativeDirectory(cpu)),profile=false,instrument=false,sanitize=false}={}) {
  const previous=process.cwd();process.chdir(root);let unlock;
  try {
    const {header,models}=frozenHeader();
    nativeDirectory(cpu);
    const target=cpu==='native'?[process.arch==='arm64'?'-mcpu=native':'-march=native']:cpu==='popcnt'?['-mpopcnt']:[];
    const flags=['-O3','-std=c++17','-Wall','-Wextra','-Wpedantic','-ffp-contract=off','-fno-fast-math',...target,...(profile||instrument?['-g','-fno-omit-frame-pointer']:[]),...(instrument?['-DNATIVE_PROFILE']:[]),...(sanitize?['-O1','-g','-fsanitize=address,undefined','-fno-omit-frame-pointer']:[])];
    const compiler=process.env.CXX??'c++',version=spawnSync(compiler,['--version'],{encoding:'utf8'});
    if(version.status!==0)throw Error(`Compiler unavailable: ${compiler}`);
    const sources=['native/engine.hpp','native/engine.cpp','native/main.cpp','scripts/native/build.mjs','scripts/native/client.mjs','scripts/native/client.py'];
    const sourceHashes=Object.fromEntries(sources.filter(p=>existsSync(p)).map(p=>[p,sha(readFileSync(p))]));
    const fingerprint=sha(JSON.stringify({header:sha(header),sourceHashes,flags,compiler:version.stdout}));
    mkdirSync(directory,{recursive:true});unlock=acquireBuildLock(directory);
    const executable=resolve(directory,process.platform==='win32'?'reversi-native.exe':'reversi-native');
    const receipt=resolve(directory,'build.json');
    if(existsSync(executable)&&existsSync(receipt)) {const saved=JSON.parse(readFileSync(receipt));if(saved.fingerprint===fingerprint&&saved.executableSha256===sha(readFileSync(executable)))return saved;}
    // Concurrent fresh-checkout test processes may request the same build.
    // Serialize publication as well: Mach-O output/signatures need not be byte
    // identical when linked through different temporary output names.
    const temporary=path=>`${path}.tmp-${process.pid}`;
    const headerPath=resolve(directory,'frozen.hpp');
    writeFileSync(temporary(headerPath),header);renameSync(temporary(headerPath),headerPath);
    const pending=temporary(executable);
    const run=spawnSync(compiler,[...flags,'-I',directory,'native/engine.cpp','native/main.cpp','-o',pending],{encoding:'utf8',cwd:root});
    if(run.status!==0){rmSync(pending,{force:true});throw Error(run.stderr||run.error);}
    renameSync(pending,executable);
    const saved={version:1,fingerprint,sourceHashes,flags,compiler:version.stdout.trim(),executable,executableSha256:sha(readFileSync(executable)),modelHeaderSha256:sha(header),models:{B:'original-production',L:models.L.checksum,P:models.P.checksum},createdAt:new Date().toISOString()};
    writeFileSync(temporary(receipt),JSON.stringify(saved,null,2)+'\n');renameSync(temporary(receipt),receipt);return saved;
  } finally {unlock?.();process.chdir(previous);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(build({profile:process.argv.includes('--profile'),instrument:process.argv.includes('--instrument'),sanitize:process.argv.includes('--sanitize'),directory:resolve(root,process.argv.includes('--sanitize')?'.local-research/native-sanitize':process.argv.includes('--instrument')?'.local-research/native-instrument':process.argv.includes('--profile')?'.local-research/native-profile':nativeDirectory())}),null,2));
