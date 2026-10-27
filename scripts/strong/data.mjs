import { initialBoard, legalMoves, play, counts, coord } from '../../src/rules.js';
import { legalMovesFast, evaluateFast } from '../../src/fast-features.js';
import { makeFastStableEvaluator } from '../../src/evaluation.js';
import { findBestMove, terminalScore } from '../../src/search.js';
import { seededRandom } from '../../src/learning.js';
import { oracleChildren } from '../../tests/oracle.mjs';
import { createHash } from 'node:crypto';
import { canonical, decodeTerminal } from '../research/core.mjs';
import { evaluator, unpack, sparse } from './model.mjs';

export function policyPool(models=[]) {
  return [{id:'B',version:'production',evaluate:evaluateFast},{id:'C',version:'stable60',evaluate:makeFastStableEvaluator(60)},
    ...models.map(m=>({id:m.id,version:m.version,sha256:createHash('sha256').update(JSON.stringify({spec:m.spec,weights:m.weights,counts:m.counts})).digest('hex'),...evaluator(m)}))];
}
export function generate({seed,index,split,models=[],compiledPolicies,depth=1}) {
  const rng=seededRandom(seed),policies=compiledPolicies??policyPool(models);
  const black=policies[index%policies.length],white=policies[Math.floor(index/policies.length)%policies.length];
  const openingPlies=8+2*(index%3),exploration=[0.02,0.08,0.2][index%3];
  let board=initialBoard(),player=1,placements=0,passes=0;const states=[],moves=[],roots=[];
  while(passes<2) {
    const legal=legalMovesFast(board,player);
    if(!legal.length) {moves.push({player,move:null,policy:'forced-pass'});passes++;player=-player;continue;}
    passes=0;const policy=player===1?black:white;
    if(placements===8||placements===12) roots.push({board:[...board],player,key:canonical(board,player)});
    // The randomized opening and an additional four placements are never fit.
    if(placements>=Math.max(16,openingPlies+4)) states.push({board:[...board],player,placements,key:canonical(board,player)});
    const random=placements<openingPlies||rng()<exploration;
    const result=random?null:findBestMove(board,player,depth,undefined,{evaluate:policy.evaluate,legalMoves:legalMovesFast});
    const move=random?legal[Math.floor(rng()*legal.length)]:result.move;
    moves.push({player,move,policy:random?'random':policy.id,depth:random?0:depth});
    board=play(board,player,move);placements++;player=-player;
  }
  const c=counts(board);
  const identity=p=>({id:p.id,version:p.version,sha256:p.sha256??null});
  return {id:`${split}-${index}-${seed}`,split,index,seed,policy:{black:black.id,white:white.id,blackModel:identity(black),whiteModel:identity(white),depth,openingPlies,exploration},
    states,roots,moves,terminal:[...board],margin:c.black-c.white,outcome:Math.sign(c.black-c.white),
    provenance:'complete mixed behavior-policy outcome; not minimax'};
}

// Independent mailbox rules with alpha-beta. No shared production search.
// Abort is explicit: never publish an approximate label as exact.
export function solveIndependent(board,player,{maxMs=3000,maxNodes=2000000}={}) {
  const start=performance.now();let nodes=0;
  const score=(b,p,alpha,beta)=>{
    if(++nodes>maxNodes||(nodes%256===0&&performance.now()-start>maxMs)) throw new Error('exact reference cap');
    const children=oracleChildren(b,p);
    if(!children.length) {
      if(oracleChildren(b,-p).length) return -score(b,-p,-beta,-alpha);
      return decodeTerminal(terminalScore(b,p));
    }
    let best=-65;
    // Independent rules; corner/flip ordering affects work only.
    children.sort((a,c)=>Number([0,7,56,63].includes(c.move))-Number([0,7,56,63].includes(a.move)));
    for(const child of children) {best=Math.max(best,-score(child.board,-p,-beta,-alpha));alpha=Math.max(alpha,best);if(alpha>=beta) break;}
    return best;
  };
  // Values at the root are full-window. No transposition writes are needed.
  const children=oracleChildren(board,player),rows=[];
  for(const c of children) rows.push({move:c.move,margin:-score(c.board,-player,-65,65)||0});
  const value=rows.length?Math.max(...rows.map(r=>r.margin)):score(board,player,-65,65);
  return {kind:'exact',units:'final discs for side to move',board:[...board],player,rows,value,nodes,wallMs:performance.now()-start,source:'independent 10x10 mailbox alpha-beta'};
}

export function searchLabel(state,depth=5) {
  const start=performance.now();
  const rows=legalMovesFast(state.board,state.player).map(move=>{
    const b=play(state.board,state.player,move);
    const r=findBestMove(b,-state.player,depth-1,undefined,{legalMoves:legalMovesFast,evaluate:evaluateFast});
    return {move,estimate:-r.score,reply:r.move,exact:r.exact,depth:depth};
  });
  return {...state,kind:'search',depth,rows,wallMs:performance.now()-start,units:'uncalibrated B minimax units; preferences only',source:'original alpha-beta with B; actual opponent best reply recorded'};
}
export function selectStates(games,models,limit=8) {
  const es=models.map(evaluator),decoded=models.map(unpack),pool=[];
  for(const game of games) for(let j=0;j<game.states.length;j+=5) {
    const s=game.states[j],empty=64-s.board.filter(Boolean).length;
    if(empty<8||empty>48||legalMovesFast(s.board,s.player).length<2) continue;
    const d1=findBestMove(s.board,s.player,1,undefined,{legalMoves:legalMovesFast}),d2=findBestMove(s.board,s.player,2,undefined,{legalMoves:legalMovesFast});
    const choices=es.map(e=>findBestMove(s.board,s.player,1,undefined,{evaluate:e.evaluate,legalMoves:legalMovesFast}).move);
    const coverage=es.length?Math.abs(es[0].evaluate(s.board,s.player)-evaluateFast(s.board,s.player)):0;
    const entries=decoded.length?sparse(s.board,decoded[0],{raw:true}):[],rare=entries.length?entries.filter(([i])=>decoded[0].counts[i]<8).length/entries.length:1;
    const priority=3*Number(d1.move!==d2.move)+2*Number(choices.some(c=>c!==d1.move))+Math.min(2,coverage/50)+rare;
    pool.push({...s,gameId:game.id,priority,selection:{depthDisagreement:d1.move!==d2.move,modelDisagreement:choices.some(c=>c!==d1.move),scoreDisagreement:coverage,rareFraction:rare}});
  }
  return pool.sort((a,b)=>b.priority-a.priority||a.key.localeCompare(b.key)).slice(0,limit);
}
export function exactContinuation(state,firstMove,maxMs=10000) {
  let b=Int8Array.from(state.board),p=state.player;const line=[],start=performance.now();
  if(firstMove!==undefined) {b=play(b,p,firstMove);line.push(coord(firstMove));p=-p;}
  for(let i=0;i<128;i++) {
    const moves=legalMovesFast(b,p);if(!moves.length) {if(!legalMovesFast(b,-p).length) break;line.push('pass');p=-p;continue;}
    const ref=solveIndependent(b,p,{maxMs:Math.max(1,maxMs-(performance.now()-start))});
    const move=ref.rows.find(r=>r.margin===ref.value).move;line.push(coord(move));b=play(b,p,move);p=-p;
  }
  return {line,terminal:[...b],margin:b.reduce((s,v)=>s+v,0)*state.player||0};
}
