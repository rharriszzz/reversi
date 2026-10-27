// Offline, inspectable n-tuples. No browser imports or runtime ML dependency.
import { fillFeaturesFast, evaluateFast } from '../../src/fast-features.js';
import { DEFAULT_WEIGHTS } from '../../src/features.js';
import { MAPS } from '../research/core.mjs';

export const FORMAT='reversi-tuples-v2';
export const FEATURE_KEYS=['mobility','potential','corners','xSquares','cSquares','frontier','discs'];
const orbitKey=s=>MAPS.map(m=>s.map(i=>m[i]).sort((a,b)=>a-b).join(',')).sort()[0];
export function specification(family,phases=4) {
  const templates=[],seen=new Set();
  const add=(name,squares)=>{const key=orbitKey(squares);if(seen.has(key)) return;seen.add(key);templates.push({name,squares});};
  if(family==='short'||family==='hybrid') for(const n of [2,3,4])
    for(let r=0;r<8;r++) for(let c=0;c<8;c++) for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
      if(r+(n-1)*dr>7||c+(n-1)*dc<0||c+(n-1)*dc>7) continue;
      add(`line${n}`,Array.from({length:n},(_,i)=>(r+i*dr)*8+c+i*dc));
    }
  if(family==='long'||family==='hybrid') {
    add('corner6',[0,1,2,8,9,16]);
    add('corner9',[0,1,2,8,9,10,16,17,18]);
    add('edge8',[0,1,2,3,4,5,6,7]);
    add('edgeX10',[0,1,2,3,4,5,6,7,9,14]);
    add('diagonal8',[0,9,18,27,36,45,54,63]);
    add('diagonal7',[1,10,19,28,37,46,55]);
    add('diagonal6',[2,11,20,29,38,47]);
  }
  let length=(family==='linear'||family==='hybrid')?7*phases:0;
  for(const t of templates) {t.size=3**t.squares.length;t.offset=length;length+=t.size*phases;}
  return {format:FORMAT,family,phases,phaseStart:16,linear:family==='linear'||family==='hybrid',templates,length,
    symmetry:'sum all eight D4 transforms; antisymmetric color tables',phaseRule:'equal occupied-count buckets from 16 to 64, clamped through opening',
    rarePrior:32,normalization:1/Math.sqrt(Math.max(1,templates.length*8))};
}
export function createModel(family,objective='margin',phases=4) {
  const spec=specification(family,phases),weights=new Float32Array(spec.length),counts=new Uint32Array(spec.length);
  if(spec.linear) for(let p=0;p<phases;p++) {
    const occupied=spec.phaseStart+(p+0.5)*(64-spec.phaseStart)/phases,phase=occupied<28?'opening':occupied<52?'middle':'endgame';
    FEATURE_KEYS.forEach((k,i)=>weights[p*7+i]=DEFAULT_WEIGHTS[phase][k]*0.4);
  }
  return {id:`${family}-${objective}-p${phases}`,spec,objective,weights,counts,epochs:0,version:0};
}
export function phaseOf(occupied,spec) {const first=spec.phaseStart??4;return Math.max(0,Math.min(spec.phases-1,Math.floor((occupied-first)*spec.phases/(64-first))));}
export function pack(model) {
  const encode=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');
  return {...model,weights:encode(model.weights),counts:encode(model.counts),encoding:'base64 little-endian float32 / uint32',endianness:new Uint8Array(new Uint16Array([1]).buffer)[0]===1?'LE':'BE'};
}
export function unpack(saved) {
  if(saved.spec.format!==FORMAT||saved.endianness!=='LE') throw new Error('Unsupported model encoding');
  const decode=(s,T)=>{const b=Buffer.from(s,'base64');return new T(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
  const model={...saved,weights:decode(saved.weights,Float32Array),counts:decode(saved.counts,Uint32Array)};
  if(model.weights.length!==model.spec.length||model.counts.length!==model.spec.length||model.weights.some(v=>!Number.isFinite(v))) throw new Error('Invalid model weights');
  return model;
}
export const shrink=(model,i)=>model.counts[i]/(model.counts[i]+model.spec.rarePrior);
const geometries=new WeakMap();
export function geometry(spec) {
  if(!geometries.has(spec)) geometries.set(spec,spec.templates.flatMap(t=>MAPS.map(map=>({offset:t.offset,size:t.size,squares:Uint8Array.from(t.squares.map(i=>map[i]))}))));
  return geometries.get(spec);
}
export function sparse(board,model,{raw=false}={}) {
  const s=model.spec,entries=new Map(),f=new Float64Array(7);let occupied=0;
  for(let i=0;i<64;i++) occupied+=board[i]!==0;
  const phase=phaseOf(occupied,s),add=(i,v)=>entries.set(i,(entries.get(i)??0)+v);
  if(s.linear) {fillFeaturesFast(board,1,f);for(let i=0;i<7;i++) add(phase*7+i,f[i]);}
  for(const g of geometry(s)) {
    let code=0,power=1;
    for(const square of g.squares) {code+=(board[square]+1)*power;power*=3;}
    const a=g.offset+phase*g.size+code,b=g.offset+phase*g.size+g.size-1-code;
    add(a,s.normalization);add(b,-s.normalization);
  }
  return [...entries].filter(([,v])=>v).map(([i,v])=>[i,v*(raw||i<s.phases*7&&s.linear?1:shrink(model,i))]);
}
export const dot=(model,x)=>x.reduce((sum,[i,v])=>sum+model.weights[i]*v,0);
export function compile(model,{integer=false}={}) {
  const s=model.spec,groups=geometry(s),tables=[],scratch=new Float64Array(7),scale=integer?256:1;
  for(const t of s.templates) {
    const table=integer?new Int16Array(t.size*s.phases):new Float32Array(t.size*s.phases);
    for(let i=0;i<table.length;i++) {
      const phase=Math.floor(i/t.size),code=i%t.size,a=t.offset+i,b=t.offset+phase*t.size+t.size-1-code;
      const v=(model.weights[a]*shrink(model,a)-model.weights[b]*shrink(model,b))*s.normalization;
      if(integer&&Math.abs(v*scale)>32767) throw new Error('Int16 overflow; retain Float32');
      table[i]=integer?Math.round(v*scale):v;
    }
    tables.push(table);
  }
  const records=groups.map((g,i)=>({...g,table:tables[Math.floor(i/8)]}));
  // Only numeric locals, typed-array reads and the caller-owned scratch here.
  const evaluate=(board,player,_weights,knownMoves)=>{
    let occupied=0,score=0;
    if(s.linear) occupied=fillFeaturesFast(board,player,scratch,knownMoves);
    else for(let i=0;i<64;i++) occupied+=board[i]!==0;
    const phase=phaseOf(occupied,s);
    if(s.linear) for(let i=0;i<7;i++) score+=model.weights[phase*7+i]*scratch[i]*player;
    for(let j=0;j<records.length;j++) {
      const g=records[j];let code=0,power=1;
      for(let k=0;k<g.squares.length;k++) {code+=(board[g.squares[k]]+1)*power;power*=3;}
      score+=g.table[phase*g.size+code]/scale;
    }
    return Math.max(-1000,Math.min(1000,score))*player;
  };
  return {evaluate,records,bytes:tables.reduce((a,t)=>a+t.byteLength,0)+model.weights.byteLength,integer};
}
export function evaluator(saved) {return saved==='B'||saved?.id==='B'?{evaluate:evaluateFast}:compile(saved.weights instanceof Float32Array?saved:unpack(saved));}

// Experimental incremental indices only: deliberately not installed in search.
// Caller supplies every placement/flip; tests compare ALL codes to full recalc.
export function patternIndices(board,spec) {
  const g=geometry(spec),codes=new Int32Array(g.length),incidence=Array.from({length:64},()=>[]);
  for(let i=0;i<g.length;i++) {let power=1;for(const q of g[i].squares) {codes[i]+=(board[q]+1)*power;incidence[q].push([i,power]);power*=3;}}
  return {codes,update(changes){for(const {square,before,after} of changes) for(const [i,power] of incidence[square]) codes[i]+=(after-before)*power;}};
}
