#!/usr/bin/env node
// Optional reproduction of all measured trials, including rejected kernels.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,copyFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {build,sha} from '../native/build.mjs';
import {NativeEngine} from '../native/client.mjs';
import {positions} from './positions.mjs';
import {output,measure,atomic} from './common.mjs';
import assert from 'node:assert/strict';
const current=build({directory:resolve(output,'build-final')}),receipts={final:current};
for(const tag of ['baseline','leaf','pattern','moves','flips']){
 const dir=resolve(output,`history-${tag}`);mkdirSync(dir,{recursive:true});
 for(const f of ['engine.cpp','engine.hpp','main.cpp'])writeFileSync(resolve(dir,f),execFileSync('git',['show',`b05e903:native/${f}`]));
 if(tag!=='baseline'){
  copyFileSync('native/engine.hpp',resolve(dir,'engine.hpp'));
  execFileSync('patch',['-s',resolve(dir,'engine.cpp'),resolve(`scripts/native-v2/variants/${tag}.patch`)]);
 }
 copyFileSync(resolve(output,'build-final/frozen.hpp'),resolve(dir,'frozen.hpp'));
 const executable=resolve(dir,'reversi-native');execFileSync(process.env.CXX??'c++',[...current.flags,'-I',dir,resolve(dir,'engine.cpp'),resolve(dir,'main.cpp'),'-o',executable]);
 receipts[tag]={...current,executable,executableSha256:sha(readFileSync(executable)),fingerprint:sha(readFileSync(resolve(dir,'engine.cpp')))};
}
await measure('production-history',async()=>{
 const engines=Object.fromEntries(Object.entries(receipts).map(([k,receipt])=>[k,new NativeEngine({receipt})])),rows=[];
 try{
  for(const e of Object.values(engines))await e.ready();
  for(let rep=0;rep<9;rep++)for(const model of ['B','P'])for(const p of positions()){
   const tags=Object.keys(engines);if(rep%2)tags.reverse();const depth=p.occupied<28?8:p.occupied<52?7:Math.min(10,64-p.occupied),results={};
   for(const tag of tags)results[tag]=await engines[tag].search(p.board,p.player,{model,depth,hints:false});
   for(const r of Object.values(results)){assert.equal(r.score,results.baseline.score);assert.equal(r.nodes,results.baseline.nodes);assert.equal(r.evaluations,results.baseline.evaluations);}
   rows.push({rep,model,position:p.id,occupied:p.occupied,depth,results});
  }
  atomic(resolve(output,'production-history.json'),{receipts,positions:positions(),rows});
  console.log(JSON.stringify({variants:Object.keys(receipts),comparisons:rows.length}));
 }finally{Object.values(engines).forEach(e=>e.close());}
});
