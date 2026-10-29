// Offline witness reconstruction; production search, rules and defaults unchanged.
import { findBestMove, terminalScore } from '../../src/search.js';
import { evaluateFast } from '../../src/fast-features.js';
import { legalMoves, play, counts } from '../../src/rules.js';
import { oracleChildren } from '../../tests/oracle.mjs';
import { canonical } from '../research/core.mjs';
import { childEncoding } from './model.mjs';
export const equivalent=(a,b)=>Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b));
// Observation is of this exact board/turn, not a symmetry assertion. Avoid doing
// sixteen canonical transforms inside every production evaluator callback.
const observedKey=(board,player)=>`${player}:${board.join('')}`;
export function staticAtCutoff(board,player,weights) {
  const own=legalMoves(board,player);
  if(!own.length) {
    if(!legalMoves(board,-player).length) return terminalScore(board,player);
    return -staticAtCutoff(board,-player,weights);
  }
  return evaluateFast(board,player,weights,own.length);
}
export function fullWindow(state,depth,weights,check=()=>{}) {
  check();if(!Number.isInteger(depth)||depth<0||depth>14) throw Error('Invalid remaining placement depth');
  const start=performance.now(),observed=new Set();let nodes=0,evaluations=0;
  const evaluate=(b,p,w,n)=>{observed.add(observedKey(b,p));return evaluateFast(b,p,w,n);};
  const value=(board,player,d)=>{
    if(d===0) {evaluations++;return staticAtCutoff(board,player,weights);}
    check();const r=findBestMove(board,player,d,weights,{evaluate});nodes+=r.nodes;evaluations+=r.evaluations;return r.score;
  };
  // At depth zero there are no alternatives: the engine normalizes passes first.
  if(depth===0) return {score:staticAtCutoff(state.board,state.player,weights),rows:[],nodes:0,evaluations:1,wallMs:performance.now()-start,observed:[]};
  const moves=legalMoves(state.board,state.player);
  const rows=moves.map(move=>({move,score:-value(play(state.board,state.player,move),-state.player,depth-1)}));
  const score=rows.length?Math.max(...rows.map(r=>r.score)):value(state.board,state.player,depth);
  rows.sort((a,b)=>b.score-a.score||a.move-b.move);
  return {score,rows,nodes,evaluations,wallMs:performance.now()-start,observed:[...observed]};
}
function independentChildren(state) {
  const children=oracleChildren(state.board,state.player),moves=legalMoves(state.board,state.player);
  if(JSON.stringify(children.map(c=>c.move))!==JSON.stringify(moves)) throw Error('Independent legal alternatives mismatch');
  for(const c of children) if(JSON.stringify(c.board)!==JSON.stringify([...play(state.board,state.player,c.move)])) throw Error('Independent child board mismatch');
  return children;
}
export function collectFrontier(root,{weights,check=()=>{}}={}) {
  const start=performance.now(),initial=fullWindow(root,root.depth,weights,check),parents=[],lines=[];
  let nodes=initial.nodes,evaluations=initial.evaluations;
  for(const alternative of initial.rows.slice(0,2)) {
    let state={board:[...play(root.board,root.player,alternative.move)],player:-root.player},remaining=root.depth-1,
      expected=-alternative.score;
    const steps=[{player:root.player,move:alternative.move,remaining:root.depth,score:alternative.score}],passes=[];
    while(true) {
      check();const legal=legalMoves(state.board,state.player);
      if(!legal.length) {
        if(!legalMoves(state.board,-state.player).length) {if(!equivalent(terminalScore(state.board,state.player),expected)) throw Error('Terminal witness mismatch');lines.push({alternative:alternative.move,steps,passes,terminal:true,endpoint:state});break;}
        passes.push({state,remaining});steps.push({player:state.player,move:null,remaining,score:expected});
        state={...state,player:-state.player};expected=-expected;continue;
      }
      if(remaining<1) throw Error('Frontier reconstruction overran parent');
      const result=fullWindow(state,remaining,weights,check);nodes+=result.nodes;evaluations+=result.evaluations;
      if(!equivalent(result.score,expected)) throw Error(`Continuation value mismatch at remaining ${remaining}`);
      const chosen=result.rows[0];
      steps.push({player:state.player,move:chosen.move,remaining,score:result.score,rows:result.rows});
      if(remaining===1) {
        const children=independentChildren(state).map(c=>{
          const enc=childEncoding(c.board,state.player),score=staticAtCutoff(c.board,state.player,weights);
          if(!equivalent(score,result.rows.find(r=>r.move===c.move).score)) throw Error('Actual cutoff-child score mismatch');
          return {move:c.move,board:c.board,player:-state.player,occupied:64-counts(c.board).empty,...enc};
        });
        const key=canonical(state.board,state.player),endpoint=children.find(c=>c.move===chosen.move);
        // The selected child backs up to the original alternative with exact alternating signs.
        const endpointKey=observedKey(endpoint.board,-state.player),passedEndpointKey=observedKey(endpoint.board,state.player);
        lines.push({alternative:alternative.move,steps,passes,terminal:false,parentKey:key,
          endpoint:{board:endpoint.board,player:-state.player},rootLeafObserved:initial.observed.includes(endpointKey)||initial.observed.includes(passedEndpointKey),
          proof:'each remaining-depth value independently full-window; final depth-one rows equal static child values'});
        const existing=parents.find(p=>p.key===key);
        if(existing) existing.alternatives.push(alternative.move);
        else parents.push({...state,key,occupied:64-counts(state.board).empty,remaining:1,
          alternatives:[alternative.move],bChoice:chosen.move,children});
        break;
      }
      state={board:[...play(state.board,state.player,chosen.move)],player:-state.player};remaining--;expected=-chosen.score;
    }
  }
  return {rootId:root.id,rootScores:initial.rows,parents,lines,nodes,evaluations,wallMs:performance.now()-start,
    initialSearchMs:initial.wallMs,observedStaticCount:initial.observed.length};
}
