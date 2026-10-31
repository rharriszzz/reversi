// Isolated 2x2 experiment. Historical harnesses and measurements stay unchanged.
import {readFileSync,writeFileSync,mkdirSync,existsSync,symlinkSync,copyFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {frozenHeader,sha} from '../native/build.mjs';
import {microSource} from '../runtime-cpu/support.mjs';
const out=resolve(process.env.REVERSI_DISPATCH_RUN);
if(existsSync(out))throw Error('Choose a new immutable directory');
mkdirSync(out,{recursive:true});
const cxx=process.env.CXX??'g++-15',base='a77712eb89e3a822d77048694227f39be5d62337',probe='a3165e01a6f4e240a7f4c2e77774bd5dc8f8a7bd';
const flags=['-O3','-std=c++17','-Wall','-Wextra','-Wpedantic','-ffp-contract=off','-fno-fast-math'];
const baseline=['-march=x86-64','-mtune=generic','-DREVERSI_CPU_DISPATCH'];
const extensions=['-mpopcnt','-mbmi','-mbmi2','-mlzcnt'];
const files=['engine.hpp','engine.cpp','engine-impl.inc','engine-tables.hpp','engine-enhanced.cpp','main.cpp'];
const compiler=execFileSync(cxx,['--version'],{encoding:'utf8'}),frozen=frozenHeader(),records={};
const cc=args=>execFileSync(cxx,args,{stdio:['ignore','ignore','pipe']});
for(const [tag,revision,tune] of [['A',base,'generic'],['B',probe,'generic'],['C',base,'alderlake'],['D',probe,'alderlake'],['N','e7b79b9510278b815606c47b667ddeff396e289b','native']]) {
 const dir=resolve(out,tag);mkdirSync(dir);const sourceHashes={};
 for(const file of tune==='native'?['engine.hpp','engine.cpp','main.cpp']:files){const data=execFileSync('git',['show',`${revision}:native/${file}`]);writeFileSync(resolve(dir,file),data);sourceHashes[file]=sha(data);}
 writeFileSync(resolve(dir,'frozen.hpp'),frozen.header);sourceHashes['frozen.hpp']=sha(frozen.header);
 const enhanced=tune==='native'?['-march=native']:['-march=x86-64',`-mtune=${tune}`,'-DREVERSI_CPU_DISPATCH',...extensions];
 const ordinary=tune==='native'?['-march=native']:baseline;
 const units={};const objects=[];
 for(const [name,options] of tune==='native'?[['engine',ordinary]]:[['engine',ordinary],['engine-enhanced',enhanced]]) {
  const object=resolve(dir,name+'.o');cc([...flags,...options,'-I',dir,'-c',resolve(dir,name+'.cpp'),'-o',object]);objects.push(object);units[name]=[...flags,...options];
 }
 const common=[...flags,...ordinary,'-I',dir];
 cc([...common,'-c','scripts/fast-flips/driver.cpp','-o',resolve(dir,'driver.o')]);
 cc([...common,...objects,resolve(dir,'driver.o'),`-Wl,-Map=${resolve(dir,'link.map')}`,'-o',resolve(dir,'fixed-work')]);
 cc([...common,...objects,resolve(dir,'main.cpp'),'-o',resolve(dir,'reversi-native')]);
 let adapter=readFileSync(resolve(dir,'main.cpp'),'utf8');
 adapter=adapter.replace('}else if(command=="windows")',`}else if(command=="analyze") {
    int depth;if(!(in>>depth))throw std::runtime_error("Missing depth");end(in);
    engine->configure(true,false);auto a=engine->analyze(b,player,depth,model);result(a.summary,model);
    std::cout<<",\\\"moves\\\":[";
    for(size_t i=0;i<a.moves.size();i++) {auto& row=a.moves[i];std::cout<<(i?",":"")<<"{\\\"move\\\":"<<row.result.move<<",\\\"score\\\":"<<row.result.score<<",\\\"exact\\\":"<<(row.result.exact?"true":"false")<<",\\\"pv\\\":[";for(size_t j=0;j<row.pv.size();j++)std::cout<<(j?",":"")<<row.pv[j];std::cout<<"]}";}std::cout<<"]";
  }else if(command=="windows")`);
 if(!adapter.includes('a.moves.size()'))throw Error('Adapter insertion failed');
 writeFileSync(resolve(dir,'qualification.cpp'),adapter);
 cc([...common,...objects,resolve(dir,'qualification.cpp'),'-o',resolve(dir,'qualify')]);
 const micro=microSource(tune!=='native',tag);writeFileSync(resolve(dir,'micro.cpp'),micro);
 cc([...common,...objects,resolve(dir,'micro.cpp'),'-o',resolve(dir,'micro')]);
 if(tune!=='native') {
  writeFileSync(resolve(dir,'micro-portable.cpp'),microSource(false,tag+'P'));
  cc([...common,...objects,resolve(dir,'micro-portable.cpp'),'-o',resolve(dir,'micro-portable')]);
  cc([...common,...objects,'tests/runtime-cpu-state.cpp','-o',resolve(dir,'state')]);
 }
 const receipt={revision,tune,compiler,sourceHashes,units,driverFlags:[...flags,...ordinary],executable:resolve(dir,'qualify'),models:{B:'original-production',L:frozen.models.L.checksum,P:frozen.models.P.checksum},isa:tune==='native'?'Host-only full -march=native reference':{baseline:'x86-64',enhanced:['POPCNT','BMI1','BMI2','LZCNT']},backend:'auto',binaryHashes:Object.fromEntries(['fixed-work','qualify','micro','reversi-native',...(tune==='native'?[]:['micro-portable','state'])].map(f=>[f,sha(readFileSync(resolve(dir,f)))])),testResults:{status:'pending'}};
 receipt.executableSha256=receipt.binaryHashes.qualify;receipt.fixedWorkSha256=receipt.binaryHashes['fixed-work'];
 receipt.fingerprint=sha(JSON.stringify(receipt));records[tag]=receipt;
 writeFileSync(resolve(dir,'build.json'),JSON.stringify(receipt,null,2)+'\n');
 if(tune!=='native') {
  const fallback=resolve(out,tag+'P');mkdirSync(fallback);
  for(const name of ['fixed-work','qualify','reversi-native'])symlinkSync(resolve(dir,name),resolve(fallback,name));
  symlinkSync(resolve(dir,'micro-portable'),resolve(fallback,'micro'));
  const r={...receipt,backend:'portable',executable:resolve(fallback,'qualify'),binaryHashes:{...receipt.binaryHashes,micro:receipt.binaryHashes['micro-portable']}};records[tag+'P']=r;
  writeFileSync(resolve(fallback,'build.json'),JSON.stringify(r,null,2)+'\n');
 }
 console.log('Built '+tag);
}
symlinkSync(resolve(out,'D'),resolve(out,'dispatch'));
copyFileSync('docs/data/fast-flips-mac/positions.json',resolve(out,'positions.json'));
writeFileSync(resolve(out,'builds.json'),JSON.stringify({base,probe,compiler,records,harnessHashes:Object.fromEntries(['scripts/runtime-cpu-followup/build.mjs','scripts/runtime-cpu/support.mjs','scripts/fast-flips/driver.cpp','scripts/fast-flips/micro.cpp'].map(p=>[p,sha(readFileSync(p))]))},null,2)+'\n');
for(const tune of ['generic','alderlake'])for(const kind of ['optimizers','target'])writeFileSync(resolve(out,`${tune}-${kind}.txt`),execFileSync(cxx,[...flags,'-march=x86-64',`-mtune=${tune}`,...extensions,'-Q',`--help=${kind}`,'-x','c++','-c','/dev/null','-o','/dev/null']));
