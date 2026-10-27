import { parentPort } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { Session } from 'node:inspector';
import { promisify } from 'node:util';
import { legalMoves, play, nextPlayer, counts, winner, initialBoard } from '../../src/rules.js';
import { legalMovesFast, evaluateFast } from '../../src/fast-features.js';
import { evaluate } from '../../src/features.js';
import { findBestMove } from '../../src/search.js';
import { randomOpening, seededRandom } from '../../src/learning.js';
import { oracleChildren } from '../../tests/oracle.mjs';
import { generateGame, exactReference, exactLine, exactPrediction, calibratePrediction, engine, fit, predictionLoss, quality, makeModel, EXTRA, PATTERNS } from './core.mjs';

const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const read=path=>JSON.parse(readFileSync(path,'utf8'));
async function calibration({smoke,seed}) {
  const positions=[8,28,52].flatMap(plies=>[0,1,2].map(i=>({...randomOpening(seededRandom(seed+i),plies),plies})));
  for(const p of positions) for(const side of [1,-1]) {
    const expected=legalMoves(p.board,side);
    if(JSON.stringify(expected)!==JSON.stringify(legalMovesFast(p.board,side))||JSON.stringify(expected)!==JSON.stringify(oracleChildren(p.board,side).map(c=>c.move))) throw new Error('Move generation mismatch');
    if(evaluate(p.board,side)!==evaluateFast(p.board,side)) throw new Error('A/B mismatch');
  }
  const component=[];let checksum=0;
  const calls=smoke?300:6000;
  for(const plies of [8,28,52]) {
    const ps=positions.filter(p=>p.plies===plies),fns={A:p=>evaluate(p.board,p.player),B:p=>evaluateFast(p.board,p.player),
      movesOriginal:p=>legalMoves(p.board,p.player).length,movesFast:p=>legalMovesFast(p.board,p.player).length};
    for(const fn of Object.values(fns)) for(let i=0;i<calls;i++) checksum+=fn(ps[i%ps.length]);
    const samples=Object.fromEntries(Object.keys(fns).map(k=>[k,[]]));
    for(let repetition=0;repetition<5;repetition++) for(let offset=0;offset<4;offset++) {
      const name=Object.keys(fns)[(repetition+offset)%4],start=performance.now();
      for(let i=0;i<calls;i++) checksum+=fns[name](ps[i%ps.length]);
      samples[name].push((performance.now()-start)*1000/calls);
    }
    for(const [name,s] of Object.entries(samples)) component.push({plies,name,microseconds:median(s),samples:s});
  }
  const variants=[{id:'original',options:{}},{id:'fast-moves',options:{legalMoves:legalMovesFast}},
    {id:'fast-hints',options:{legalMoves:legalMovesFast,orderingHints:true}}];
  const searches=[];
  for(let rep=0;rep<3;rep++) for(const p of positions) {
    let reference;
    for(let offset=0;offset<variants.length;offset++) {
      const v=variants[(offset+rep)%variants.length],start=performance.now();
      // A constant clock completes all iterative depths deterministically.
      const result=findBestMove(p.board,p.player,smoke?3:5,undefined,{...v.options,timeMs:1,now:()=>0});
      const elapsedMs=performance.now()-start;
      if(reference!==undefined&&result.score!==reference) throw new Error('Research search option changed minimax score');
      reference=result.score;searches.push({id:v.id,rep,plies:p.plies,elapsedMs,nodes:result.nodes,evaluations:result.evaluations,depth:result.depth});
    }
  }
  const times=id=>searches.filter(s=>s.id===id).reduce((s,r)=>s+r.elapsedMs,0);
  const fast=times('original')/times('fast-moves')>1.05;
  const hints=fast&&times('fast-moves')/times('fast-hints')>1.05;
  const session=new Session();session.connect();const post=promisify(session.post.bind(session));
  let profileSummary;
  try {
    await post('Profiler.enable');await post('Profiler.start');
    for(let n=0;n<(smoke?1:4);n++) for(const p of positions) findBestMove(p.board,p.player,smoke?3:5);
    const {profile}=await post('Profiler.stop'),hit=new Map();
    for(const node of profile.nodes) if(node.hitCount) hit.set(node.callFrame.functionName,(hit.get(node.callFrame.functionName)??0)+node.hitCount);
    profileSummary=[...hit].map(([name,samples])=>({name,samples})).sort((a,b)=>b.samples-a.samples).slice(0,20);
  } finally {session.disconnect();}
  return {component,searches,profileSummary,options:{fastMoves:fast,orderingHints:hints},checksum};
}
function dataset(paths) {return paths.flatMap(path=>read(path).games??[]);}
function references(paths) {return paths.flatMap(path=>read(path).references??[]);}
function researchOptions(options={}) {return {legalMoves:options.fastMoves?legalMovesFast:legalMoves,orderingHints:options.orderingHints};}
function modelCost(model,games) {
  const states=games.flatMap(g=>g.states.filter((_,i)=>i%8===0)).slice(0,120),e=engine(model);
  if(!states.length) return null;
  let sum=0;for(let i=0;i<100;i++) for(const s of states.slice(0,10)) sum+=e.evaluate(s.board,s.player);
  const samples=[];
  for(let rep=0;rep<3;rep++) {const start=performance.now();for(let i=0;i<5;i++) for(const s of states) sum+=e.evaluate(s.board,s.player);samples.push((performance.now()-start)*1000/(5*states.length));}
  return {microseconds:median(samples),samples,checksum:sum};
}
function playGame(opening,black,white,budget,options,candidateColor,opponentDepth) {
  let board=Int8Array.from(opening.board),player=opening.player;const stats={black:[],white:[]},trajectory=[];
  for(let n=0;player!==null&&n<128;n++) {
    const moves=legalMoves(board,player);
    if(!moves.length) {player=legalMoves(board,-player).length?-player:null;continue;}
    const e=player===1?black:white,cpu=process.cpuUsage(),start=performance.now();
    const depth=opponentDepth&&player!==candidateColor?opponentDepth:(budget.depth??14);
    const r=findBestMove(board,player,depth,undefined,{evaluate:e.evaluate,...researchOptions(options),timeMs:budget.timeMs});
    const used=process.cpuUsage(cpu),wallMs=performance.now()-start;
    if(!moves.includes(r.move)) throw new Error('Tournament illegal move');
    stats[player===1?'black':'white'].push({depth:r.depth,nodes:r.nodes,evaluations:r.evaluations,wallMs,cpuMs:(used.user+used.system)/1000,
      overrunMs:budget.timeMs?Math.max(0,wallMs-budget.timeMs):0,fallback:r.depth===0});
    trajectory.push({player,move:r.move});board=play(board,player,r.move);player=nextPlayer(board,player);
  }
  if(player!==null) throw new Error('Tournament incomplete game');
  return {winner:winner(board),margin:counts(board).black-counts(board).white,stats,trajectory};
}
async function task(job) {
  switch(job.type) {
    case 'calibrate': return calibration(job);
    case 'generate': return {games:[generateGame(job)]};
    case 'label': {
      const games=dataset(job.paths),refs=[];let exactMs=0,exactN=0;
      for(const game of games) {
        const state=game.states.find(s=>counts(s.board).empty===job.empties);
        if(state) {const start=performance.now();refs.push({...exactReference(state),gameId:game.id});exactMs+=performance.now()-start;exactN++;}
        if(job.deep&&refs.length<job.limit*2) {
          const p=game.states.find(s=>s.placements===(game.index%2?28:16));
          if(p&&legalMoves(p.board,p.player).length) {
            const rows=legalMoves(p.board,p.player).map(move=>({move,estimate:-findBestMove(play(p.board,p.player,move),-p.player,job.deep-1).score}));
            refs.push({...p,rows,kind:`approximate depth-${job.deep} B search units (may include terminal sentinels)`,gameId:game.id});
          }
        }
        if(exactN>=job.limit) break;
      }
      return {references:refs,exactMs,exactN,empties:job.empties};
    }
    case 'train': {
      const model=read(job.model),train=dataset(job.train),dev=dataset(job.development);
      // Exact labels supplement, never overwrite, completed-outcome trajectories.
      for(const ref of references(job.references??[]).filter(r=>r.kind.startsWith('independent'))) train.push({id:`exact-${ref.gameId}`,states:[ref],margin:ref.value*ref.player,outcome:Math.sign(ref.value*ref.player)});
      const result=fit(model,train,dev,{epochs:job.epochs,seed:job.seed,deadline:performance.now()+job.maxMs});
      return {...result,loss:predictionLoss(result.model,dev)};
    }
    case 'calibrate-predictions': return {models:job.models.map(path=>calibratePrediction(read(path),dataset(job.paths)))};
    case 'assess': {
      const models=job.models.map(p=>read(p)),games=dataset(job.paths),refs=references(job.references??[]),metrics=[];
      for(const model of models) {
        const loss=predictionLoss(model,games),baseline=predictionLoss({...read(job.baseline),target:model.target??'margin'},games);
        const exact=refs.filter(r=>r.kind.startsWith('independent')),approximate=refs.filter(r=>!r.kind.startsWith('independent'));
        metrics.push({id:model.id,family:model.family,target:loss.target,loss,relativeMse:loss.mse/Math.max(1e-12,baseline.mse),cost:modelCost(model,games),
          exactPrediction:exactPrediction(model,exact),exact:[1,3].map(depth=>quality(model,exact,depth)),approximate:quality(model,approximate,1)});
      }
      return {metrics};
    }
    case 'pair': {
      const a=read(job.candidate),b=read(job.opponent),games=[];
      for(const color of job.index%2?[-1,1]:[1,-1]) {
        const result=playGame(job.opening,engine(color===1?a:b),engine(color===-1?a:b),job.budget,job.options,color,job.opponentDepth);
        games.push({...result,candidateColor:color,outcome:result.winner*color});
      }
      return {candidate:a.id,opponent:b.id,budget:job.budget,opponentDepth:job.opponentDepth,index:job.index,opening:job.opening,games,
        point:games.reduce((s,g)=>s+(g.outcome>0?1:g.outcome===0?0.5:0),0)/2};
    }
    case 'ablations': {
      const model=read(job.model),games=dataset(job.paths),base=predictionLoss(model,games),results=[];
      for(const key of [...new Set([...Object.keys(DEFAULT_FEATURES),...(model.extra??[])])]) {
        const variant={...model,omit:[...(model.omit??[]),key],extra:(model.extra??[]).filter(k=>k!==key)};
        const loss=predictionLoss(variant,games);results.push({group:key,mse:loss.mse,deltaMse:loss.mse-base.mse});
      }
      for(const p of PATTERNS) if(model.family==='pattern'||model.family==='hybrid') {
        const loss=predictionLoss({...model,omitPatterns:[p.name]},games);results.push({group:`pattern-${p.name}`,mse:loss.mse,deltaMse:loss.mse-base.mse});
      }
      return {id:model.id,base,results,interpretation:'frozen-model removal; interactions remain; not refitted causal attribution'};
    }
    case 'diagnostics': {
      const models=job.models.map(read),refs=references(job.references).filter(r=>r.kind.startsWith('independent')),positions=[];
      for(const ref of refs) {
        const choices=models.flatMap(m=>[1,3].map(depth=>{
          const result=findBestMove(ref.board,ref.player,depth,undefined,{evaluate:engine(m).evaluate});
          return {id:m.id,depth,move:result.move,score:result.score,scoreKind:result.exact?'terminal search sentinel':'heuristic minimax'};
        }));
        if(new Set(choices.map(c=>c.move)).size>1) positions.push({...ref,choices:choices.map(c=>({...c,...exactLine(ref,c.move)}))});
        if(positions.length===3) break;
      }
      return {positions};
    }
    default: throw new Error(`Unknown task ${job.type}`);
  }
}
// Names only, to keep ablation enumeration explicit without browser coupling.
const DEFAULT_FEATURES={mobility:0,potential:0,corners:0,xSquares:0,cSquares:0,frontier:0,discs:0};
parentPort.on('message',async ({id,job})=>{
  const start=performance.now(),cpu=process.cpuUsage();
  try {const result=await task(job),usage=process.cpuUsage(cpu);parentPort.postMessage({id,ok:true,result,
    wallMs:performance.now()-start,cpuMs:(usage.user+usage.system)/1000});}
  catch(error) {parentPort.postMessage({id,ok:false,error:error.stack??String(error),wallMs:performance.now()-start});}
});
