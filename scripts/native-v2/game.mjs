import assert from 'node:assert/strict';
import {NativeEngine} from '../native/client.mjs';
import {positions} from './positions.mjs';
import {replay} from '../native/game.mjs';
import {legalMoves,play} from '../../src/rules.js';
import {hash,PROTOCOL} from './protocol.mjs';
export {replay};
export async function players(receipt,order=0){
 const engines={B:new NativeEngine({receipt,ttMiB:PROTOCOL.engine.ttMiB}),P:new NativeEngine({receipt,ttMiB:PROTOCOL.engine.ttMiB})};
 try{for(const model of (order%2?['P','B']:['B','P'])){
  await engines[model].ready();for(const p of positions().slice(0,4))for(const depth of [3,5])await engines[model].search(p.board,p.player,{model,depth});
 }return engines;}catch(e){Object.values(engines).forEach(x=>x.close());throw e;}
}
export async function playGame(engines,opening,{color=1,timeMs=80,resume=null,checkpoint=()=>{},check=()=>{}}={}){
 const identity=hash({opening,color,timeMs,protocol:PROTOCOL,build:engines.B.receipt.fingerprint});
 if(resume){const {checksum,...body}=resume;assert.equal(hash(body),checksum);assert.equal(resume.identity,identity);const state=replay(opening,resume.moves);for(const k of ['board','player','passes'])assert.deepEqual(state[k],resume[k]);}
 let {board,player,passes}=resume??{board:[...opening.board],player:opening.player,passes:0};const moves=resume?[...resume.moves]:[];
 while(passes<2){
  check();const legal=legalMoves(board,player);
  if(!legal.length){moves.push({player,move:null});player=-player;passes++;}
  else{
   const occupied=board.filter(Boolean).length,model=player===color?'P':'B',start=performance.now();
   const result=await engines[model].search(board,player,{model,timeMs});
   const measuredMs=performance.now()-start;assert.ok(legal.includes(result.move));assert.ok(result.depth>0,'No depth-zero scored fallback');
   assert.equal(result.buildIdentity,engines.B.receipt.fingerprint);assert.equal(result.modelIdentity,engines[model].receipt.models[model]);
   moves.push({...result,player,model,occupied,measuredMs,overrunMs:Math.max(0,measuredMs-timeMs)});
   board=[...play(board,player,result.move)];player=-player;passes=0;
  }
  const body={identity,board,player,passes,moves};checkpoint({...body,checksum:hash(body)});
  await new Promise(ok=>setImmediate(ok));
 }
 assert.deepEqual(replay(opening,moves,{complete:true}).board,board);
 const margin=board.reduce((s,v)=>s+v,0)*color||0;
 return {identity,color,timeMs,moves,board,margin,outcome:Math.sign(margin),points:(1+Math.sign(margin))/2,moveTimeMs:moves.reduce((s,m)=>s+(m.measuredMs??0),0)};
}
