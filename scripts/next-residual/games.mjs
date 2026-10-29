import { findBestMove } from '../../src/search.js';
import { legalMoves,play,counts } from '../../src/rules.js';
import { compile } from './model.mjs';
import { seededRandom } from '../../src/learning.js';
import { mean,quantile } from '../teacher/qualification-core.mjs';
import { hash,PROTOCOL } from './protocol.mjs';
export { gameSummary } from '../residual/games.mjs';
export async function game(opening,candidate,reference,color,timeMs,{check=()=>{},resume=null,checkpoint=()=>{}}={}) {
  const identity=hash({opening,candidate: candidate==='B'?'B':candidate.checksum,reference:reference==='B'?'B':reference.checksum,color,timeMs,search:PROTOCOL.games});
  if(resume&&resume.identity!==identity)throw Error('Timed game frozen identity mismatch');
  let board=resume?.board??[...opening.board],player=resume?.player??opening.player,passes=resume?.passes??0;
  const moves=resume?.moves?[...resume.moves]:[],evaluators={candidate:compile(candidate).evaluate,reference:compile(reference).evaluate};
  while(passes<2) {
    check();const legal=legalMoves(board,player);
    if(!legal.length){passes++;moves.push({player,move:null});player=-player;}
    else {
      passes=0;const evaluate=evaluators[player===color?'candidate':'reference'];
      // No per-evaluation timer in scientific timed games. Its overhead would
      // alter the comparison. Complete evaluator cost is measured separately.
      const result=findBestMove(board,player,14,undefined,{timeMs,evaluate});
      if(!legal.includes(result.move))throw Error('Illegal timed choice');
      moves.push({player,...result});board=[...play(board,player,result.move)];player=-player;
    }
    checkpoint({identity,board,player,passes,moves});await new Promise(ok=>setImmediate(ok));
  }
  const margin=board.reduce((s,v)=>s+v,0),outcome=Math.sign(margin)*color;
  return {identity,openingId:opening.id,candidateColor:color,timeMs,moves,board,margin,outcome,points:outcome>0?1:outcome<0?0:.5,
    wallMs:moves.reduce((s,m)=>s+(m.elapsedMs??0),0)};
}

export function pairBootstrap(points,seed=2026102909,reps=10000) {
  const rng=seededRandom(seed),samples=[];
  for(let r=0;r<reps;r++){let sum=0;for(let i=0;i<points.length;i++)sum+=points[Math.floor(rng()*points.length)];samples.push(sum/points.length);}
  return {pairs:points.length,mean:mean(points),lower975:quantile(samples,.025),lower95:quantile(samples,.05),interval95:[quantile(samples,.025),quantile(samples,.975)],method:PROTOCOL.games.claim};
}
