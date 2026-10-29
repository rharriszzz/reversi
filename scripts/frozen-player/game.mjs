import assert from 'node:assert/strict';
import { findBestMove } from '../../src/search.js';
import { legalMoves, play } from '../../src/rules.js';
import { compile } from '../next-residual/model.mjs';
import { oracleChildren } from '../../tests/oracle.mjs';
import { PROTOCOL,hash } from './protocol.mjs';
export const gameIdentity=(opening,candidate,color,timeMs)=>hash({opening,candidate:candidate.checksum,color,timeMs,
  protocol:hash(PROTOCOL)});
export function replay(opening,moves,{complete=false}={}) {
  let board=[...opening.board],player=opening.player,passes=0;
  for(const step of moves) {
    assert.equal(step.player,player,'replay turn'); assert.ok(passes<2,'move after termination');
    const children=oracleChildren(board,player);
    if(step.move===null) {assert.equal(children.length,0,'illegal replay pass');passes++;}
    else {const child=children.find(c=>c.move===step.move);assert.ok(child,'illegal replay move');board=child.board;passes=0;}
    player=-player;
  }
  if(complete) assert.equal(passes,2,'incomplete game');
  return {board,player,passes};
}
export async function playGame(opening,candidate,color,timeMs,{resume=null,checkpoint=()=>{},check=()=>{}}={}) {
  if(![80,300].includes(timeMs)||![1,-1].includes(color)) throw Error('Undeclared timed-game condition');
  const identity=gameIdentity(opening,candidate,color,timeMs);
  if(resume) {
    const {checksum,...body}=resume;assert.equal(hash(body),checksum,'checkpoint digest');assert.equal(resume.identity,identity);
    const state=replay(opening,resume.moves);for(const k of ['board','player','passes'])assert.deepEqual(resume[k],state[k]);
  }
  let {board,player,passes}=resume??{board:[...opening.board],player:opening.player,passes:0};
  const moves=resume?[...resume.moves]:[],candidateEval=compile(candidate).evaluate,baselineEval=compile('B').evaluate;
  while(passes<2) {
    check();const legal=legalMoves(board,player);
    if(!legal.length) {moves.push({player,move:null});passes++;player=-player;}
    else {
      const occupied=board.filter(Boolean).length,start=performance.now();
      const result=findBestMove(board,player,14,undefined,{timeMs,evaluate:player===color?candidateEval:baselineEval});
      const measuredMs=performance.now()-start;
      assert.ok(legal.includes(result.move),'illegal playing choice');
      moves.push({player,occupied,...result,measuredMs,overrunMs:Math.max(0,measuredMs-timeMs)});
      board=[...play(board,player,result.move)];player=-player;passes=0;
    }
    const body={identity,board,player,passes,moves};checkpoint({...body,checksum:hash(body)});
    await new Promise(ok=>setImmediate(ok));
  }
  assert.deepEqual(replay(opening,moves,{complete:true}).board,board);
  const margin=board.reduce((s,v)=>s+v,0),outcome=Math.sign(margin)*color;
  return {identity,openingId:opening.id,color,timeMs,moves,board,margin,outcome,points:(1+outcome)/2,
    moveTimeMs:moves.reduce((n,m)=>n+(m.measuredMs??0),0),replayed:true};
}
