import assert from 'node:assert/strict';
import {seededRandom} from '../../src/learning.js';
import {studentCritical} from '../frozen-player/statistics.mjs';
import {studentTail} from '../native/statistics.mjs';
function quantile(xs,p){const a=[...xs].sort((x,y)=>x-y),q=(a.length-1)*p,i=Math.floor(q);return a[i]+(a[Math.ceil(q)]-a[i])*(q-i);}
export function summarize(rows,seed=2026110102){
 assert.equal(rows.length,256);assert.equal(new Set(rows.map(r=>r.family)).size,256);const groups=Array.from({length:16},(_,c)=>rows.filter(r=>r.cell===c).sort((a,b)=>a.family-b.family));assert.ok(groups.every(g=>g.length===16));
 assert.ok(rows.every(r=>[0,.25,.5,.75,1].includes(r.score)));
 const mean=rows.reduce((s,r)=>s+r.score,0)/256,variance=rows.reduce((s,r)=>s+(r.score-mean)**2,0)/255,se=Math.sqrt(variance/256),rng=seededRandom(seed),scores=[],margins=[];
 for(let rep=0;rep<10000;rep++){let score=0,margin=0;for(const group of groups)for(let i=0;i<16;i++){const r=group[Math.floor(rng()*16)];score+=r.score;margin+=r.margin;}scores.push(score/256);margins.push(margin/256);}
 return {mean,variance,standardError:se,studentOneSided95Lower:mean-studentCritical(255,.95)*se,hoeffdingOneSided95Lower:mean-Math.sqrt(Math.log(20)/512),studentP:se?studentTail((mean-.5)/se,255):null,scoreBootstrap95:[quantile(scores,.025),quantile(scores,.975)],marginBootstrap95:[quantile(margins,.025),quantile(margins,.975)]};
}
