#!/usr/bin/env node
// Development-only complete evaluator/search costs; no scientific outcomes.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { read,atomic } from '../research/io.mjs';
import { evaluateFast } from '../../src/fast-features.js';
import { findBestMove } from '../../src/search.js';
import { legalMoves } from '../../src/rules.js';
import { compile,makePattern,DIMENSION } from './model.mjs';
import { makeModel,zero } from './linear.mjs';
import { hash } from './protocol.mjs';
import { quantile } from '../teacher/qualification-core.mjs';
const [old,engineering,out]=process.argv.slice(2),res=read(`${old}/reservations.json`),L=read(`${engineering}/L.json`),P=read(`${engineering}/P.json`);
// Exactly one old-development source per original cell, all historically excluded.
const roots=res.roles.development.slice(0,16),models={B:'B',L,P,Bzero:makePattern(makeModel(zero()),new Float64Array(DIMENSION)),Lzero:makePattern(L,new Float64Array(DIMENSION))};
const evaluators=Object.fromEntries(Object.entries(models).map(([k,v])=>[k,compile(v).evaluate]));
const report={kind:'next-residual-development-cost-v1',sources:roots.map(r=>r.id),static:[],search:[],timed:[],matched:[],L:L.checksum,P:P.checksum};let checksum=0;
for(let rep=0;rep<5;rep++)for(const known of [false,true])for(let m=0;m<5;m++) {
  const name=Object.keys(models)[(m+rep)%5],evaluate=evaluators[name],moves=roots.map(r=>legalMoves(r.board,r.player).length);
  for(let i=0;i<2000;i++){const k=i%16,r=roots[k];checksum+=evaluate(r.board,r.player,undefined,known?moves[k]:undefined);}
  const start=performance.now(),n=40000;
  for(let i=0;i<n;i++){const k=i%16,r=roots[k];checksum+=evaluate(r.board,r.player,undefined,known?moves[k]:undefined);}
  report.static.push({name,known,repetition:rep,ns:(performance.now()-start)*1e6/n});
}
for(let rep=0;rep<5;rep++) {
  const results={};
  for(let m=0;m<5;m++) {
    const name=Object.keys(models)[(m+rep)%5],evaluate=evaluators[name];let nodes=0,evaluations=0;const start=performance.now();results[name]=[];
    for(const r of roots){const result=findBestMove(r.board,r.player,6,undefined,{evaluate});nodes+=result.nodes;evaluations+=result.evaluations;results[name].push(result);}
    const ms=performance.now()-start;report.search.push({name,repetition:rep,ms,nodes,evaluations,nodesPerSecond:nodes*1000/ms,evaluationsPerSecond:evaluations*1000/ms});
  }
  for(const [base,nested] of [['B','Bzero'],['L','Lzero']]) {
    for(let i=0;i<16;i++)for(const k of ['move','score','nodes','evaluations'])assert.equal(results[base][i][k],results[nested][i][k]);
    const b=report.search.find(r=>r.name===base&&r.repetition===rep),p=report.search.find(r=>r.name===nested&&r.repetition===rep);
    report.matched.push({base,nested,repetition:rep,ratio:b.ms/p.ms});
  }
}
for(let rep=0;rep<2;rep++)for(const timeMs of [80,300])for(let m=0;m<3;m++) {
  const name=['B','L','P'][(m+rep)%3],evaluate=evaluators[name];
  for(const r of roots) {
    // Separately instrumented cost probe. Never used for timed-game outcomes.
    let evaluatorMs=0;const measured=(...args)=>{const start=performance.now();const value=evaluate(...args);evaluatorMs+=performance.now()-start;return value;};
    const result=findBestMove(r.board,r.player,14,undefined,{timeMs,evaluate:measured});
    report.timed.push({name,id:r.id,timeMs,repetition:rep,...result,evaluatorMs});
  }
}
report.speed=Object.fromEntries(['B','L'].map(base=>[base,quantile(report.matched.filter(r=>r.base===base).map(r=>r.ratio),.5)]));
report.speedPass=Object.values(report.speed).every(v=>v>=.9);report.checksumValue=checksum;report.checksum=hash(report);atomic(out,report);
console.log(JSON.stringify({output:out,speed:report.speed,speedPass:report.speedPass}));
