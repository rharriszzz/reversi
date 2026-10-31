// Matched ordinary Apple Clang builds. No dispatch, host tuning or enhanced TU.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {frozenHeader,sha} from '../native/build.mjs';
import {microSource} from '../runtime-cpu/support.mjs';
const out=resolve(process.env.REVERSI_DISPATCH_RUN??'.local-research/runtime-cpu-mac-20261031');
if(existsSync(resolve(out,'builds.json')))throw Error('Preserve completed builds; choose a fresh directory');
mkdirSync(out,{recursive:true});
const base='6b480ed1bc6ddcdde2fdb37872c0ca8d0a804425',cxx=process.env.CXX??'c++';
const flags=['-O3','-std=c++17','-Wall','-Wextra','-Wpedantic','-ffp-contract=off','-fno-fast-math'];
const compiler=execFileSync(cxx,['--version'],{encoding:'utf8'}),records={};
const cc=args=>execFileSync(cxx,[...flags,...args],{stdio:'inherit'});
// Same test-only analyze operation as the qualified runtime-cpu adapter.
const adapterText=String.raw`}else if(command=="analyze") {
    int depth;if(!(in>>depth))throw std::runtime_error("Missing depth");end(in);
    engine->configure(true,false);auto a=engine->analyze(b,player,depth,model);result(a.summary,model);
    std::cout<<",\"moves\":[";
    for(size_t i=0;i<a.moves.size();i++) {auto& row=a.moves[i];std::cout<<(i?",":"")<<"{\"move\":"<<row.result.move<<",\"score\":"<<row.result.score<<",\"exact\":"<<(row.result.exact?"true":"false")<<",\"pv\":[";for(size_t j=0;j<row.pv.size();j++)std::cout<<(j?",":"")<<row.pv[j];std::cout<<"]}";}std::cout<<"]";
  }else if(command=="windows")`;
for(const tag of ['original','selected']) {
 const dir=resolve(out,tag);mkdirSync(dir,{recursive:true});
 const files=['engine.hpp','engine.cpp','main.cpp',...(tag==='selected'?['engine-impl.inc','engine-tables.hpp']:[])];
 for(const f of files)writeFileSync(resolve(dir,f),tag==='original'?execFileSync('git',['show',`${base}:native/${f}`]):readFileSync(`native/${f}`));
 writeFileSync(resolve(dir,'frozen.hpp'),frozenHeader().header);
 cc(['-I',dir,'-c',resolve(dir,'engine.cpp'),'-o',resolve(dir,'engine.o')]);
 cc(['-I',dir,resolve(dir,'engine.o'),resolve(dir,'main.cpp'),'-o',resolve(dir,'engine')]);
 // Headers have different private layouts: compile driver against each header.
 cc(['-I',dir,'-c','scripts/fast-flips/driver.cpp','-o',resolve(dir,'driver.o')]);
 cc([resolve(dir,'engine.o'),resolve(dir,'driver.o'),'-o',resolve(dir,'fixed-work')]);
 const adapter=readFileSync(resolve(dir,'main.cpp'),'utf8').replace('}else if(command=="windows")',adapterText);
 if(!adapter.includes('a.moves.size()'))throw Error('Adapter insertion failed');
 writeFileSync(resolve(dir,'qualification.cpp'),adapter);
 cc(['-I',dir,resolve(dir,'engine.o'),resolve(dir,'qualification.cpp'),'-o',resolve(dir,'qualify')]);
 writeFileSync(resolve(dir,'micro.cpp'),microSource(false,tag));
 cc(['-I',dir,'-I','scripts/fast-flips',resolve(dir,'engine.o'),resolve(dir,'micro.cpp'),'-o',resolve(dir,'micro')]);
 const sourceHashes=Object.fromEntries(files.map(f=>[f,sha(readFileSync(resolve(dir,f)))]));
 const executable=resolve(dir,'qualify');
 const receipt={flags,compiler,sourceCommit:tag==='original'?base:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceHashes,modelHeaderSha256:sha(frozenHeader().header),models:{B:'original-production',L:frozenHeader().models.L.checksum,P:frozenHeader().models.P.checksum},executable,executableSha256:sha(readFileSync(executable)),fixedWorkSha256:sha(readFileSync(resolve(dir,'fixed-work'))),driverSha256:sha(readFileSync('scripts/fast-flips/driver.cpp'))};
 receipt.fingerprint=sha(JSON.stringify(receipt));records[tag]=receipt;
 writeFileSync(resolve(dir,'build.json'),JSON.stringify(receipt,null,2)+'\n');
}
writeFileSync(resolve(out,'builds.json'),JSON.stringify({base,flags,compiler,records},null,2)+'\n');
writeFileSync(resolve(out,'positions.json'),readFileSync('docs/data/fast-flips-mac/positions.json'));
console.log(JSON.stringify({out,models:records.selected.models,flags}));
