import { compile } from './model.mjs';
import { preferences } from '../residual/data.mjs';
import { mean } from '../teacher/qualification-core.mjs';
import { jointBootstrap,positionalGate } from './statistics.mjs';
export function analyzeSources(records,models,design,rootRows,independence=true) {
  const evaluators=Object.fromEntries(Object.entries(models).map(([k,m])=>[k,compile(m).evaluate])),panels={},sourceRows=[],frontierRows=[];
  const names=Object.keys(models),contrasts=['L-B',...(models.P?['P-B','P-L']:[])];
  for(const record of records) {
    const {root,panels:fs,labels:panelLabels}=record,row={source:root.id,phase:root.phase,policy:root.policy,depth:root.depth};
    for(const selector of ['B','L']) {
      const f=fs[selector],labels=panelLabels[selector],g=preferences(root,f,labels),scores=new Map(),losses=Object.fromEntries(names.map(n=>[n,0]));
      for(const [i,p] of f.parents.entries()) {
        const values=new Map(labels[i][12].rows.map(r=>[r.move,r.value])),h=new Map(labels[i][10].rows.map(r=>[r.move,r.value])),best=Math.max(...values.values()),choice={},regret={},exact={};
        for(const name of names) {
          const sc=p.children.map(c=>({move:c.move,score:c.terminal?c.base:evaluators[name](c.board,p.player)}));scores.set(`${i}/${name}`,new Map(sc.map(c=>[c.move,c.score])));
          choice[name]=sc.sort((a,b)=>b.score-a.score||a.move-b.move)[0].move;regret[name]=best-values.get(choice[name]);
          if(labels[i].independent)for(const convention of ['raw','awarded']) {
            const ref=labels[i].independent[convention],value=ref.rows.find(r=>r.move===choice[name]).value;
            (exact[convention]??={})[name]={value,regret:ref.value-value,wdlError:Math.sign(value)<Math.sign(ref.value)};
          }
        }
        const changes=Object.fromEntries(contrasts.map(c=>{const [a,b]=c.split('-');return [c,{disagreement:choice[a]!==choice[b],
          regretChange:regret[a]-regret[b],significant:Math.abs(values.get(choice[a])-values.get(choice[b]))>=4,
          reversal:h.get(choice[a])-h.get(choice[b])>=4&&values.get(choice[a])-values.get(choice[b])<=-4}];}));
        frontierRows.push({source:root.id,phase:root.phase,policy:root.policy,depth:root.depth,selector,parent:i,occupied:p.occupied,
          childPhase:p.children[0]?.phase,choice,regret,changes,exact});
      }
      const phaseLoss={};let mass=0,incorrect=Object.fromEntries(names.map(n=>[n,0])),ties={pairs:0,mass:0,distinguishedP:0,correctP:0};
      for(const p of g.pairs){mass+=p.rawWeight;const childPhase=f.parents[p.parent].children[0].phase;
        const ph=phaseLoss[childPhase]??={mass:0,loss:Object.fromEntries(names.map(n=>[n,0]))};ph.mass+=p.rawWeight;
        for(const name of names){const sc=scores.get(`${p.parent}/${name}`),margin=sc.get(p.preferred)-sc.get(p.other),z=-margin/10;
          const contribution=p.rawWeight*(Math.max(0,z)+Math.log1p(Math.exp(-Math.abs(z))));losses[name]+=contribution;ph.loss[name]+=contribution;if(margin<=0)incorrect[name]+=p.rawWeight;}
        if(!p.terminal&&p.base===0&&p.x.every(v=>v===0)){ties.pairs++;ties.mass+=p.rawWeight;
          if(models.P){const sc=scores.get(`${p.parent}/P`),margin=sc.get(p.preferred)-sc.get(p.other);ties.distinguishedP+=margin!==0;ties.correctP+=margin>0;}}
      }
      for(const name of names){row[`${selector}/${name}`]=mass?losses[name]/mass:null;row[`${selector}/incorrect/${name}`]=mass?incorrect[name]/mass:null;}
      row[`${selector}/preferences`]=g.pairs.length;row[`${selector}/parents`]=f.parents.length;
      row[`${selector}/ties`]=ties;row[`${selector}/childPhase`]=phaseLoss;
      for(const c of contrasts){const [a,b]=c.split('-');row[`${selector}/${c}`]=mass?(losses[b]-losses[a])/mass:null;}
      for(const name of names)row[`${selector}/regret/${name}`]=mean(frontierRows.filter(r=>r.source===root.id&&r.selector===selector).map(r=>r.regret[name]));
    }sourceRows.push(row);
  }
  const intervals=jointBootstrap(sourceRows,['B','L'].flatMap(s=>contrasts.map(c=>`${s}/${c}`)));
    for(const selector of ['B','L']) {
    const rows=frontierRows.filter(r=>r.selector===selector),groupSummary=xs=>({sources:xs.length,
      informative:xs.filter(r=>r[`${selector}/B`]!==null).length,preferences:xs.reduce((s,r)=>s+r[`${selector}/preferences`],0),
      loss:Object.fromEntries(names.map(n=>[n,mean(xs.map(r=>r[`${selector}/${n}`]).filter(v=>v!==null))])),
      incorrect:Object.fromEntries(names.map(n=>[n,mean(xs.map(r=>r[`${selector}/incorrect/${n}`]).filter(v=>v!==null))])),
      regret:Object.fromEntries(names.map(n=>[n,mean(xs.map(r=>r[`${selector}/regret/${n}`]).filter(v=>v!==null))]))});
    const by=key=>Object.fromEntries([...new Set(sourceRows.map(r=>r[key]))].map(value=>[value,groupSummary(sourceRows.filter(r=>r[key]===value))]));
    const regretRows=sourceRows.map(r=>({...r,...Object.fromEntries(contrasts.map(c=>{const [a,b]=c.split('-');const va=r[`${selector}/regret/${a}`],vb=r[`${selector}/regret/${b}`];return [c,va!==null&&vb!==null?va-vb:null];}))}));
    panels[selector]={...groupSummary(sourceRows),parents:rows.length,intervals:Object.fromEntries(contrasts.map(c=>[c,intervals[`${selector}/${c}`]])),
      byChildPhase:Object.fromEntries(['opening','middle','endgame'].map(phase=>{const gs=sourceRows.map(r=>r[`${selector}/childPhase`][phase]).filter(Boolean);return [phase,{sources:gs.length,loss:Object.fromEntries(names.map(n=>[n,mean(gs.map(g=>g.loss[n]/g.mass))]))}];})),
      regretIntervals:jointBootstrap(regretRows,contrasts),byPhase:by('phase'),byPolicy:by('policy'),byDepth:by('depth'),
      changes:Object.fromEntries(contrasts.map(c=>[c,{disagreements:rows.filter(r=>r.changes[c].disagreement).length,significant:rows.filter(r=>r.changes[c].significant).length,reversals:rows.filter(r=>r.changes[c].reversal).length}])),
      exact:Object.fromEntries(['raw','awarded'].map(convention=>[convention,{parents:rows.filter(r=>r.exact[convention]).length,
        wdlErrors:Object.fromEntries(names.map(n=>[n,rows.filter(r=>r.exact[convention]?.[n].wdlError).length]))}])),
      ties:{pairs:sourceRows.reduce((s,r)=>s+r[`${selector}/ties`].pairs,0),distinguishedP:sourceRows.reduce((s,r)=>s+r[`${selector}/ties`].distinguishedP,0),correctP:sourceRows.reduce((s,r)=>s+r[`${selector}/ties`].correctP,0)}};
  }
  const rootSummary=Object.fromEntries([4,6].map(d=>{
    const rows=rootRows.filter(r=>r.searchDepth===d),bootRows=rows.map(r=>({...r,...Object.fromEntries(contrasts.map(c=>{const [a,b]=c.split('-');return [c,r.regret[a]-r.regret[b]];}))}));
    return [d,{sources:rows.length,regret:Object.fromEntries(names.map(n=>[n,mean(rows.map(r=>r.regret[n]))])),intervals:jointBootstrap(bootRows,contrasts),
      disagreements:Object.fromEntries(contrasts.map(c=>{const [a,b]=c.split('-');return [c,rows.filter(r=>r.choice[a]!==r.choice[b]).length];})),
      byPhase:Object.fromEntries([0,1,2,3].map(p=>[p,{sources:rows.filter(r=>r.phase===p).length,regret:Object.fromEntries(names.map(n=>[n,mean(rows.filter(r=>r.phase===p).map(r=>r.regret[n]))]))}]))}];
  }));
  const gates={L:positionalGate(panels,rootRows,design,'L','B',independence)};
  if(models.P)gates.P=positionalGate(panels,rootRows,design,'P','L',independence);
  return {panels,sourceRows,frontierRows,rootRows,rootSummary,gates,independence};
}
