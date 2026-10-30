// Bounded factorial experiment; rebuilds immutable baseline 2492932 in ignored dirs.
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {build,sha} from '../native/build.mjs';
import {NativeEngine} from '../native/client.mjs';
import {positions} from '../native-v2/positions.mjs';
const out=resolve('.local-research/wasm-20261030'),base=execFileSync('git',['show','2492932:native/engine.cpp'],{encoding:'utf8'});
const tt=s=>s.replace('slot=index(b,p);const auto& e=table[slot];',`slot=index(b,p);if(table.size()>1) {
      slot&=~size_t(1);
      if(same(table[slot+1],b,p))slot++;
      else if(!same(table[slot],b,p)&&table[slot].player) {
        const auto& a=table[slot];const auto& z=table[slot+1];
        if(!z.player||(z.generation!=generation&&a.generation==generation)||
          ((z.generation==generation)==(a.generation==generation)&&z.depth<a.depth))slot++;
      }
    }const auto& e=table[slot];`).replace('SPAN(TT);auto& e=table[slot];',`SPAN(TT);if(table.size()>1) {
      slot=index(b,p)&~size_t(1);
      if(same(table[slot+1],b,p))slot++;
      else if(!same(table[slot],b,p)) {
        const auto& a=table[slot];const auto& z=table[slot+1];
        if(!z.player||(z.generation!=generation&&a.generation==generation)||
          ((z.generation==generation)==(a.generation==generation)&&z.depth<a.depth))slot++;
      }
    }auto& e=table[slot];`);
// Own mobility is already reused at ordinary leaves. The remaining opportunity
// is a forced pass: carry the legal mask and known zero opponent mask forward.
const mobility=s=>s.replace('std::array<double,7> features(Board b,int p,Bits ownMoves) {','static std::array<double,7> featuresKnown(Board b,int p,Bits ownMoves,Bits opponentMoves) {').replace('pop(legal(opp,own)),2)','pop(opponentMoves),2)').replace('// Small geometry-only',`std::array<double,7> features(Board b,int p,Bits ownMoves) {
 return featuresKnown(b,p,ownMoves,legal(p==1?b.white:b.black,p==1?b.black:b.white));
}
// Small geometry-only`).replace('if(!legal(opp,own))return terminal(b,p);\n    return -negamax(b,-p,depth,-beta,-alpha);',`Bits otherMoves=legal(opp,own);
    if(!otherMoves)return terminal(b,p);
    if(depth<=0) {
      // Account for the pass node exactly as the recursive reference does.
      if((timed&&((stats.nodes&63)==0)&&Clock::now()>=deadline)||(stopNodes&&stats.nodes>=stopNodes))throw Timeout{};
      stats.nodes++;stats.evaluations++;stats.horizonHits++;
      auto f=featuresKnown(b,-p,otherMoves,0);int occupied=pop(b.black|b.white),phase=occupied<28?0:occupied<52?1:2;
      double score=0;for(int j=0;j<7;j++)score+=frozen::weights[model][phase][j]*f[j];
      return -(model==2?score-p*patterns(b,phase):score);
    }
    return -negamax(b,-p,depth,-beta,-alpha);`);
const receipt=build(),receipts={},engines={};
for(const tag of ['baseline','tt','mobility','both']) {
 const dir=resolve(out,`experiment-${tag}`);mkdirSync(dir,{recursive:true});
 let source=base;if(tag==='tt'||tag==='both')source=tt(source);if(tag==='mobility'||tag==='both')source=mobility(source);
 writeFileSync(resolve(dir,'engine.cpp'),source);
 for(const f of ['engine.hpp','main.cpp'])writeFileSync(resolve(dir,f),execFileSync('git',['show',`2492932:native/${f}`]));
 writeFileSync(resolve(dir,'frozen.hpp'),readFileSync(resolve(receipt.executable,'../frozen.hpp')));
 const executable=resolve(dir,'reversi-native');execFileSync('c++',[...receipt.flags,'-I',dir,resolve(dir,'engine.cpp'),resolve(dir,'main.cpp'),'-o',executable]);
 const sourceHashes=Object.fromEntries(['engine.cpp','engine.hpp','main.cpp'].map(f=>[`native/${f}`,sha(readFileSync(resolve(dir,f)))]));
 receipts[tag]={...receipt,sourceHashes,executable,executableSha256:sha(readFileSync(executable)),sourceSha256:sha(source),fingerprint:sha(JSON.stringify({sourceHashes,flags:receipt.flags,compiler:receipt.compiler,header:receipt.modelHeaderSha256}))};
 engines[tag]=new NativeEngine({receipt:receipts[tag]});await engines[tag].ready();
 if(tag!=='baseline')writeFileSync(`scripts/native-final/variants/${tag}.patch`,spawnSync('diff',['-u','--label','a/native/engine.cpp','--label','b/native/engine.cpp',resolve(out,'experiment-baseline/engine.cpp'),resolve(dir,'engine.cpp')],{encoding:'utf8'}).stdout);
}
const rows=[];
try {
 for(let rep=0;rep<9;rep++)for(const model of ['B','P'])for(const p of positions()) {
  const tags=Object.keys(engines);if(rep%2)tags.reverse();
  const depth=p.occupied<28?8:p.occupied<52?7:Math.max(1,Math.min(10,64-p.occupied)),results={};
  for(const tag of tags)results[tag]=await engines[tag].search(p.board,p.player,{model,depth,hints:false});
  for(const r of Object.values(results)){assert.equal(r.score,results.baseline.score);assert.equal(r.tableBytes,results.baseline.tableBytes);}
  for(const tag of ['mobility'])assert.equal(results[tag].nodes,results.baseline.nodes);
  rows.push({rep,model,position:p.id,occupied:p.occupied,depth,results});
 }
 writeFileSync(resolve(out,'native-experiment.json'),JSON.stringify({receipts,positions:positions(),rows}));
 const median=a=>a.sort((a,b)=>a-b)[a.length>>1];
 for(const model of ['B','P'])for(const tag of Object.keys(engines)) {
  const batches=Array.from({length:9},(_,rep)=>rows.filter(r=>r.rep===rep&&r.model===model).reduce((a,r)=>a+r.results[tag].elapsedMs,0));
  console.log(JSON.stringify({model,tag,medianMs:median(batches),batches}));
 }
}finally{Object.values(engines).forEach(e=>e.close());}
