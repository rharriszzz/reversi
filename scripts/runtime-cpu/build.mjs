// Reconstruct matched production references; never modify distributed Wasm.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {build,frozenHeader,sha} from '../native/build.mjs';
import {microSource} from './support.mjs';
const out=resolve(process.env.REVERSI_DISPATCH_RUN??'.local-research/runtime-cpu-20261031');
if(existsSync(resolve(out,'benchmarks.json')))throw Error('Choose a fresh immutable run directory');
mkdirSync(out,{recursive:true});
const cxx=process.env.CXX??'g++',base='e7b79b9510278b815606c47b667ddeff396e289b';
const flags=['-O3','-std=c++17','-Wall','-Wextra','-Wpedantic','-ffp-contract=off','-fno-fast-math'];
const cc=args=>execFileSync(cxx,args,{stdio:['ignore','ignore','pipe']});
const ds=build({cpu:'dispatch',directory:resolve(out,'dispatch')});
const source=execFileSync('git',['show',`${base}:native/engine.cpp`]);
const records={};
for(const [tag,target] of [['A',[]],['D',['-march=native']],['E',['-mpopcnt']]]) {
 const dir=resolve(out,tag);mkdirSync(dir,{recursive:true});
 for(const f of ['engine.hpp','main.cpp'])writeFileSync(resolve(dir,f),execFileSync('git',['show',`${base}:native/${f}`]));
 writeFileSync(resolve(dir,'engine.cpp'),source);writeFileSync(resolve(dir,'frozen.hpp'),frozenHeader().header);
 cc([...flags,...target,'-I',dir,'-c',resolve(dir,'engine.cpp'),'-o',resolve(dir,'engine.o')]);
 records[tag]={dir,flags:[...flags,...target],objects:[resolve(dir,'engine.o')],header:dir,sourceSha256:sha(source)};
}
for(const tag of ['B','C'])records[tag]={dir:resolve(out,tag),flags:[...ds.flags,...ds.baselineFlags],objects:[resolve(out,'dispatch/portable.o'),resolve(out,'dispatch/enhanced.o')],header:resolve('native'),receipt:ds};
for(const [tag,r] of Object.entries(records)) {
 mkdirSync(r.dir,{recursive:true});
 const includes=['-I',r.header,'-I',resolve(out,'dispatch')];
 cc([...flags,...includes,'-c','scripts/fast-flips/driver.cpp','-o',resolve(r.dir,'driver.o')]);
 cc([...flags,...r.objects,resolve(r.dir,'driver.o'),`-Wl,-Map=${resolve(r.dir,'link.map')}`,'-o',resolve(r.dir,'fixed-work')]);
 let adapter=readFileSync(tag==='B'||tag==='C'?'native/main.cpp':resolve(r.dir,'main.cpp'),'utf8');
 const from='}else if(command=="windows")';
 adapter=adapter.replace(from,`}else if(command=="analyze") {
    int depth;if(!(in>>depth))throw std::runtime_error("Missing depth");end(in);
    engine->configure(true,false);auto a=engine->analyze(b,player,depth,model);result(a.summary,model);
    std::cout<<",\\\"moves\\\":[";
    for(size_t i=0;i<a.moves.size();i++) {auto& row=a.moves[i];std::cout<<(i?",":"")<<"{\\\"move\\\":"<<row.result.move<<",\\\"score\\\":"<<row.result.score<<",\\\"exact\\\":"<<(row.result.exact?"true":"false")<<",\\\"pv\\\":[";for(size_t j=0;j<row.pv.size();j++)std::cout<<(j?",":"")<<row.pv[j];std::cout<<"]}";}std::cout<<"]";
  }else if(command=="windows")`);
 if(!adapter.includes('Could not')&&!adapter.includes('a.moves.size()'))throw Error('Adapter insertion failed');
 writeFileSync(resolve(r.dir,'qualification.cpp'),adapter);
 cc([...flags,...includes,...r.objects,resolve(r.dir,'qualification.cpp'),'-o',resolve(r.dir,'qualify')]);
 const models=ds.models,executable=resolve(r.dir,'qualify');
 const receipt={...r,executable,models,executableSha256:sha(readFileSync(executable)),fixedWorkSha256:sha(readFileSync(resolve(r.dir,'fixed-work')))};
 receipt.fingerprint=sha(JSON.stringify(receipt));
 writeFileSync(resolve(r.dir,'build.json'),JSON.stringify(receipt,null,2)+'\n');
 records[tag]=receipt;
 // Reuse the exact qualified corpus generator/reference, timing only this kernel.
 const micro=microSource(tag==='C',tag);
 writeFileSync(resolve(r.dir,'micro.cpp'),micro);
 cc([...flags,...includes,...r.objects,resolve(r.dir,'micro.cpp'),'-o',resolve(r.dir,'micro')]);
 records[tag].microSha256=sha(readFileSync(resolve(r.dir,'micro')));
}
writeFileSync(resolve(out,'builds.json'),JSON.stringify({base,compiler:execFileSync(cxx,['--version'],{encoding:'utf8'}),records,sourceHashes:Object.fromEntries(['native/engine.cpp','native/engine.hpp','native/engine-impl.inc','native/engine-tables.hpp','native/engine-enhanced.cpp','scripts/native/build.mjs','scripts/runtime-cpu/build.mjs'].map(p=>[p,sha(readFileSync(p))]))},null,2)+'\n');
writeFileSync(resolve(out,'positions.json'),readFileSync('docs/data/fast-flips-mac/positions.json'));
console.log(JSON.stringify({out,tags:Object.keys(records)}));
