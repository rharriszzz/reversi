// Reproduce the selected candidate from the actual final worktree/build entry.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {build,sha} from '../native/build.mjs';
const out=resolve(process.env.REVERSI_DISPATCH_RUN),tag=process.env.FOLLOWUP_SELECTED??'B';
const dir=resolve(out,'final-source-rebuild');assert.ok(!existsSync(dir),'Fresh rebuild directory required');
const candidate=JSON.parse(readFileSync(resolve(out,tag,'build.json')));
const receipt=build({cpu:'dispatch',directory:dir});
for(const [file,digest] of Object.entries(candidate.sourceHashes))if(file!=='frozen.hpp')assert.equal(sha(readFileSync(resolve('native',file))),digest,file);
const common=[...receipt.flags,...receipt.baselineFlags,'-I',dir,'-I',resolve('native')],objects=[resolve(dir,'portable.o'),resolve(dir,'enhanced.o')];
const compiler=process.env.CXX??'g++-15';
const cc=args=>execFileSync(compiler,args,{stdio:['ignore','ignore','pipe']});
cc([...common,'-c','scripts/fast-flips/driver.cpp','-o',resolve(dir,'driver.o')]);
cc([...common,...objects,resolve(dir,'driver.o'),'-o',resolve(dir,'fixed-work')]);
for(const name of ['qualify','micro'])cc([...common,...objects,resolve(out,tag,name==='qualify'?'qualification.cpp':'micro.cpp'),'-o',resolve(dir,name)]);
const binaryHashes={};
for(const file of ['fixed-work','reversi-native','qualify','micro']) {
 binaryHashes[file]=sha(readFileSync(resolve(dir,file)));assert.equal(binaryHashes[file],candidate.binaryHashes[file],file);
}
const result={passed:true,selected:tag,binaryHashes,receipt,method:'Actual final worktree compiled through scripts/native/build.mjs, fresh objects; all four CLI/fixed/qualification/micro binary hashes identical to measured candidate.'};
writeFileSync(resolve(out,'source-rebuild.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:true,selected:tag,binaryHashes}));
