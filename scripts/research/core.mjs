// Offline research primitives. No browser imports this module.
import { counts, legalMoves, play, initialBoard, nextPlayer, isTerminal } from '../../src/rules.js';
import { DEFAULT_WEIGHTS, FEATURE_NAMES } from '../../src/features.js';
import { extractFeaturesFast, evaluateFast, legalMovesFast } from '../../src/fast-features.js';
import { stableEdgeFeature, makeFastStableEvaluator } from '../../src/evaluation.js';
import { findBestMove, terminalScore } from '../../src/search.js';
import { seededRandom } from '../../src/learning.js';
import { oracleChildren, oracleScore } from '../../tests/oracle.mjs';

export const VERSION = 'local-research-v1';
export const PHASES = ['opening', 'middle', 'endgame'];
export const BASE = Object.keys(FEATURE_NAMES);
export const EXTRA = ['stable', 'access', 'danger', 'edge', 'parity'];
export const FEATURES = [...BASE, ...EXTRA];
export const MAPS = Array.from({length:8}, (_,s) => Array.from({length:64}, (_,i) => {
  let r=i>>3,c=i&7;
  if(s>=4) c=7-c;
  for(let k=0;k<s%4;k++) [r,c]=[c,7-r];
  return r*8+c;
}));
export function canonical(board, player=1) {
  // Relative colors merge simultaneous color reversal and side reversal.
  return MAPS.map(map => map.map(i => board[i]*player+1).join('')).sort()[0];
}
export const PATTERNS = [
  {name:'corner', squares:[0,1,2,8,9,10]},
  {name:'edge', squares:[0,1,2,3,4,5,6,7]},
  {name:'diagonal', squares:[9,18,27,36,45,54]},
];
let offset=FEATURES.length*3;
for(const pattern of PATTERNS) {pattern.offset=offset;pattern.size=3**pattern.squares.length;offset+=pattern.size*3;}
export const PARAMS = offset;
export function phaseMix(board, smooth=false) {
  const occupied=64-counts(board).empty;
  if(!smooth) return [[occupied<28?0:occupied<52?1:2,1]];
  const first=occupied<=40?0:1;
  const t=Math.max(0,Math.min(1,occupied<=40?(occupied-4)/36:(occupied-40)/24));
  return [[first,1-t],[first+1,t]];
}
export function extras(board, active=EXTRA) {
  const needsMoves=active.includes('access')||active.includes('danger');
  const movesB=needsMoves?legalMovesFast(board,1):[],movesW=needsMoves?legalMovesFast(board,-1):[];
  const corners=[0,7,56,63], emptyCorners=corners.filter(i=>!board[i]);
  const access=active.includes('access')?emptyCorners.reduce((s,i)=>s+Number(movesB.includes(i))-Number(movesW.includes(i)),0)/4:0;
  // Distinct from occupancy: noncorner discs adjacent to an opponent-accessible
  // corner count as exposure; symmetric in colors, invariant under D4.
  let danger=0,edge=0;
  if(active.includes('danger')) for(const corner of emptyCorners) {
    const neighbors=Array.from({length:64},(_,i)=>i).filter(i=>i!==corner&&Math.abs((i>>3)-(corner>>3))<=1&&Math.abs((i&7)-(corner&7))<=1);
    if(movesW.includes(corner)) danger-=neighbors.filter(i=>board[i]===1).length/12;
    if(movesB.includes(corner)) danger+=neighbors.filter(i=>board[i]===-1).length/12;
  }
  if(active.includes('edge')) for(const line of [[0,1,2,3,4,5,6,7],[56,57,58,59,60,61,62,63],[0,8,16,24,32,40,48,56],[7,15,23,31,39,47,55,63]]) {
    for(let k=1;k<7;k++) if(board[line[k]] && !board[line[k-1]] && !board[line[k+1]]) edge-=board[line[k]]/24;
  }
  // Region statistic: boundary ownership of odd orthogonal empty components.
  // Antisymmetric, deliberately not the common side-to-move parity constant.
  const visited=new Set();let parity=0;
  if(active.includes('parity')&&counts(board).empty<=20) for(let i=0;i<64;i++) if(!board[i]&&!visited.has(i)) {
    const queue=[i],boundary=new Set();visited.add(i);
    for(let q=0;q<queue.length;q++) for(const [dr,dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const r=(queue[q]>>3)+dr,c=(queue[q]&7)+dc;
      if(r<0||r>7||c<0||c>7) continue;
      const j=r*8+c;
      if(board[j]) boundary.add(j);
      else if(!visited.has(j)) {visited.add(j);queue.push(j);}
    }
    if(queue.length%2) parity+=[...boundary].reduce((s,j)=>s+board[j],0)/Math.max(1,boundary.size);
  }
  return [active.includes('stable')?stableEdgeFeature(board,1):0,access,danger,edge,parity/16];
}
export function makeModel(id, family='linear', method='sgd', options={}) {
  const model={id,family,method,target:'margin',smooth:false,extra:[],rate:0.025,l2:0.0003,lambda:0.7,epochs:0,...options};
  model.weights=Array(family==='pattern'||family==='hybrid'?PARAMS:FEATURES.length*3).fill(0);
  if(family!=='pattern') for(let phase=0;phase<3;phase++) BASE.forEach((key,i)=>{model.weights[phase*FEATURES.length+i]=DEFAULT_WEIGHTS[PHASES[phase]][key];});
  return model;
}
export function candidates() {
  const models=[makeModel('linear-sgd'),makeModel('linear-outcome','linear','sgd',{target:'outcome'}),
    makeModel('linear-coordinate','linear','coordinate'),makeModel('linear-smooth','linear','sgd',{smooth:true}),
    makeModel('td-lambda','linear','td',{extra:EXTRA}),makeModel('td-zero','linear','td',{lambda:0,extra:EXTRA})];
  for(const name of EXTRA) models.push(makeModel(`add-${name}`,'linear','sgd',{extra:[name]}));
  for(const name of ['mobility','potential','frontier']) models.push(makeModel(`remove-${name}`,'linear','sgd',{omit:[name]}));
  models.push(makeModel('patterns','pattern','sgd',{rate:0.08}),makeModel('patterns-outcome','pattern','sgd',{rate:0.08,target:'outcome'}),
    makeModel('hybrid','hybrid','sgd',{extra:EXTRA,rate:0.04}));
  return models;
}
export function vector(board, model) {
  const mix=phaseMix(board,model.smooth), entries=new Map();
  const add=(i,v)=>{if(v) entries.set(i,(entries.get(i)??0)+v);};
  if(model.family!=='pattern') {
    const f=extractFeaturesFast(board,1),extra=model.extra?.length?extras(board,model.extra):[];
    for(const [phase,weight] of mix) {
      BASE.forEach((key,i)=>{if(!model.omit?.includes(key)) add(phase*FEATURES.length+i,f[key]*weight);});
      EXTRA.forEach((key,i)=>{if(model.extra?.includes(key)) add(phase*FEATURES.length+BASE.length+i,extra[i]*weight);});
    }
  }
  if(model.family==='pattern'||model.family==='hybrid') for(const pattern of PATTERNS) {
    if(model.omitPatterns?.includes(pattern.name)) continue;
    for(const map of MAPS) {
      let code=0,reverse=0,power=1;
      for(const square of pattern.squares) {
        const value=board[map[square]];
        code+=(value+1)*power;reverse+=(1-value)*power;power*=3;
      }
      for(const [phase,weight] of mix) {
        add(pattern.offset+phase*pattern.size+code,weight/16);
        add(pattern.offset+phase*pattern.size+reverse,-weight/16);
      }
    }
  }
  return [...entries].filter(([,v])=>v!==0);
}
export const dot=(weights,x)=>x.reduce((s,[i,v])=>s+weights[i]*v,0);
export const target=(game,kind)=>kind==='outcome'?100*Math.sign(game.margin):100*game.margin/64;
export function predictionValue(model,board) {
  const raw=engine(model).evaluate(board,1);
  const gain=model.predictionGains?.[model.target??'margin']?.[phaseMix(board)[0][0]];
  return raw*(gain??1);
}
export function calibratePrediction(model,games) {
  // A zero-intercept per-phase scalar fit on training only. This calibrates
  // prediction metrics; the playing evaluator and all search scores stay raw.
  const e=engine(model),predictionGains={};
  for(const kind of ['margin','outcome']) {
    const sums=Array.from({length:3},()=>({xy:0,xx:0,n:0}));
    for(const game of games) for(let j=0;j<game.states.length;j+=4) {
      const s=game.states[j],x=e.evaluate(s.board,1),group=sums[phaseMix(s.board)[0][0]];
      group.xy+=x*target(game,kind);group.xx+=x*x;group.n++;
    }
    predictionGains[kind]=sums.map(g=>g.xx?g.xy/g.xx:1);
  }
  return {...model,predictionGains,predictionCalibration:'zero-intercept phase gains fitted on training outcomes only; never used in search'};
}
export function engine(model, searchOptions={}) {
  let evaluate;
  if(model.id==='B') evaluate=evaluateFast;
  else if(model.id==='C') evaluate=makeFastStableEvaluator(60);
  else evaluate=(board,player)=>Math.max(-1000,Math.min(1000,dot(model.weights,vector(board,model))))*player;
  return {name:model.id,evaluate,...searchOptions};
}
export function predictionLoss(model,games) {
  // Each trajectory has equal mass; correlated positions are not independent N.
  let loss=0,positions=0;const phases=[{sum:0,n:0},{sum:0,n:0},{sum:0,n:0}];
  for(const game of games) {
    let sum=0,n=0;
    for(let j=0;j<game.states.length;j+=4) {
      const state=game.states[j],error=predictionValue(model,state.board)-target(game,model.target??'margin');
      const squared=error*error;sum+=squared;n++;positions++;
      const group=phases[phaseMix(state.board)[0][0]];group.sum+=squared;group.n++;
    }
    if(n) loss+=sum/n;
  }
  return {mse:games.length?loss/games.length:null,games:games.length,positions,
    byPhase:phases.map(p=>({positions:p.n,mse:p.n?p.sum/p.n:null})),target:model.target??'margin',calibration:model.predictionCalibration??(['B','C'].includes(model.id)?'uncalibrated fallback; no margin interpretation':'model fitted directly to the stated target')};
}
export function fit(model,train,development,{epochs=1,seed=1,deadline=Infinity}={}) {
  const rng=seededRandom(seed),weights=[...model.weights],curve=[];
  const examples=train.map(game=>({game,x:game.states.filter((_,i)=>model.method==='td'||i%4===0).map(s=>vector(s.board,model))}));
  const devX=development.map(game=>({game,x:game.states.filter((_,i)=>i%4===0).map(s=>vector(s.board,model))}));
  const loss=()=>devX.length?devX.reduce((s,{game,x})=>s+x.reduce((a,v)=>a+(dot(weights,v)-target(game,model.target))**2,0)/Math.max(1,x.length),0)/devX.length:null;
  let done=0;
  for(let epoch=0;epoch<epochs&&performance.now()<deadline;epoch++) {
    if(model.method==='coordinate') {
      const rows=examples.flatMap(({game,x})=>x.map(v=>({x:v,y:target(game,model.target)})));
      // Exact one-dimensional regularized least-squares update, no arbitrary
      // judgments about signs. Only active feature coordinates are eligible.
      const dimensions=[...new Set(rows.flatMap(r=>r.x.map(([i])=>i)))];
      for(const dimension of dimensions) {
        let numerator=0,denominator=model.l2*rows.length;
        for(const row of rows) {
          const value=row.x.find(([i])=>i===dimension)?.[1]??0;
          numerator+=value*(row.y-dot(weights,row.x)+weights[dimension]*value);denominator+=value*value;
        }
        if(denominator) weights[dimension]=Math.max(-500,Math.min(500,numerator/denominator));
      }
    } else {
      // Seeded Fisher-Yates game order. States within TD trajectories stay ordered.
      const order=[...examples];for(let i=order.length-1;i>0;i--) {const j=Math.floor(rng()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
      for(const {game,x} of order) {
        if(model.method==='td') {
          const eligibility=new Map();
          for(let j=0;j<x.length;j++) {
            const before=dot(weights,x[j]),next=j+1<x.length?dot(weights,x[j+1]):target(game,model.target);
            for(const [i,v] of eligibility) {const decayed=v*model.lambda;if(Math.abs(decayed)<1e-8) eligibility.delete(i);else eligibility.set(i,decayed);}
            for(const [i,v] of x[j]) eligibility.set(i,(eligibility.get(i)??0)+v);
            const norm=Math.max(1,[...eligibility.values()].reduce((s,v)=>s+v*v,0));
            for(const [i,v] of eligibility) weights[i]=Math.max(-500,Math.min(500,weights[i]+model.rate*((next-before)*v/norm-model.l2*weights[i])));
          }
        } else for(let j=0;j<x.length;j++) {
          const error=target(game,model.target)-dot(weights,x[j]);
          const norm=Math.max(1,x[j].reduce((s,[,v])=>s+v*v,0));
          for(const [i,v] of x[j]) weights[i]=Math.max(-500,Math.min(500,weights[i]+model.rate*(error*v/norm-model.l2*weights[i])));
        }
      }
    }
    done++;curve.push({epoch:model.epochs+done,developmentMse:loss()});
    if(weights.some(w=>!Number.isFinite(w))) throw new Error('Divergent fit');
  }
  return {model:{...model,weights,epochs:model.epochs+done},curve};
}

export function generateGame({seed,split,index,openingPlies=8,depth=1}) {
  const rng=seededRandom(seed);let board=initialBoard(),player=1,placements=0;
  const states=[],prefixes=[],movesLog=[];
  const exploratory=makeModel('exploratory','linear','sgd',{extra:EXTRA});
  for(let phase=0;phase<3;phase++) [30,60,30,20,5].forEach((w,i)=>{exploratory.weights[phase*FEATURES.length+BASE.length+i]=w;});
  const policy=index%4, evaluator=policy===1?makeFastStableEvaluator(60):policy===2?engine(exploratory).evaluate:evaluateFast;
  while(player!==null) {
    const moves=legalMoves(board,player);
    if(!moves.length) {movesLog.push({player,move:null});player=legalMoves(board,-player).length?-player:null;continue;}
    if(placements>=16) states.push({board:[...board],player,placements});
    if(placements===8||placements===12) prefixes.push({board:[...board],player});
    let move;
    const exploration=policy===3?0.18:0.06;
    if(placements<openingPlies||rng()<exploration) move=moves[Math.floor(rng()*moves.length)];
    else move=findBestMove(board,player,depth,undefined,{evaluate:evaluator,legalMoves:legalMovesFast}).move;
    movesLog.push({player,move});board=play(board,player,move);player=nextPlayer(board,player);placements++;
  }
  const count=counts(board);
  return {id:`${split}-${index}`,split,index,seed,policy:{name:['B','C','exploratory-linear','B-exploratory'][policy],depth,openingPlies,exploration:policy===3?0.18:0.06},
    states,prefixes,moves:movesLog,margin:count.black-count.white,outcome:Math.sign(count.black-count.white),terminal:[...board],labelQuality:'completed behavior-policy outcome, not minimax'};
}
export const decodeTerminal=score=>score>9000?score-10000:score< -9000?score+10000:score;
export function exactReference(state) {
  const children=oracleChildren(state.board,state.player);
  const rows=children.map(c=>({move:c.move,margin:decodeTerminal(-oracleScore(c.board,-state.player))}));
  const actual=decodeTerminal(findBestMove(Int8Array.from(state.board),state.player,Math.max(1,counts(state.board).empty)).score);
  const expected=rows.length?Math.max(...rows.map(r=>r.margin)):decodeTerminal(oracleScore(state.board,state.player));
  if(actual!==expected) throw new Error('Independent exact solver disagrees with alpha-beta');
  return {...state,rows,value:expected,kind:'independent exact final-disc margin'};
}
export function exactLine(state,firstMove) {
  let board=[...state.board],player=state.player;const line=[];
  if(firstMove!==undefined) {const c=oracleChildren(board,player).find(c=>c.move===firstMove);if(!c) throw new Error('Illegal diagnostic move');board=c.board;line.push({player,move:firstMove});player=-player;}
  for(let n=0;n<128;n++) {
    const children=oracleChildren(board,player);
    if(!children.length) {if(!oracleChildren(board,-player).length) break;line.push({player,move:null});player=-player;continue;}
    const values=children.map(c=>-oracleScore(c.board,-player));
    const child=children[values.indexOf(Math.max(...values))];line.push({player,move:child.move});board=child.board;player=-player;
  }
  return {line,terminal:board,margin:board.reduce((s,v)=>s+v,0)*state.player};
}
export function quality(model,references,depth=1) {
  const e=engine(model),records=[];
  for(const ref of references) {
    if(!ref.rows.length) continue;
    const choice=findBestMove(Int8Array.from(ref.board),ref.player,depth,undefined,{evaluate:e.evaluate});
    const row=ref.rows.find(r=>r.move===choice.move);if(!row) throw new Error('Reference missing legal move');
    const value=ref.kind.startsWith('independent')?'margin':'estimate';
    const predicted=ref.rows.map(r=>{
      const child=play(ref.board,ref.player,r.move);
      if(depth>1) return -findBestMove(child,-ref.player,depth-1,undefined,{evaluate:e.evaluate}).score;
      return isTerminal(child)?terminalScore(child,ref.player):e.evaluate(child,ref.player);
    });
    records.push({move:choice.move,regret:Math.max(...ref.rows.map(r=>r[value]))-row[value],spearman:spearman(predicted,ref.rows.map(r=>r[value]))});
  }
  return {positions:records.length,depth,optimal:records.filter(r=>r.regret===0).length,
    meanRegret:records.length?records.reduce((s,r)=>s+r.regret,0)/records.length:null,
    meanSpearman:records.some(r=>r.spearman!==null)?records.filter(r=>r.spearman!==null).reduce((s,r)=>s+r.spearman,0)/records.filter(r=>r.spearman!==null).length:null,
    units:references[0]?.kind??'none',records};
}
export function spearman(a,b) {
  if(a.length!==b.length||a.length<2) return null;
  const rank=values=>values.map(v=>values.filter(x=>x>v).length+(values.filter(x=>x===v).length-1)/2);
  const x=rank(a),y=rank(b),mean=(a.length-1)/2;
  let xy=0,xx=0,yy=0;for(let i=0;i<x.length;i++) {xy+=(x[i]-mean)*(y[i]-mean);xx+=(x[i]-mean)**2;yy+=(y[i]-mean)**2;}
  return xx&&yy?xy/Math.sqrt(xx*yy):null;
}
export function exactPrediction(model,references) {
  const errors=references.filter(r=>r.kind.startsWith('independent')).map(r=>{
    const blackMargin=r.value*r.player;
    const expected=model.target==='outcome'?100*Math.sign(blackMargin):100*blackMargin/64;
    return predictionValue(model,r.board)-expected;
  });
  return {positions:errors.length,target:model.target??'margin',mse:errors.length?errors.reduce((s,e)=>s+e*e,0)/errors.length:null,
    mae:errors.length?errors.reduce((s,e)=>s+Math.abs(e),0)/errors.length:null,units:'100 * exact Black margin / 64, or 100 * outcome sign as specified by target'};
}
export function pairInterval(points,{comparisons=1,maxPairs=1,alpha=0.05}={}) {
  if(!points.length) return {pairs:0,mean:null,interval:[0,1]};
  const mean=points.reduce((s,x)=>s+x,0)/points.length;
  const radius=Math.sqrt(Math.log(2*comparisons*maxPairs/alpha)/(2*points.length));
  return {pairs:points.length,mean,interval:[Math.max(0,mean-radius),Math.min(1,mean+radius)]};
}
export function shortlist(metrics,models,limit=4) {
  // MSEs for different targets must never be compared directly. Percent error
  // relative to B at that target makes screening scales explicit.
  const sorted=[...metrics].filter(m=>Number.isFinite(m.relativeMse)).sort((a,b)=>a.relativeMse-b.relativeMse||a.id.localeCompare(b.id));
  const selected=[],families=new Set();
  for(const m of sorted) {
    const model=models.find(c=>c.id===m.id),family=model.family;
    if(families.has(family)) continue;families.add(family);selected.push(m.id);
    if(selected.length===limit) return selected;
  }
  for(const m of sorted) if(!selected.includes(m.id)&&selected.length<limit) selected.push(m.id);
  return selected;
}
