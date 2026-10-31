// Candidate-specific sanitizer and independent minimax checks, outside timing.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {sha} from '../native/build.mjs';
import {NativeEngine,decodeBoard} from '../native/client.mjs';
import {oracleScore,oracleChildren} from '../../tests/oracle.mjs';
import {compile} from '../next-residual/model.mjs';
import {frozenModels} from '../frozen-player/models.mjs';
import {randomOpening,seededRandom} from '../../src/learning.js';
const out=resolve('.local-research/mac-modernization-20261030'),experiment=JSON.parse(readFileSync(resolve(out,'experiments.json')));
const evaluators=Object.fromEntries(Object.entries(frozenModels()).map(([m,v])=>[m,compile(v).evaluate]));
const rng=seededRandom(0x4d345154),boards=[];
for(let q=0;q<64;q++)for(let count=1;count<=2;count++) {
 const board=Array.from({length:64},()=>rng()<.5?1:-1);board[q]=0;
 if(count===2)board[(q+1+Math.floor(rng()*63))%64]=0;
 boards.push(board);
}
for(let seed=0;seed<24;seed++)boards.push([...randomOpening(seededRandom(0x4d345500+seed),54+seed%6).board]);
boards.push(...experiment.positions.filter(p=>['forced-pass','terminal-empties'].includes(p.id)).map(p=>p.board));
const rows=[];
for(const [tag,production] of Object.entries(experiment.receipts)) {
 const dir=resolve(production.executable,'..'),flags=[...production.flags,'-O1','-g','-fsanitize=address,undefined','-fno-omit-frame-pointer'];
 const executable=resolve(dir,'reversi-sanitize');
 execFileSync('c++',[...flags,'-I',dir,resolve(dir,'engine.cpp'),resolve(dir,'main.cpp'),'-o',executable]);
 const receipt={...production,executable,flags,executableSha256:sha(readFileSync(executable))};
 let internals=readFileSync('tests/native-internals.cpp','utf8');
 if(tag==='compact'||tag==='combined')internals=internals.replace('slot.flag==0','slot.metadata==0').replace('999999,1,1,64,0,1,true','999999,1,1,64,0,5');
 writeFileSync(resolve(dir,'internals.cpp'),internals);
 execFileSync('c++',[...flags,'-I',dir,resolve(dir,'engine.cpp'),resolve(dir,'internals.cpp'),'-o',resolve(dir,'internals-sanitize')]);
 execFileSync(resolve(dir,'internals-sanitize'),[],{timeout:30000});
 let queries=0,alternatives=0,children=0;
 for(const ttMiB of [0,16]) {
  const engine=new NativeEngine({receipt,ttMiB});
  try {
   await engine.ready();
   for(const board of boards)for(const player of [1,-1])for(const model of ['B','L','P']) {
    const reference=oracleChildren(board,player),inspection=await engine.inspect(board,player,model);
    assert.deepEqual(inspection.children.map(c=>({move:c.move,board:decodeBoard(c)})),reference);children+=reference.length;
    assert.equal(inspection.evaluation,evaluators[model](board,player));
    for(const depth of [1,2,64]) {
     const result=await engine.search(board,player,{model,depth});const expected=oracleScore(board,player,depth,evaluators[model]);
     assert.equal(result.score||0,expected||0,`${tag} ${model} D${depth}`);queries++;
     if(depth===64)for(const child of reference) {
      const value=await engine.windows(child.board,-player,model,63,[[-1e9,1e9]]);
      assert.equal(-value.values[0]||0,-oracleScore(child.board,-player)||0);alternatives++;
     }
    }
    const expected=oracleScore(board,player,2,evaluators[model]);
    const values=(await engine.windows(board,player,model,2,[[-1e9,expected],[expected,1e9],[-1e9,1e9]])).values;
    assert.equal(values.at(-1)||0,expected||0);queries+=3;
   }
  }finally{engine.close();}
 }
 rows.push({tag,passed:true,sanitizerReceipt:receipt,independentRootQueries:queries,independentAlternatives:alternatives,legalChildren:children,standaloneAssertions:true});
 console.log(JSON.stringify({tag,passed:true,queries,alternatives,children}));
}
writeFileSync(resolve(out,'variant-qualification.json'),JSON.stringify({passed:true,seed:0x4d345154,boards,rows})+'\n');
