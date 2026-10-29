// Research-only nested evaluator. Production B and search remain untouched.
import { fillFeaturesFast, evaluateFast } from '../../src/fast-features.js';
import { legalMoves } from '../../src/rules.js';
import { terminalScore } from '../../src/search.js';
import { geometry } from '../strong/model.mjs';
import { PROTOCOL, hash } from './protocol.mjs';
import { PHASES, FEATURES, makeModel as makeLinear, verifyModel as verifyLinear, zero, dot } from './linear.mjs';
export { makeLinear, verifyLinear };
export const TEMPLATES=PROTOCOL.pattern.templates.map((t,i)=>({...t,size:3**t.squares.length,pairs:(3**t.squares.length-1)/2,offset:i?1092:0}));
export const DIMENSION=TEMPLATES.reduce((n,t)=>n+3*t.pairs,0);
export const GEOMETRIES=geometry({templates:TEMPLATES});
export const phase=occupied=>occupied<28?0:occupied<52?1:2;
export function patternSparse(board,player) {
  const occupied=board.reduce((n,v)=>n+(v!==0),0),p=phase(occupied),entries=new Map();
  for(let j=0;j<GEOMETRIES.length;j++) {
    const g=GEOMETRIES[j],t=TEMPLATES[Math.floor(j/8)];let code=0,power=1;
    for(const q of g.squares){code+=(board[q]+1)*power;power*=3;}
    const reverse=t.size-1-code;if(code===reverse)continue;
    const key=t.offset+p*t.pairs+Math.min(code,reverse),value=player*(code<reverse?1:-1)/8;
    entries.set(key,(entries.get(key)??0)+value);
  }
  return [...entries].filter(([,v])=>v!==0).sort((a,b)=>a[0]-b[0]);
}
export function patternEncoding(board,player) {
  return !legalMoves(board,1).length&&!legalMoves(board,-1).length?[]:patternSparse(board,player);
}
export function makePattern(linear,coefficients,metadata={}) {
  verifyLinear(linear);
  if(coefficients.length!==DIMENSION||coefficients.some(v=>!Number.isFinite(v)||Math.abs(v)>25+1e-10))throw Error('Invalid pattern coefficients');
  const body={kind:'reversi-compact-pattern-residual-v1',linear,linearChecksum:linear.checksum,pattern:PROTOCOL.pattern,
    coefficients:[...coefficients],metadata};return {...body,checksum:hash(body)};
}
export function verifyPattern(model) {
  const {checksum,...body}=model;
  if(hash(body)!==checksum||model.kind!=='reversi-compact-pattern-residual-v1'||model.linearChecksum!==model.linear.checksum
    ||hash(model.pattern)!==hash(PROTOCOL.pattern))throw Error('Pattern identity mismatch');
  verifyLinear(model.linear);
  if(model.coefficients.length!==DIMENSION||model.coefficients.some(v=>!Number.isFinite(v)||Math.abs(v)>25+1e-10))throw Error('Pattern coefficient mismatch');
  return model;
}
export function compile(model,{forcePatterns=false}={}) {
  if(model==='B')return {evaluate:evaluateFast,bytes:0};
  const isPattern=model.kind==='reversi-compact-pattern-residual-v1';
  if(isPattern)verifyPattern(model);else verifyLinear(model);
  const linear=isPattern?model.linear:model,weights=linear.weights,scratch=new Float64Array(7);
  if(!isPattern&&!forcePatterns)return {evaluate:(b,p,_w,n)=>evaluateFast(b,p,weights,n),bytes:168,tables:[]};
  const tables=isPattern||forcePatterns?TEMPLATES.map(t=>{
    const table=new Float32Array(t.size*3);
    if(isPattern)for(let p=0;p<3;p++)for(let c=0;c<t.pairs;c++) {
      const v=model.coefficients[t.offset+p*t.pairs+c]/8;
      table[p*t.size+c]=v;table[p*t.size+t.size-1-c]=-v;
    }return table;
  }):[];
  const records=tables.length?GEOMETRIES.map((g,j)=>({...g,table:tables[Math.floor(j/8)]})):[];
  const evaluate=(board,player,_weights,knownMoves)=>{
    const occupied=fillFeaturesFast(board,player,scratch,knownMoves),p=phase(occupied),w=weights[PHASES[p]];let score=0,sum=0;
    for(let j=0;j<7;j++)score+=w[FEATURES[j]]*scratch[j];
    for(let j=0;j<records.length;j++) {
      const g=records[j];let code=0,power=1;
      for(let k=0;k<g.squares.length;k++){code+=(board[g.squares[k]]+1)*power;power*=3;}
      sum+=g.table[p*g.size+code];
    }
    return score+player*sum;
  };
  return {evaluate,bytes:tables.reduce((n,t)=>n+t.byteLength,0)+21*8,tables};
}
export function sparseScore(board,player,linear,coefficients) {
  if(!legalMoves(board,1).length&&!legalMoves(board,-1).length)return terminalScore(board,player);
  return evaluateFast(board,player,linear.weights)+patternSparse(board,player).reduce((s,[i,v])=>s+coefficients[i]*v,0);
}
export function encodePairs(groups,frontierFor,linear) {
  verifyLinear(linear);const support=new Uint32Array(DIMENSION),sources=new Set();
  const encoded=groups.map(group=>{
    const frontier=frontierFor(group.id),cache=new Map(),seen=new Set();sources.add(group.id);
    const encoding=(parent,move)=>{
      const key=`${parent}/${move}`;if(cache.has(key))return cache.get(key);
      const p=frontier.parents[parent],child=p.children.find(c=>c.move===move),x=patternEncoding(child.board,p.player);
      for(const [i] of x)seen.add(i);cache.set(key,x);return x;
    };
    const pairs=group.pairs.map(pair=>{
      const a=encoding(pair.parent,pair.preferred),b=encoding(pair.parent,pair.other),map=new Map(a);
      for(const [i,v] of b)map.set(i,(map.get(i)??0)-v);
      const sparse=[...map].filter(([,v])=>v).sort((a,b)=>a[0]-b[0]);
      return {...pair,base:pair.base+dot(pair.x,linear.correction),sparse};
    });
    // Count each trajectory once, independent of optimization passes or siblings.
    for(const i of seen)support[i]++;
    return {...group,pairs};
  });
  return {groups:encoded,support:[...support],sources:sources.size};
}
export function csr(groups) {
  const informative=groups.filter(g=>g.pairs.length),rows=[];
  for(const g of informative){const mass=g.pairs.reduce((n,p)=>n+p.rawWeight,0);
    for(const p of g.pairs)rows.push({...p,source:g.id,weight:p.rawWeight/mass/informative.length});}
  const offsets=new Uint32Array(rows.length+1),indices=[],values=[];
  for(let r=0;r<rows.length;r++) {for(const [i,v] of rows[r].sparse){indices.push(i);values.push(v);}offsets[r+1]=indices.length;}
  return {offsets,indices:Uint16Array.from(indices),values:Float64Array.from(values),base:Float64Array.from(rows.map(p=>p.base)),
    weight:Float64Array.from(rows.map(p=>p.weight)),n:rows.length,dimension:DIMENSION,
    identity:hash(rows.map(p=>({source:p.source,base:p.base,weight:p.weight,sparse:p.sparse})))};
}
export function objective(coefficients,data,lambda=0,gradient=true) {
  const g=gradient?new Float64Array(data.dimension):null;let loss=0;
  for(let j=0;j<coefficients.length;j++){loss+=lambda*coefficients[j]**2;if(g)g[j]=2*lambda*coefficients[j];}
  for(let r=0;r<data.n;r++) {
    let margin=data.base[r];for(let k=data.offsets[r];k<data.offsets[r+1];k++)margin+=data.values[k]*coefficients[data.indices[k]];
    const z=-margin/10;loss+=data.weight[r]*(Math.max(0,z)+Math.log1p(Math.exp(-Math.abs(z))));
    if(g){const a=-data.weight[r]*(z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z)))/10;
      for(let k=data.offsets[r];k<data.offsets[r+1];k++)g[data.indices[k]]+=a*data.values[k];}
  }
  return {loss,gradient:g};
}
