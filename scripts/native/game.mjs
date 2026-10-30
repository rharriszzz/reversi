// Shared actual-playing pipeline for native and reference JavaScript searches.
import assert from 'node:assert/strict';
import { legalMoves, play, coord } from '../../src/rules.js';
import { findBestMove } from '../../src/search.js';
import { frozenModels } from '../frozen-player/models.mjs';
import { compile } from '../next-residual/model.mjs';
import { hash } from '../next-residual/protocol.mjs';
import { oracleChildren } from '../../tests/oracle.mjs';
const models=frozenModels(),evaluators=Object.fromEntries(Object.entries(models).map(([k,v])=>[k,compile(v).evaluate]));
export async function choose(engine,board,player,{backend='native',model='P',depth=14,timeMs,signal}={}) {
  if(backend==='native')return engine.search(board,player,{model,depth,timeMs,signal});
  if(backend!=='javascript'||!evaluators[model])throw Error('Invalid player backend/model');
  if(signal?.aborted)throw signal.reason??Error('Cancelled');
  return {...findBestMove(board,player,depth,undefined,{timeMs,evaluate:evaluators[model]}),backend:'javascript',modelIdentity:engine.receipt.models[model]};
}
export function replay(opening,moves,{complete=false}={}) {
  let board=[...opening.board],player=opening.player,passes=0;
  for(const m of moves) {
    assert.equal(m.player,player);const children=oracleChildren(board,player);
    if(m.move===null){assert.equal(children.length,0);passes++;}else {const c=children.find(c=>c.move===m.move);assert.ok(c,'Illegal recorded move');board=c.board;passes=0;}
    player=-player;assert.ok(passes<=2);
  }
  if(complete)assert.equal(passes,2);
  return {board,player,passes};
}
export async function playGame(engine,opening,{nativeColor=1,timeMs=80,model='P',depth=14,resume=null,checkpoint=()=>{},check=()=>{}}={}) {
  if(![1,-1].includes(nativeColor)||!Number.isFinite(timeMs)||timeMs<=0)throw Error('Invalid game condition');
  const identity=hash({opening,model,modelIdentity:engine.receipt.models[model],build:engine.receipt.fingerprint,nativeColor,timeMs,depth});
  if(resume) {const {checksum,...body}=resume;assert.equal(hash(body),checksum);assert.equal(resume.identity,identity);const state=replay(opening,resume.moves);for(const k of ['board','player','passes'])assert.deepEqual(state[k],resume[k]);}
  let {board,player,passes}=resume??{board:[...opening.board],player:opening.player,passes:0};const moves=resume?[...resume.moves]:[];
  while(passes<2) {
    check();const legal=legalMoves(board,player);
    if(!legal.length){moves.push({player,move:null});player=-player;passes++;}
    else {
      const occupied=board.filter(Boolean).length,backend=player===nativeColor?'native':'javascript',start=performance.now();
      // The client transmits an absolute deadline so input transport consumes
      // the same elapsed budget. Output transport is measured in the overrun.
      const result=await choose(engine,board,player,{backend,model,depth,timeMs});
      const measuredMs=performance.now()-start;assert.ok(legal.includes(result.move));
      moves.push({...result,player,occupied,measuredMs,overrunMs:Math.max(0,measuredMs-timeMs)});
      board=[...play(board,player,result.move)];player=-player;passes=0;
    }
    const body={identity,board,player,passes,moves};checkpoint({...body,checksum:hash(body)});
    await new Promise(ok=>setImmediate(ok));
  }
  assert.deepEqual(replay(opening,moves,{complete:true}).board,board);
  const margin=(board.reduce((s,v)=>s+v,0)*nativeColor)||0;
  return {identity,opening,nativeColor,timeMs,model,moves,board,margin,outcome:Math.sign(margin),points:(1+Math.sign(margin))/2,
    moveTimeMs:moves.reduce((n,m)=>n+(m.measuredMs??0),0)};
}
