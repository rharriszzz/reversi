#!/usr/bin/env node
// Read-only post-outcome diagnostics. No refitting, gate changes or replacement.
import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { read,atomic } from '../research/io.mjs';
import { hash } from './protocol.mjs';
import { compile,patternEncoding,GEOMETRIES,TEMPLATES } from './model.mjs';
import { preferences,keysFor } from '../residual/data.mjs';
import { normalizePairs } from './linear.mjs';
import { play,counts,legalMoves } from '../../src/rules.js';
const output=resolve(process.argv[2]),reservations=read(`${output}/reservations.json`),L=read(`${output}/engineering-v2/L.json`),P=read(`${output}/engineering-v2/P.json`),analysis=read(`${output}/assessment-results.json`);
const readSupport=read(`${output}/engineering-v2/fit-report.json`).encoding.support;
const evaluate={B:compile('B').evaluate,L:compile(L).evaluate,P:compile(P).evaluate},panels={},examples=[];
for(const selector of ['B','L']){
  const totals=Object.fromEntries(['B','L','P'].map(n=>[n,{nonterminal:0,terminalContaining:0,total:0}]));const coverage={staticChildren:0,lookups:0,center:0,unseen:0,supported:0,sourceRates:[]};let informative=0,terminalPairs=0,impossiblePairs=0,terminalSources=new Set();
  for(const root of reservations.assessment){
    const fs=Object.fromEntries(['B','L'].map(s=>[s,read(`${output}/tasks/main-frontier-${root.id}-${s}-a${root.attempt}.json`).result])),union=[...new Map(Object.values(fs).flatMap(f=>f.parents).map(p=>[p.key,p])).values()],f=fs[selector];
    const labels=f.parents.map(parent=>{const index=union.findIndex(q=>q.key===parent.key);return Object.fromEntries([10,12].map(d=>[d,read(`${output}/tasks/main-label-${root.id}-p${index}-d${d}.json`).result]));});
    let unseen=0,noncenter=0;
    for(const parent of f.parents)for(const child of parent.children){if(child.terminal)continue;coverage.staticChildren++;const phase=['opening','middle','endgame'].indexOf(child.phase);
      for(let j=0;j<GEOMETRIES.length;j++){const g=GEOMETRIES[j],t=TEMPLATES[Math.floor(j/8)];let code=0,power=1;for(const q of g.squares){code+=(child.board[q]+1)*power;power*=3;}coverage.lookups++;
        const reverse=t.size-1-code;if(code===reverse){coverage.center++;continue;}noncenter++;
        const index=t.offset+phase*t.pairs+Math.min(code,reverse);if(!P.coefficients[index]&&!readSupport[index]){coverage.unseen++;unseen++;}else coverage.supported++;
      }
    }
    if(noncenter)coverage.sourceRates.push(unseen/noncenter);
    const group=preferences(root,f,labels);if(!group.pairs.length)continue;informative++;
    for(const pair of normalizePairs([group])){
      const parent=f.parents[pair.parent],a=parent.children.find(c=>c.move===pair.preferred),b=parent.children.find(c=>c.move===pair.other);
      if(pair.terminal){terminalPairs++;terminalSources.add(root.id);}
      for(const name of ['B','L','P']){
        const score=c=>c.terminal?c.base:evaluate[name](c.board,parent.player),margin=score(a)-score(b),z=-margin/10,loss=pair.weight*(Math.max(0,z)+Math.log1p(Math.exp(-Math.abs(z))));
        totals[name][pair.terminal?'terminalContaining':'nonterminal']+=loss;totals[name].total+=loss;
      }
      // Max possible B->P change under either architecture's declared box.
      const map=new Map(patternEncoding(a.board,parent.player));for(const [i,v] of patternEncoding(b.board,parent.player))map.set(i,(map.get(i)??0)-v);
      const maxLinear=100*pair.x.reduce((s,v)=>s+Math.abs(v),0),maxPattern=25*[...map.values()].reduce((s,v)=>s+Math.abs(v),0),upperMargin=pair.base+maxLinear+maxPattern;
      if(upperMargin<0&&pair.terminal){impossiblePairs++;if(examples.length<12)examples.push({selector,source:root.id,parent:pair.parent,occupied:parent.occupied,player:parent.player,preferred:pair.preferred,other:pair.other,
        gap10:pair.gapH,gap12:pair.gapR,baseMargin:pair.base,maxLinear,maxPattern,upperMargin,
        a:{terminal:a.terminal,base:a.base,occupied:a.occupied},b:{terminal:b.terminal,base:b.base,occupied:b.occupied},
        teacher10:labels[pair.parent][10].rows.filter(r=>[a.move,b.move].includes(r.move)).map(({move,value})=>({move,value})),
        teacher12:labels[pair.parent][12].rows.filter(r=>[a.move,b.move].includes(r.move)).map(({move,value})=>({move,value}))});}
    }
  }
  for(const row of Object.values(totals))for(const key of Object.keys(row))row[key]/=informative;
  for(const name of ['B','L','P'])if(Math.abs(totals[name].total-analysis.panels[selector].loss[name])>1e-10)throw Error('Diagnostic decomposition differs from frozen loss');
  coverage.sourceMeanUnseenNoncenterRate=coverage.sourceRates.reduce((a,b)=>a+b,0)/coverage.sourceRates.length;coverage.sources=coverage.sourceRates.length;delete coverage.sourceRates;
  panels[selector]={coverage,informative,totals,terminalPairs,terminalSources:[...terminalSources],impossibleTerminalPairs:impossiblePairs,
    terminalFractionOfBLoss:totals.B.terminalContaining/totals.B.total,
    nonterminalContributionRelativeL:1-totals.L.nonterminal/totals.B.nonterminal,nonterminalContributionRelativePOverL:1-totals.P.nonterminal/totals.L.nonterminal};
}
const collisions=read(`${output}/independence-audit.json`).collisions,keys=new Set(collisions.map(c=>c.key)),witnesses=[];
for(const file of readdirSync(`${output}/tasks`).filter(f=>f.startsWith('main-')&&f.endsWith('.json'))){
 const r=read(`${output}/tasks/${file}`);if(r.job.type!=='label')continue;const source=file.match(/assessment-\d+/)[0];
 const add=(board,step)=>{const found=keysFor(board).filter(k=>keys.has(k));if(found.length)witnesses.push({source,receipt:file,step,occupied:64-counts(board).empty,terminal:!legalMoves(board,1).length&&!legalMoves(board,-1).length,keys:found,board});};
 add(r.job.state.board,0);
 for(const row of r.result.rows){let board=r.job.state.board,player=r.job.state.player,i=0;
  for(const move of [row.move,...row.pv]){if(move!==null)board=[...play(board,player,move)];player=-player;add(board,++i);}
 }
}
const body={kind:'post-outcome-diagnostics-no-refit-v1',runIdentity:analysis.runIdentity,
 purpose:'Decompose the frozen all-pair objective and locate forbidden historical PV collisions. Original models, all 256 sources, gates, losses and sample identities remain unchanged. These diagnostics are exploratory, not a repaired confirmation.',
 panels,examples,collisions:{records:collisions.length,uniqueKeys:keys.size,sources:[...new Set(collisions.map(r=>r.source))],witnesses},at:new Date().toISOString()};body.checksum=hash(body);atomic(`${output}/outcome-diagnostics.json`,body);
console.log(JSON.stringify({panels,examples:examples.slice(0,3),collisions:{records:collisions.length,uniqueKeys:keys.size,sources:body.collisions.sources,occupied:[...new Set(witnesses.map(w=>w.occupied))]}}));
