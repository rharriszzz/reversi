#!/usr/bin/env node
// Supplementary read-only post-run qualification of the registered executable.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {NativeEngine} from '../../scripts/native/client.mjs';
import {positions} from '../../scripts/native-v2/positions.mjs';
import {solveExact} from '../../scripts/teacher/exact.mjs';
import {oracleChildren} from '../../tests/oracle.mjs';
import {measure,output,atomic} from '../../scripts/native-v2/common.mjs';
import {execFileSync} from 'node:child_process';
const reg=JSON.parse(readFileSync(resolve(output,'registration.json'))),engine=new NativeEngine({receipt:reg.receipt});
await measure('supplementary-deep-qualification',async()=>{
 const rows=[];try{
  await engine.ready();for(const id of ['v2-late-5','native-engineering-9']){
   const p=positions().find(p=>p.id===id),depth=64-p.occupied;
   const independent=solveExact(p.board,p.player,false,performance.now()+30000),utility=v=>v?Math.sign(v)*10000+v:0,searches=[];
   for(const model of ['B','L','P']){
    const r=await engine.search(p.board,p.player,{model,depth});assert.equal(r.score||0,utility(independent.value));assert.ok(r.exact);
    for(const row of independent.rows){const child=oracleChildren(p.board,p.player).find(c=>c.move===row.move);const s=await engine.search(child.board,-p.player,{model,depth:depth-1});assert.equal((-s.score)||0,utility(row.value));}
    searches.push({model,result:r});
   }
   rows.push({id,board:p.board,player:p.player,depth,independent,searches});console.log(JSON.stringify({position:id,depth,independentMs:independent.wallMs,alternatives:independent.rows.length,passed:true}));
  }
  // Directly inspect every entry after rollover, not only the resulting score.
  const cpp=`#include "engine.hpp"\n#include <cassert>\n#include <limits>\nnamespace reversi { struct EngineQualification { static void check(){ Engine e(1);e.generation=std::numeric_limits<uint32_t>::max();for(auto& x:e.table)x={1,2,-999999,1,-1,63,19,1,true};e.nextGeneration();assert(e.generation==1);for(const auto& x:e.table)assert(x.black==0&&x.white==0&&x.player==0&&x.generation==0&&x.flag==0); } }; }\nint main(){reversi::EngineQualification::check();}\n`;
  const path=resolve(output,'rollover-extra.cpp'),binary=resolve(output,'rollover-extra');writeFileSync(path,cpp);
  execFileSync(process.env.CXX??'c++',[...reg.receipt.flags,'-I','native','-I',resolve(output,'build-final'),'native/engine.cpp',path,'-o',binary]);execFileSync(binary);
  const report={registration:reg.checksum,stage:'supplementary post-run verification; engine unchanged',rows,rolloverAllEntriesCleared:true,passed:true};atomic(resolve(output,'deep-qualification.json'),report);writeFileSync('docs/data/native-v2-deep-qualification-20261030.json',JSON.stringify(report)+'\n');
 }finally{engine.close();}
});
