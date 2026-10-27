#!/usr/bin/env node
// Disclosed historical data are diagnostics only, never new confirmation.
import { resolve } from 'node:path';
import { read, atomic } from '../research/io.mjs';
import { engine, predictionLoss } from '../research/core.mjs';
import { fillFeaturesFast, evaluateFast, legalMovesFast } from '../../src/fast-features.js';
import { findBestMove } from '../../src/search.js';
import { FEATURE_KEYS } from './model.mjs';

export function compileLegacy(model) {
  if(model.family!=='linear'||model.smooth||model.extra?.some(k=>k!=='stable')) throw new Error('Only historical discrete linear + stable model supported');
  const features=new Float64Array(7),seen=new Uint8Array(64),edges=[[0,1],[0,8],[7,-1],[7,8],[56,1],[56,-8],[63,-1],[63,-8]];
  return (board,player,_weights,knownMoves)=>{
    const occupied=fillFeaturesFast(board,player,features,knownMoves),offset=(occupied<28?0:occupied<52?1:2)*12;
    let score=0;for(let i=0;i<7;i++) score+=model.weights[offset+i]*features[i];
    if(model.extra?.includes('stable')) {
      seen.fill(0);let stable=0;
      for(let e=0;e<8;e++) {
        const [corner,step]=edges[e],owner=board[corner];if(!owner) continue;
        for(let d=1;d<8;d++) {const q=corner+step*d;if(board[q]!==owner)break;if(q!==0&&q!==7&&q!==56&&q!==63&&!seen[q]) {seen[q]=1;stable+=board[q]*player;}}
      }
      score+=model.weights[offset+7]*stable/24;
    }
    return Math.max(-1000,Math.min(1000,score));
  };
}
export function diagnose(directory,output) {
  const s=read(`${directory}/manifest.json`),model=read(s.models[s.freeze.id]),games=s.data.development.flatMap(p=>read(p).games),states=games.flatMap(g=>g.states).filter((_,i)=>i%13===0),generic=engine(model).evaluate,compiled=compileLegacy(model);
  let maxDifference=0;
  for(const state of states) for(const side of [1,-1]) maxDifference=Math.max(maxDifference,Math.abs(generic(state.board,side)-compiled(state.board,side)));
  if(maxDifference>1e-10) throw new Error('Historical compilation changed value');
  const costs=[];
  for(const [id,evaluate] of [['B',evaluateFast],['historical-generic',generic],['identical-compiled',compiled]]) {
    let checksum=0;for(let i=0;i<6000;i++) checksum+=evaluate(states[i%states.length].board,1);
    const samples=[];for(let k=0;k<5;k++) {const start=performance.now();for(let i=0;i<30000;i++) checksum+=evaluate(states[i%states.length].board,1);samples.push((performance.now()-start)*1000/30000);}
    const searches=states.filter((_,i)=>i%Math.max(1,Math.floor(states.length/24))===0).slice(0,24).map(st=>{
      const start=performance.now(),r=findBestMove(st.board,st.player,3,undefined,{evaluate,legalMoves:legalMovesFast});return {move:r.move,score:r.score,nodes:r.nodes,evaluations:r.evaluations,wallMs:performance.now()-start};
    });
    costs.push({id,microseconds:[...samples].sort((a,b)=>a-b)[2],samples,searches,checksum});
  }
  const before=costs[1].searches,after=costs[2].searches;
  if(before.some((r,i)=>r.move!==after[i].move||Math.abs(r.score-after[i].score)>1e-9)) throw new Error('Compiled minimax changed');
  const result={sourceRun:resolve(directory),historicalOnly:true,maxDifference,states:states.length,costs,
    phasePrediction:{B:predictionLoss(read(s.models.B),games),learned:predictionLoss(model,games)},
    conclusion:'Identical-value compilation isolates representation cost; does not establish improved timed playing strength. Earlier-depth B teacher labels share its biases. Fresh run compares phases, objectives, coverage, and phase counts.',
    hypotheses:{cost:'compare generic vs identical-compiled timing and unchanged d3 minimax',earlyAccuracy:'game-cluster phase MSE and new depth-5/6 ranking, keeping teacher bias explicit',target:'margin/outcome/rank losses per independent family',data:'new streamed diverse trajectories, distinct keys, chronological learning curves and policy strata',parameterization:'4/6 phase controls and short vs long pattern vs linear families'}};
  atomic(output,result);return result;
}
if(process.argv[1]?.endsWith('diagnose-previous.mjs')) {const r=diagnose(process.argv[2]??'.local-research/six-hour-20261027',process.argv[3]??'.local-research/previous-diagnostic.json');console.log(JSON.stringify({maxDifference:r.maxDifference,states:r.states,costs:r.costs.map(({id,microseconds})=>({id,microseconds})),phasePrediction:r.phasePrediction},null,2));}
