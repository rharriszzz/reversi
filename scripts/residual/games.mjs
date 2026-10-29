import { findBestMove } from '../../src/search.js';
import { evaluateFast } from '../../src/fast-features.js';
import { legalMoves, play, counts } from '../../src/rules.js';
import { seededRandom } from '../../src/learning.js';
import { quantile, mean } from '../teacher/qualification-core.mjs';
import { PROTOCOL } from './protocol.mjs';
export async function game(opening,weights,candidateColor,timeMs,{check=()=>{},resume=null,checkpoint=()=>{}}={}) {
  let board=resume?.board??[...opening.board],player=resume?.player??opening.player,passes=resume?.passes??0;
  const moves=resume?.moves?[...resume.moves]:[],start=performance.now();
  while(passes<2) {
    check();const legal=legalMoves(board,player);
    if(!legal.length){passes++;moves.push({player,move:null});player=-player;checkpoint({board,player,passes,moves});await new Promise(ok=>setImmediate(ok));continue;}
    passes=0;const result=findBestMove(board,player,14,player===candidateColor?weights:undefined,{timeMs});
    if(!legal.includes(result.move))throw Error('Illegal tournament choice');
    moves.push({player,...result});board=[...play(board,player,result.move)];player=-player;
    checkpoint({board,player,passes,moves});
    // Deliver signals, heartbeat and stop requests between bounded searches.
    await new Promise(ok=>setImmediate(ok));
  }
  const margin=board.reduce((a,v)=>a+v,0),outcome=Math.sign(margin)*candidateColor;
  return {opening,candidateColor,timeMs,moves,board,margin,outcome,points:outcome>0?1:outcome<0?0:.5,
    // Sum measured move costs across restarts; do not lose completed search time.
    wallMs:Math.max(moves.reduce((n,m)=>n+(m.elapsedMs??0),0),(resume?.wallMs??0)+performance.now()-start)};
}
export function evaluationCost(states,weights,iterations=30000) {
  let checksum=0;const costs=[];
  for(let repetition=0;repetition<4;repetition++) for(const which of repetition%2?['candidate','B']:['B','candidate']) {
    const start=performance.now();for(let i=0;i<iterations;i++){const s=states[i%states.length];checksum+=evaluateFast(s.board,s.player,which==='B'?undefined:weights);}
    costs.push({which,nsPerEvaluation:(performance.now()-start)*1e6/iterations});
  }
  return {costs,checksum};
}
export function pairBootstrap(points,seed=2026102841,reps=PROTOCOL.games.bootstrap) {
  if(!points.length)throw Error('No opening pairs');
  const random=seededRandom(seed),samples=[];
  for(let r=0;r<reps;r++){let sum=0;for(let j=0;j<points.length;j++)sum+=points[Math.floor(random()*points.length)];samples.push(sum/points.length);}
  return {pairs:points.length,mean:mean(points),lower975:quantile(samples,.025),interval95:[quantile(samples,.025),quantile(samples,.975)],
    treatment:PROTOCOL.games.simultaneous};
}
export function gameSummary(games) {
  const stats=which=>{const xs=games.flatMap(g=>g.moves.filter(m=>m.move!==null&&(which==='candidate'?m.player===g.candidateColor:m.player!==g.candidateColor)));
    return {moves:xs.length,nodes:xs.reduce((s,m)=>s+m.nodes,0),evaluations:xs.reduce((s,m)=>s+m.evaluations,0),
      elapsedMs:xs.reduce((s,m)=>s+m.elapsedMs,0),medianElapsedMs:quantile(xs.map(m=>m.elapsedMs),.5),p99ElapsedMs:quantile(xs.map(m=>m.elapsedMs),.99),
      completedDepthHistogram:xs.reduce((s,m)=>{s[m.depth]=(s[m.depth]??0)+1;return s;},{}),
      deadlineOverruns:xs.filter(m=>m.elapsedMs>m.budgetMs+1).length,unsearchedFallbacks:xs.filter(m=>m.depth===0).length};};
  return {wins:games.filter(g=>g.outcome>0).length,draws:games.filter(g=>g.outcome===0).length,losses:games.filter(g=>g.outcome<0).length,
    candidate:stats('candidate'),B:stats('B')};
}
