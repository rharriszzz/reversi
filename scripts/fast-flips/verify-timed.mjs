// Correctness audit only: actual 80/300-ms publications against full fixed work.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {NativeEngine} from '../native/client.mjs';
import {oracleChildren} from '../../tests/oracle.mjs';
const out=resolve(process.env.REVERSI_FLIP_RUN??'.local-research/fast-flips-m4-20261031');
const data=JSON.parse(readFileSync(resolve(out,'integrated-final.json'))),positions=JSON.parse(readFileSync(resolve(out,'positions.json')));
const engine=new NativeEngine({receipt:JSON.parse(readFileSync(resolve(out,'original/build.json')))}),scores=new Map(),moves=new Map();let checked=0;
try {
 await engine.ready();
 for(const row of data.timed)for(const [tag,result] of Object.entries(row.results))for(let i=0;i<result.roots.length;i++) {
  const actual=result.roots[i],p=positions.find(p=>p.id===row.positionIds[i]);assert.ok(actual.hasScore&&actual.depth>0);
  const key=`${p.id}/${row.model}/${actual.depth}`;
  if(!scores.has(key))scores.set(key,(await engine.search(p.board,p.player,{model:row.model,depth:actual.depth,hints:false})).score);
  assert.equal(actual.score,scores.get(key),`${tag} ${key}`);
  const child=oracleChildren(p.board,p.player).find(c=>c.move===actual.move);assert.ok(child);
  const mk=key+'/'+actual.move;
  if(!moves.has(mk))moves.set(mk,-(await engine.windows(child.board,-p.player,row.model,actual.depth-1,[[-1e9,1e9]])).values[0]);
  assert.equal(actual.score,moves.get(mk),`published move ${tag} ${key}`);checked++;
 }
 const receipt={passed:true,publications:checked,uniqueRootHorizons:scores.size,uniqueMoveHorizons:moves.size,reference:'Original baseline complete fixed-depth roots and full-window chosen children; legal children from independent mailbox; no timing data used as performance evidence.'};
 writeFileSync(resolve(out,'timed-qualification.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}finally{engine.close();}
