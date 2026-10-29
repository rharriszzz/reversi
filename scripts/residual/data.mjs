import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initialBoard, play, counts, legalMoves } from '../../src/rules.js';
import { legalMovesFast } from '../../src/fast-features.js';
import { findBestMove } from '../../src/search.js';
import { seededRandom } from '../../src/learning.js';
import { canonical } from '../research/core.mjs';
import { loadHistorical } from '../teacher/qualification-data.mjs';
import { read, seedFor } from '../research/io.mjs';
import { PROTOCOL, hash } from './protocol.mjs';
import { childEncoding } from './model.mjs';
export const keyFor=(board,player)=>hash(canonical(board,player));
export const keysFor=board=>[keyFor(board,1),keyFor(board,-1)];

export function generate(spec,attempt,protocol=PROTOCOL) {
  const start=performance.now(),seed=seedFor(protocol.namespace,spec.role,attempt),rng=seededRandom(seed);
  const [lo,hi]=protocol.strata[spec.phase],targets=Array.from({length:hi-lo+1},(_,i)=>lo+i).filter(x=>x%2===spec.parity);
  const target=spec.occupied??targets[Math.floor(rng()*targets.length)];
  // Always consume exactly one draw for the target, including fixed game openings.
  if(spec.occupied!==undefined) rng();
  let board=[...initialBoard()],player=1,passes=0,root=null;const history=[],moves=[];
  while(passes<2) {
    const occupied=64-counts(board).empty,legal=legalMovesFast(board,player);
    if(occupied>=protocol.commonPrefixBoundary) history.push({board:[...board],player});
    if(!root&&occupied===target&&player===spec.player&&legal.length>=2) root={board:[...board],player};
    if(!legal.length){passes++;moves.push({player,move:null});player=-player;continue;}passes=0;
    const random=occupied<12||rng()<(spec.policy==='B4-2%'?.02:.12);
    const move=random?legal[Math.floor(rng()*legal.length)]:findBestMove(board,player,spec.policy==='B4-2%'?4:1,undefined,{legalMoves:legalMovesFast}).move;
    moves.push({player,move});board=[...play(board,player,move)];player=-player;
  }
  return {spec,attempt,seed,target,root,history,moves,terminal:board,wallMs:performance.now()-start};
}
export function verifyTrajectory(tr) {
  let board=[...initialBoard()],player=1,passes=0,found=false;const history=[];
  for(const step of tr.moves) {
    if(step.player!==player||passes===2) throw Error('Invalid trajectory turn/termination');
    if(64-counts(board).empty>=12) history.push({board:[...board],player});
    if(tr.root&&hash(tr.root)===hash({board,player})) found=true;
    const legal=legalMoves(board,player);
    if(step.move===null){if(legal.length) throw Error('Illegal trajectory pass');passes++;}
    else {if(!legal.includes(step.move)) throw Error('Illegal trajectory move');board=[...play(board,player,step.move)];passes=0;}
    player=-player;
  }
  if(!found||passes!==2||hash(board)!==hash(tr.terminal)||hash(history)!==hash(tr.history)) throw Error('Incomplete trajectory receipt');
  if(tr.root.player!==tr.spec.player||64-counts(tr.root.board).empty!==tr.target||tr.target%2!==tr.spec.parity) throw Error('Trajectory balance mismatch');
  return true;
}
export function trajectoryKeys(tr,frontier=null) {
  const set=new Set(tr.history.flatMap(s=>keysFor(s.board)));
  for(const move of legalMoves(tr.root.board,tr.root.player)) for(const k of keysFor(play(tr.root.board,tr.root.player,move))) set.add(k);
  for(const p of frontier?.parents??[]) {
    for(const k of keysFor(p.board)) set.add(k);
    for(const c of p.children) for(const k of keysFor(c.board)) set.add(k);
  }
  for(const line of frontier?.lines??[]) {
    let board=tr.root.board,player=tr.root.player;
    for(const step of line.steps) {if(step.move!==null)board=[...play(board,player,step.move)];player=-player;for(const k of keysFor(board))set.add(k);}
  }
  return set;
}

