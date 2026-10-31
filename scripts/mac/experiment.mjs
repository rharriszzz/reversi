// Independent copied-source builds: no mutation of production or frozen data.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {build,sha} from '../native/build.mjs';
import {NativeEngine} from '../native/client.mjs';
import {positions} from '../native-v2/positions.mjs';
import {randomOpening,seededRandom} from '../../src/learning.js';
const out=resolve('.local-research/mac-modernization-20261030');
const referenceCommit='43e52d2235c17670f302ab822636f11660e4f8b7';
const original=Object.fromEntries(['cpp','hpp'].map(ext=>[ext,execFileSync('git',['show',`${referenceCommit}:native/engine.${ext}`],{encoding:'utf8'})]));
const marginScore='return margin==0?0:(margin>0?10000:-10000)+margin;';
const lastOne=`
  // Exact one-empty result: the sole legal placement (possibly after a pass)
  // determines the raw margin. Unplayed squares are never awarded.
  const Bits empty=~(b.black|b.white),rest=empty&(empty-1);
  if(depth>0&&!rest) {
    if(!empty)return terminal(b,p);
    const Bits own=p==1?b.black:b.white,opp=p==1?b.white:b.black;
    const int q=first(empty);int margin=pop(own)-pop(opp);
    const int ownFlips=pop(flips(own,opp,q));
    if(ownFlips)margin+=1+2*ownFlips;
    else {const int otherFlips=pop(flips(opp,own,q));if(otherFlips)margin-=1+2*otherFlips;}
    ${marginScore}
  }
`;
const lastTwo=`
  if(depth>=2&&rest&&!(rest&(rest-1))) {
    const Bits own=p==1?b.black:b.white,opp=p==1?b.white:b.black;
    const int squares[2]={first(empty),first(rest)};
    const Bits captures[2]={flips(own,opp,squares[0]),flips(own,opp,squares[1])};
    Bits moves=0;for(int i=0;i<2;i++)if(captures[i])moves|=Bits(1)<<squares[i];
    if(!moves) {
      if(!flips(opp,own,squares[0])&&!flips(opp,own,squares[1]))return terminal(b,p);
      return -negamax(b,-p,depth,-beta,-alpha);
    }
    std::array<int,64> choices;const int n=ordered(b,moves,-1,choices);double best=-INF;
    for(int i=0;i<n;i++) {
      const int q=choices[i];const Bits f=captures[q==squares[0]?0:1],m=Bits(1)<<q;
      const Board child=p==1?Board{b.black|f|m,b.white&~f}:Board{b.black&~f,b.white|f|m};
      best=std::max(best,-negamax(child,-p,depth-1,-beta,-alpha));alpha=std::max(alpha,best);
      if(alpha>=beta){stats.cutoffs++;if(i==0)stats.firstMoveCutoffs++;break;}
    }
    return best;
  }
`;
function tiny(source,two){return source.replace('  stats.nodes++;\n','  stats.nodes++;\n'+lastOne+(two?lastTwo:''));}
function compact({cpp,hpp}) {
 hpp=hpp.replace('uint8_t flag=0; bool solved=false;','uint8_t metadata=0;\n  uint8_t bound() const {return metadata&3;}\n  bool solved() const {return metadata&4;}');
 hpp=hpp.replace('struct Profile {','static_assert(sizeof(Entry)==32,"Compact TT must occupy exactly 32 bytes");\nstruct Profile {');
 cpp=cpp.replace('mib*1024*1024/sizeof(Entry)','mib*1024*1024/40');
 cpp=cpp.replace('table.resize(count);','table.resize(mib?count*40/sizeof(Entry):1);');
 cpp=cpp.replace('return (mix(b.black)^mix(b.white+0x9e3779b97f4a7c15ULL)^Bits(p==1?0:0xa0761d6478bd642fULL))&(table.size()-1);','const auto hash=mix(b.black)^mix(b.white+0x9e3779b97f4a7c15ULL)^Bits(p==1?0:0xa0761d6478bd642fULL);return (uint64_t(uint32_t(hash))*table.size())>>32;');
 cpp=cpp.replaceAll('e.solved','e.solved()').replaceAll('e.flag==','e.bound()==');
 cpp=cpp.replace('int8_t(bestMove),flag,stats.horizonHits==horizon','int8_t(bestMove),uint8_t(flag|(stats.horizonHits==horizon?4:0))');
 return {cpp,hpp};
}
const variants={baseline:original,last1:{...original,cpp:tiny(original.cpp,false)},last2:{...original,cpp:tiny(original.cpp,true)},compact:compact(original),combined:compact({...original,cpp:tiny(original.cpp,true)})};
const baseReceipt=build(),receipts={};mkdirSync(resolve('scripts/mac/variants'),{recursive:true});
for(const [name,source] of Object.entries(variants)) {
 const dir=resolve(out,`variant-${name}`);mkdirSync(dir,{recursive:true});
 writeFileSync(resolve(dir,'engine.cpp'),source.cpp);writeFileSync(resolve(dir,'engine.hpp'),source.hpp);
 for(const file of ['main.cpp'])writeFileSync(resolve(dir,file),execFileSync('git',['show',`${referenceCommit}:native/${file}`]));
 writeFileSync(resolve(dir,'frozen.hpp'),readFileSync(resolve(baseReceipt.executable,'../frozen.hpp')));
 const executable=resolve(dir,'reversi-native');execFileSync('c++',[...baseReceipt.flags,'-I',dir,resolve(dir,'engine.cpp'),resolve(dir,'main.cpp'),'-o',executable]);
 const sourceHashes=Object.fromEntries(['engine.cpp','engine.hpp','main.cpp'].map(f=>[`native/${f}`,sha(readFileSync(resolve(dir,f)))]));
 receipts[name]={...baseReceipt,executable,executableSha256:sha(readFileSync(executable)),sourceHashes,fingerprint:sha(JSON.stringify({sourceHashes,flags:baseReceipt.flags,compiler:baseReceipt.compiler,header:baseReceipt.modelHeaderSha256}))};
 writeFileSync(resolve(dir,'build.json'),JSON.stringify(receipts[name],null,2)+'\n');
 if(name!=='baseline') {
  let patch='';for(const ext of ['cpp','hpp'])patch+=spawnSync('diff',['-u','--label',`a/native/engine.${ext}`,'--label',`b/native/engine.${ext}`,resolve(out,`variant-baseline/engine.${ext}`),resolve(dir,`engine.${ext}`)],{encoding:'utf8'}).stdout;
  writeFileSync(`scripts/mac/variants/${name}.patch`,patch);
 }
}
const panel=[...positions(),...Array.from({length:12},(_,i)=>{const p=randomOpening(seededRandom(0x4d344500+i),48+i%5);return {...p,board:[...p.board],id:`mac-exact-${i}`,occupied:p.board.filter(Boolean).length,exactRoot:true,seed:0x4d344500+i};})];
const engines=Object.fromEntries(Object.keys(variants).map(k=>[k,new NativeEngine({receipt:receipts[k]})])),rows=[];
try {
 for(const e of Object.values(engines))await e.ready();
 const depth=p=>p.exactRoot?64-p.occupied:p.occupied<28?8:p.occupied<52?7:Math.max(1,Math.min(10,64-p.occupied));
 // Complete warmup, then serial rotated/reversed same-position trials.
 for(const model of ['B','P'])for(const p of panel)for(const e of Object.values(engines))await e.search(p.board,p.player,{model,depth:depth(p),hints:false});
 for(let rep=0;rep<9;rep++) {
  const tags=Object.keys(engines),order=tags.slice(rep%tags.length).concat(tags.slice(0,rep%tags.length));if(rep%2)order.reverse();
  for(const model of rep%2?['P','B']:['B','P'])for(const p of panel) {
   const results={};for(const tag of order)results[tag]=await engines[tag].search(p.board,p.player,{model,depth:depth(p),hints:false});
   for(const [tag,r] of Object.entries(results)){assert.equal(r.score,results.baseline.score,`${tag} ${p.id}`);assert.equal(r.tableBytes,results.baseline.tableBytes);}
   rows.push({rep,model,position:p.id,depth:depth(p),order,results});
  }
  writeFileSync(resolve(out,'experiments.json'),JSON.stringify({referenceCommit,receipts,positions:panel,rows}));console.log(JSON.stringify({repComplete:rep+1}));
 }
 const median=a=>a.sort((a,b)=>a-b)[a.length>>1],summary=[];
 for(const scope of ['all','exact'])for(const model of ['B','P'])for(const tag of Object.keys(engines)) {
  const selected=new Set(panel.filter(p=>scope==='all'||p.exactRoot).map(p=>p.id));
  const batches=Array.from({length:9},(_,rep)=>rows.filter(r=>r.rep===rep&&r.model===model&&selected.has(r.position)).reduce((a,r)=>a+r.results[tag].elapsedMs,0));
  summary.push({scope,model,tag,medianMs:median([...batches]),batches});
 }
 writeFileSync(resolve(out,'experiment-summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
}finally{Object.values(engines).forEach(e=>e.close());}
