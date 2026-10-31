import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {frozenHeader,sha} from '../native/build.mjs';
export const baseline='1058f013581e0566277586f857b0a2884be260f6';
export const out=resolve(process.env.REVERSI_FLIP_RUN??'.local-research/fast-flips-m4-20261031');
export const tags=['original','masked-loop','unrolled','doubling','ray-table','late-ray'];
export const flags=['-O3','-std=c++17','-Wall','-Wextra','-Wpedantic','-ffp-contract=off','-fno-fast-math','-g',...(process.env.FLIP_NATIVE?[(process.arch==='arm64'?'-mcpu=native':'-march=native')]:[])];
const cxx=process.env.CXX??'c++';
const compile=args=>execFileSync(cxx,[...flags,...args],{stdio:'inherit'});
mkdirSync(out,{recursive:true});
if(existsSync(resolve(out,'micro.json'))||existsSync(resolve(out,'integrated.json')))throw Error('Preserve measured builds: choose a fresh REVERSI_FLIP_RUN');
const header=frozenHeader().header;
const original=execFileSync('git',['show',`${baseline}:native/engine.cpp`],{encoding:'utf8'});
const workload=JSON.parse(readFileSync('docs/data/mac-optimization-experiments-20261030.json')).repeated.positions;
writeFileSync(resolve(out,'positions.json'),JSON.stringify(workload)+'\n');
const manifest={baseline,experimentCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),compiler:execFileSync(cxx,['--version'],{encoding:'utf8'}).trim(),flags,platform:process.platform,arch:process.arch,modelHeaderSha256:sha(header),workloadSha256:sha(readFileSync(resolve(out,'positions.json'))),harnessHashes:Object.fromEntries(['build.mjs','candidates.hpp','kernels.cpp','micro.cpp'].map(f=>[f,sha(readFileSync(`scripts/fast-flips/${f}`))])),builds:{}};
compile(['-I',resolve('native'),'-c','scripts/fast-flips/driver.cpp','-o',resolve(out,'driver.o')]);
for(let id=0;id<tags.length;id++) {
  const tag=tags[id],dir=resolve(out,tag);mkdirSync(dir,{recursive:true});
  let source=original;
  if(id&&id<5)source=source.slice(0,source.indexOf('template<int D> inline Bits flipsIn'))+
    `Bits flips(Bits own,Bits opp,int q) { SPAN(Flips);return flip_experiment::calculate<${id}>(own,opp,q); }\n`+
    source.slice(source.indexOf('Board play('));
  if(id===5) {
    const start=source.indexOf('[[gnu::noinline]] double Engine::lastEmpties'),end=source.indexOf('double Engine::negamax',start);
    source=source.slice(0,start)+'[[gnu::noinline]] Bits lateFlips(Bits own,Bits opp,int q){return flip_experiment::calculate<4>(own,opp,q);}\n'+source.slice(start,end).replaceAll('flips(', 'lateFlips(')+source.slice(end);
  }
  if(id)source='#include "candidates.hpp"\n'+source;
  for(const file of ['engine.hpp','main.cpp'])writeFileSync(resolve(dir,file),execFileSync('git',['show',`${baseline}:native/${file}`]));
  writeFileSync(resolve(dir,'engine.cpp'),source);writeFileSync(resolve(dir,'frozen.hpp'),header);
  writeFileSync(resolve(dir,'candidates.hpp'),readFileSync('scripts/fast-flips/candidates.hpp'));
  compile(['-I',dir,'-c',resolve(dir,'engine.cpp'),'-o',resolve(dir,'engine.o')]);
  const executable=resolve(dir,'engine');compile(['-I',dir,resolve(dir,'engine.o'),resolve(dir,'main.cpp'),'-o',executable]);
  compile([resolve(dir,'engine.o'),resolve(out,'driver.o'),'-o',resolve(dir,'fixed-work')]);
  // Dedicated inspection adapter exposes full coaching/PVs to independent JS.
  let adapter=readFileSync(resolve(dir,'main.cpp'),'utf8');
  adapter=adapter.replace('}else if(command=="windows")',`}else if(command=="analyze") {
    int depth;if(!(in>>depth))throw std::runtime_error("Missing depth");end(in);
    engine->configure(true,false);auto a=engine->analyze(b,player,depth,model);result(a.summary,model);
    std::cout<<",\\\"moves\\\":[";
    for(size_t i=0;i<a.moves.size();i++) {auto& row=a.moves[i];std::cout<<(i?",":"")<<"{\\\"move\\\":"<<row.result.move<<",\\\"score\\\":"<<row.result.score<<",\\\"exact\\\":"<<(row.result.exact?"true":"false")<<",\\\"pv\\\":[";for(size_t j=0;j<row.pv.size();j++)std::cout<<(j?",":"")<<row.pv[j];std::cout<<"]}";}std::cout<<"]";
  }else if(command=="windows")`);
  writeFileSync(resolve(dir,'qualification.cpp'),adapter);
  compile(['-I',dir,resolve(dir,'engine.o'),resolve(dir,'qualification.cpp'),'-o',resolve(dir,'qualify')]);
  const sourceHashes=Object.fromEntries(['engine.cpp','engine.hpp','main.cpp','candidates.hpp'].map(f=>[f,sha(readFileSync(resolve(dir,f)))]));
  const receipt={...manifest,builds:undefined,algorithm:tag,sourceHashes,executable,executableSha256:sha(readFileSync(executable)),models:{B:'original-production',...Object.fromEntries(['L','P'].map(k=>[k,frozenHeader().models[k].checksum]))}};
  receipt.fingerprint=sha(JSON.stringify(receipt));manifest.builds[tag]=receipt;
  writeFileSync(resolve(dir,'build.json'),JSON.stringify(receipt,null,2)+'\n');
  if(process.platform==='darwin') {
    execFileSync('dsymutil',[resolve(dir,'fixed-work')]);
    writeFileSync(resolve(dir,'assembly.txt'),execFileSync('otool',['-tvV',executable]));
    // Same production options; -g must not alter emitted instructions.
    execFileSync(cxx,[...flags.filter(f=>f!=='-g'),'-I',dir,'-c',resolve(dir,'engine.cpp'),'-o',resolve(dir,'plain.o')]);
    const text=p=>execFileSync('otool',['-s','__TEXT','__text',p],{encoding:'utf8'}).split('\n').slice(2).join('\n');
    if(text(resolve(dir,'plain.o'))!==text(resolve(dir,'engine.o')))throw Error('Debug text mismatch');
  }else writeFileSync(resolve(dir,'assembly.txt'),execFileSync('objdump',['-Cd',executable]));
}
compile(['-I',resolve(out,'original'),'-c','scripts/fast-flips/kernels.cpp','-o',resolve(out,'kernels.o')]);
// selected-build.mjs links the microbenchmark against the actual checked-out
// candidate. Its sixth kernel must never accidentally alias the baseline.
writeFileSync(resolve(out,'builds.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({out,baseline,workloadSha256:manifest.workloadSha256,algorithms:tags}));
