import { parentPort } from 'node:worker_threads';
import { read } from '../research/io.mjs';
import { generate, policyPool, selectStates, searchLabel, solveIndependent, exactContinuation } from './data.mjs';
import { unpack, pack, evaluator, compile, sparse, dot } from './model.mjs';
import { fit, prediction, ranking, speed, calibrateBaseline } from './train.mjs';
import { findBestMove } from '../../src/search.js';
import { legalMovesFast } from '../../src/fast-features.js';
import { counts, play, winner } from '../../src/rules.js';
import { decodeTerminal, canonical } from '../research/core.mjs';

const gamesFrom=paths=>paths.flatMap(p=>read(p).games??[]);
const refsFrom=paths=>paths.flatMap(p=>read(p).labels??[]);
const load=p=>p==='B'?'B':unpack(read(p));
function game(opening,black,white,budget) {
  let b=Int8Array.from(opening.board),p=opening.player,passes=0;const moves=[],keys=[],stats={black:[],white:[]};
  while(passes<2) {
    if(!legalMovesFast(b,p).length) {moves.push({player:p,move:null});p=-p;passes++;continue;}
    passes=0;if(counts(b).empty<=44) keys.push(canonical(b,p));const e=p===1?black:white,start=performance.now();
    const r=findBestMove(b,p,budget.depth??14,undefined,{evaluate:e.evaluate,legalMoves:legalMovesFast,orderingHints:true,timeMs:budget.timeMs});
    stats[p===1?'black':'white'].push({depth:r.depth,nodes:r.nodes,evaluations:r.evaluations,wallMs:performance.now()-start,overrunMs:budget.timeMs?Math.max(0,r.elapsedMs-budget.timeMs):0,fallback:r.depth===0});
    moves.push({player:p,move:r.move});b=play(b,p,r.move);p=-p;
  }
  keys.push(canonical(b,1),canonical(b,-1));
  return {winner:winner(b),margin:counts(b).black-counts(b).white,moves,keys,stats};
}
async function task(j) {
  switch(j.type) {
    case 'generate': {const compiledPolicies=policyPool(j.models);return {games:Array.from({length:j.n},(_,k)=>generate({...j,compiledPolicies,index:j.index+k,seed:j.seeds[k]}))};}
    case 'label': {
      const games=gamesFrom(j.paths),models=(j.models??[]).map(p=>read(p)),labels=[],skipped=[];
      const selected=selectStates(games,models,j.limit??8),engines=models.map(evaluator);
      for(const s of selected) {
        let ref=searchLabel(s,j.depth??5);
        const regrets=engines.map(e=>{const move=findBestMove(s.board,s.player,1,undefined,{evaluate:e.evaluate,legalMoves:legalMovesFast}).move;return Math.max(...ref.rows.map(r=>r.estimate))-ref.rows.find(r=>r.move===move).estimate;});
        if(regrets.some(v=>v>40)&&(j.depth??5)<=5) {const deeper=searchLabel(s,(j.depth??5)+1);ref={...deeper,previousDepthRegrets:regrets,extraLabelReason:'large teacher-measured candidate mistake; estimate units only'};}
        labels.push(ref);
      }
      for(const g of games.slice(0,j.exactLimit??4)) {
        const s=g.states.find(s=>64-s.board.filter(Boolean).length===(j.empties??8));if(!s) continue;
        try {
          const ref=solveIndependent(s.board,s.player,{maxMs:j.exactMs??2000});
          // Independent exact data must agree with the original production core.
          const own=findBestMove(s.board,s.player,j.empties??8,undefined,{legalMoves:legalMovesFast});
          if(!own.exact||decodeTerminal(own.score)!==ref.value) throw new Error('Independent exact disagreement');
          labels.push({...s,...ref,gameId:g.id});
        } catch(e) {if(!e.message.includes('cap')) throw e;skipped.push({key:s.key,reason:e.message});}
      }
      return {labels,skipped};
    }
    case 'fit': {
      const m=load(j.model),g=gamesFrom(j.paths),dev=gamesFrom(j.development),refs=refsFrom(j.labels);
      const r=fit(m,g,refs,dev,{...j,countGames:gamesFrom(j.countPaths??j.paths),countLabels:refsFrom(j.countLabels??j.labels)});return {...r,model:pack(r.model)};
    }
    case 'assess': {
      const games=gamesFrom(j.paths),refs=refsFrom(j.labels),states=games.flatMap(g=>g.states.filter((_,i)=>i%8===0)).slice(0,90),training=gamesFrom(j.calibrationPaths??[]),gains=calibrateBaseline(training);
      return {metrics:j.models.map(p=>{const m=load(p);return {id:m==='B'?'B':m.id,prediction:prediction(m,games,m==='B'?{gains}:{}),outcomePrediction:m==='B'?prediction(m,games,{gains:calibrateBaseline(training,'outcome'),objective:'outcome'}):null,ranking:ranking(m,refs),depth3:j.deep?ranking(m,refs.filter(r=>r.kind==='exact').slice(0,32),3):null,speed:speed(m,states,{calls:j.calls??3000})};})};
    }
    case 'pair': {
      const a=evaluator(j.candidate==='B'?'B':read(j.candidate)),b=evaluator(j.opponent==='B'?'B':read(j.opponent)),games=[];
      for(const color of j.index%2?[-1,1]:[1,-1]) {
        const r=game(j.opening,color===1?a:b,color===-1?a:b,j.budget);games.push({...r,candidateColor:color,outcome:r.winner*color});
      }
      return {index:j.index,opening:j.opening,budget:j.budget,games,point:games.reduce((s,g)=>s+(g.outcome>0?1:g.outcome===0?0.5:0),0)/2};
    }
    case 'diagnostics': {
      const refs=refsFrom(j.labels).filter(r=>r.kind==='exact'),m=load(j.model),e=compile(m),positions=[];
      for(const ref of refs) {
        const a=findBestMove(ref.board,ref.player,1,undefined,{legalMoves:legalMovesFast}),b=findBestMove(ref.board,ref.player,1,undefined,{legalMoves:legalMovesFast,evaluate:e.evaluate});
        if(a.move===b.move) continue;
        const av=ref.rows.find(r=>r.move===a.move).margin,bv=ref.rows.find(r=>r.move===b.move).margin;
        if(av===bv) continue;
        positions.push({...ref,baseline:{move:a.move,margin:av,...exactContinuation(ref,a.move)},candidate:{move:b.move,margin:bv,...exactContinuation(ref,b.move)}});
        if(positions.length>=6) break;
      }
      return {positions};
    }
    default: throw new Error(`Unknown job ${j.type}`);
  }
}
parentPort.on('message',async({id,job})=>{
  const start=performance.now();try {const result=await task(job);parentPort.postMessage({id,ok:true,result,wallMs:performance.now()-start});}
  catch(e) {parentPort.postMessage({id,ok:false,error:e.stack??String(e),wallMs:performance.now()-start});}
});
