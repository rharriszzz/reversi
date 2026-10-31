// Snapshot/compile the checked-out production candidate beside preserved builds.
import {mkdirSync,readFileSync,writeFileSync,copyFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {sha} from '../native/build.mjs';
const out=resolve(process.env.REVERSI_FLIP_RUN??'.local-research/fast-flips-m4-20261031'),dir=resolve(out,'selected');
if(existsSync(resolve(out,'integrated-final.json')))throw Error('Preserve measured selected build');
mkdirSync(dir,{recursive:true});const manifest=JSON.parse(readFileSync(resolve(out,'builds.json'))),cxx=process.env.CXX??'c++',flags=manifest.flags;
const compile=args=>execFileSync(cxx,[...flags,...args],{stdio:'inherit'});
for(const f of ['engine.cpp','engine.hpp','main.cpp'])copyFileSync(`native/${f}`,resolve(dir,f));
copyFileSync(resolve(out,'original/frozen.hpp'),resolve(dir,'frozen.hpp'));
copyFileSync(resolve(out,'original/qualification.cpp'),resolve(dir,'qualification.cpp'));
compile(['-I',dir,'-c',resolve(dir,'engine.cpp'),'-o',resolve(dir,'engine.o')]);
compile(['-I',dir,resolve(dir,'engine.o'),resolve(dir,'main.cpp'),'-o',resolve(dir,'engine')]);
compile(['-I',dir,resolve(dir,'engine.o'),resolve(dir,'qualification.cpp'),'-o',resolve(dir,'qualify')]);
compile([resolve(dir,'engine.o'),resolve(out,'driver.o'),'-o',resolve(dir,'fixed-work')]);
const executable=resolve(dir,'engine'),commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const sourceHashes=Object.fromEntries(['engine.cpp','engine.hpp','main.cpp'].map(f=>[f,sha(readFileSync(resolve(dir,f)))]));
const receipt={...manifest.builds['ray-table'],algorithm:'selected-ray-table',commit,sourceHashes,executable,executableSha256:sha(readFileSync(executable))};
receipt.fingerprint=sha(JSON.stringify({commit,sourceHashes,flags,compiler:manifest.compiler}));
manifest.builds.selected=receipt;writeFileSync(resolve(out,'builds.json'),JSON.stringify(manifest,null,2)+'\n');writeFileSync(resolve(dir,'build.json'),JSON.stringify(receipt,null,2)+'\n');
if(process.platform==='darwin') {
  execFileSync('dsymutil',[resolve(dir,'fixed-work')]);writeFileSync(resolve(dir,'assembly.txt'),execFileSync('otool',['-tvV',resolve(dir,'engine')]));
}else writeFileSync(resolve(dir,'assembly.txt'),execFileSync('objdump',['-Cd',resolve(dir,'engine')]));
console.log(JSON.stringify(receipt,null,2));