// Include complete historical trajectories AND teacher-query continuations.
// Existing qualification admission supplies the older campaign/fixture registry.
export function historical(repository,output) {
  const h=loadHistorical(repository,output),keys=new Set([...h.keys].map(hash));
  const local=resolve(repository,'.local-research');let pvBoards=0,tasks=0;
  const add=s=>{if(s?.board?.length===64)for(const k of keysFor(s.board))keys.add(k);};
  const addPV=(state,result)=>{
    if(!state?.board||!result?.rows)return;
    add(state);
    for(const row of result.rows){let board=[...state.board],player=state.player;
      if(row.move!==undefined&&row.move!==null){if(!legalMoves(board,player).includes(row.move))continue;board=[...play(board,player,row.move)];player=-player;add({board});}
      for(const move of row.pv??[]){
        if(move===null){if(legalMoves(board,player).length)throw Error('Historical PV pass mismatch');}
        else {if(!legalMoves(board,player).includes(move))throw Error('Historical PV move mismatch');board=[...play(board,player,move)];}
        player=-player;add({board});pvBoards++;
      }
    }
  };
  for(const name of readdirSync(local)) {
    const dir=resolve(local,name);if(dir===resolve(output))continue;
    if(name.startsWith('residual-')&&existsSync(`${dir}/reservation-progress.json`)) {
      const r=read(`${dir}/reservation-progress.json`);
      for(const root of r.roots??[]) {const tr=read(`${dir}/trajectories/${root.id}.json`),f=existsSync(`${dir}/frontiers/${root.id}.json`)?read(`${dir}/frontiers/${root.id}.json`).result:null;
        for(const key of trajectoryKeys(tr,f))keys.add(key);h.seeds.add(tr.seed);}
      if(existsSync(`${dir}/tasks`))for(const file of readdirSync(`${dir}/tasks`))if(file.endsWith('.json')) {
        const receipt=read(`${dir}/tasks/${file}`);
        if(receipt.job?.type==='label')addPV(receipt.job.state,receipt.result);
      }
    }
    if(!/^(teacher-|bound-)/.test(name)||!existsSync(`${dir}/tasks`))continue;
    for(const file of readdirSync(`${dir}/tasks`)) {
      if(!file.endsWith('.json')||file==='reservation.json')continue;
      const r=read(`${dir}/tasks/${file}`);tasks++;
      const state=r.input?.s??r.input?.state??r.state;
      if(state) {add(state);for(const move of legalMoves(state.board,state.player))add({board:[...play(state.board,state.player,move)]});}
      addPV(state,r.result??r);
      for(const d of Object.values(r.depths??{}))addPV(state,d);
    }
  }
  return {keys,seeds:h.seeds,audit:{...h.audit,pvBoards,tasks,hashedKeys:keys.size}};
}

export function preferences(root,frontier,labels) {
  const pairs=[],parents=[],pairKeys=new Map();
  for(const [index,parent] of frontier.parents.entries()) {
    const horizon=labels[index][10],reference=labels[index][12];
    const h=new Map(horizon.rows.map(r=>[r.move,r.value])),r=new Map(reference.rows.map(r=>[r.move,r.value]));
    const legal=legalMoves(parent.board,parent.player);
    if(h.size!==legal.length||r.size!==legal.length||legal.some(m=>!h.has(m)||!r.has(m))) throw Error('Incomplete common-depth teacher alternatives');
    const bestH=Math.max(...h.values()),bestR=Math.max(...r.values());
    const competitive=new Set(legal.filter(m=>bestH-h.get(m)<=2||bestR-r.get(m)<=2||m===parent.bChoice));
    const canonicalChildren=new Map(),representatives=[];
    for(const move of legal) {
      const child=parent.children.find(c=>c.move===move),key=keyFor(child.board,parent.player),old=canonicalChildren.get(key);
      if(old!==undefined) {
        if(h.get(old)!==h.get(move)||r.get(old)!==r.get(move))throw Error('Canonical sibling teacher values disagree');
        if(competitive.has(move))competitive.add(old);
      } else {canonicalChildren.set(key,move);representatives.push(move);}
    }
    let supported=0;
    for(const x of representatives) for(const y of representatives) {
      if(x===y||(!competitive.has(x)&&!competitive.has(y)))continue;
      const gapH=h.get(x)-h.get(y),gapR=r.get(x)-r.get(y);
      if(gapH<2||gapR<2)continue;
      const a=childEncoding(parent.children.find(c=>c.move===x).board,parent.player),b=childEncoding(parent.children.find(c=>c.move===y).board,parent.player);
      // Fixed terminal offsets participate, but terminal feature corrections are zero.
      const pairKey=hash([keyFor(parent.children.find(c=>c.move===x).board,parent.player),keyFor(parent.children.find(c=>c.move===y).board,parent.player)]);
      if(pairKeys.has(pairKey)){pairs[pairKeys.get(pairKey)].provenance.push({parent:index,preferred:x,other:y});continue;}
      pairKeys.set(pairKey,pairs.length);
      pairs.push({parent:index,preferred:x,other:y,provenance:[{parent:index,preferred:x,other:y}],x:a.x.map((v,j)=>v-b.x[j]),base:a.base-b.base,
        rawWeight:Math.min(4,gapH,gapR)/4,gapH,gapR,terminal:a.terminal||b.terminal,
        valueKind:Math.min(10,12)>=counts(parent.board).empty?'terminal-awarded-empty':'estimated-Edax-disc'});supported++;
    }
    parents.push({index,supported,competitive:[...competitive],alternatives:legal.length,canonicalAlternatives:representatives.length,occupied:parent.occupied,player:parent.player,
      teacherBest:[...r.keys()].sort((a,b)=>r.get(b)-r.get(a)||a-b)[0],bChoice:parent.bChoice});
  }
  return {id:root.id,phase:root.phase,policy:root.policy,depth:root.depth,pairs,parents};
}
