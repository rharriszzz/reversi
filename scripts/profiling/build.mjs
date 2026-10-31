// Reconstruct historical and current sources without editing either engine.
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {frozenHeader,sha} from '../native/build.mjs';
const out=resolve(process.env.REVERSI_PROFILE_RUN??'.local-research/profiling-m4-20261030');
if(existsSync(resolve(out,'trials.json')))throw Error('Measured builds are preserved. Choose a fresh REVERSI_PROFILE_RUN directory before rebuilding.');
mkdirSync(out,{recursive:true});
const flags=['-O3','-std=c++17','-Wall','-Wextra','-Wpedantic','-ffp-contract=off','-fno-fast-math','-g'];
const commits={before:'43e52d2235c17670f302ab822636f11660e4f8b7',after:'1f0faa3b7fac3ca42f7ccd06aec1d8c27e38acbf'};
const compiler=execFileSync('c++',['--version'],{encoding:'utf8'}).trim(),frozen=frozenHeader(),builds={};
for(const [tag,commit] of Object.entries(commits)) {
 const dir=resolve(out,tag);mkdirSync(dir,{recursive:true});const sources={};
 for(const ext of ['cpp','hpp']){const text=execFileSync('git',['show',`${commit}:native/engine.${ext}`]);writeFileSync(resolve(dir,`engine.${ext}`),text);sources[`native/engine.${ext}`]=sha(text);}
 writeFileSync(resolve(dir,'frozen.hpp'),frozen.header);const executable=resolve(dir,'fixed-work');
 // Debug information must not change engine machine code. Compare both objects.
 const object=resolve(dir,'engine.o'),plain=resolve(dir,'engine-production.o');
 for(const [file,opts] of [[object,flags],[plain,flags.filter(f=>f!=='-g')]])
  execFileSync('c++',[...opts,'-I',dir,'-c',resolve(dir,'engine.cpp'),'-o',file]);
 const textSection=file=>execFileSync('otool',['-s','__TEXT','__text',file],{encoding:'utf8'}).split('\n').slice(2).join('\n');
 if(textSection(object)!==textSection(plain))throw Error('Debug info changed engine instructions');
 execFileSync('c++',[...flags,'-I',dir,'-c','scripts/profiling/driver.cpp','-o',resolve(dir,'driver.o')]);
 execFileSync('c++',[...flags,object,resolve(dir,'driver.o'),'-o',executable]);
 execFileSync('dsymutil',[executable]);
 const identity={commit,sourceHashes:sources,driverSha256:sha(readFileSync('scripts/profiling/driver.cpp')),modelHeaderSha256:sha(frozen.header),flags,compiler,productionTextVerified:true};
 builds[tag]={...identity,executable,executableSha256:sha(readFileSync(executable)),fingerprint:sha(JSON.stringify(identity))};
}
const old=JSON.parse(readFileSync('docs/data/mac-optimization-experiments-20261030.json')).repeated;
const root=id=>old.positions.find(p=>p.id===id);
const workloads=[
 {id:'evaluate-B',phase:'static',model:'B',depth:0,mode:'evaluate',position:root('native-engineering-5')},
 {id:'evaluate-P',phase:'static',model:'P',depth:0,mode:'evaluate',position:root('native-engineering-5')},
 {id:'opening-B',phase:'opening',model:'B',depth:9,mode:'play',position:root('native-engineering-1')},
 {id:'middle-P',phase:'middle',model:'P',depth:8,mode:'play',position:root('native-engineering-5')},
 {id:'exact-P',phase:'exact',model:'P',depth:12,mode:'play',position:root('native-engineering-10')},
 {id:'coaching-P',phase:'coaching',model:'P',depth:6,mode:'coach',position:root('native-engineering-5')}
];
if(workloads.some(w=>!w.position))throw Error('Missing registered root');
writeFileSync(resolve(out,'builds.json'),JSON.stringify({builds,workloads},null,2)+'\n');console.log(JSON.stringify(builds,null,2));
