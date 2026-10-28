#!/usr/bin/env node
// Compact evidence from immutable completed receipts; no new searches.
import {read,atomic} from '../research/io.mjs';
import {sha} from './edax.mjs';
const [output,destination]=process.argv.slice(2),m=read(`${output}/manifest.json`),r=read(`${output}/results.json`),admission=read(`${output}/roots.json`);
if(m.status!=='complete'||admission.roots.length!==1000)throw Error('Incomplete primary audit');
const roots=admission.roots.map((_,i)=>read(`${output}/tasks/root-${i}.json`)),anchors=Array.from({length:128},(_,i)=>read(`${output}/tasks/anchor-${i}.json`));
if(new Set(admission.roots.map(s=>s.key)).size!==1000)throw Error('Duplicate roots');
if(new Set(anchors.map(s=>JSON.stringify([s.state.board,s.state.player]))).size!==128)throw Error('Duplicate anchors');
for(const a of anchors)if(a.teacher.rows.some(t=>a.reference.rows.length?t.value!==a.reference.rows.find(x=>x.move===t.move)?.value:t.value!==a.reference.value))throw Error('Anchor mismatch');
const tops=t=>{const v=Math.max(...t.rows.map(x=>x.value));return t.rows.filter(x=>x.value===v).map(x=>x.move);};
const checked=roots.filter(x=>x.deep),stable=checked.filter(x=>tops(x.teacher).every(m=>tops(x.deep).includes(m))),dis=stable.filter(x=>!tops(x.deep).includes(x.b6.move));
if(stable.length!==r.summary.stable||dis.length!==r.summary.stableDisagreements)throw Error('Summary mismatch');
const compact={source:m.source,pin:m.pin,protocol:m.protocol,elapsedMs:m.elapsedMs,exclusionAudit:m.exclusionAudit,admission:{attempts:admission.attempts,rejected:admission.rejected},pilot:m.pilot,validation:{fixtures:m.validation.fixtures,transformChecks:m.validation.transformChecks},summary:{...r.summary,examples:r.summary.examples.map(x=>({state:x.state,b6:x.b6.move,teacher:x.teacher.rows.map(y=>({move:y.move,value:y.value})),deep:x.deep.rows.map(y=>({move:y.move,value:y.value})),continuations:x.continuations.map(y=>({move:y.move,pv:y.pv,leaf:y.leaf,recheck:y.recheck.rows.map(z=>({move:z.move,value:z.value}))}))}))},hashes:{manifest:sha(`${output}/manifest.json`),roots:sha(`${output}/roots.json`),results:sha(`${output}/results.json`)},labelTotals:{alternatives:roots.reduce((n,x)=>n+x.teacher.rows.length,0),deepAlternatives:checked.reduce((n,x)=>n+x.deep.rows.length,0),anchorAlternatives:anchors.reduce((n,x)=>n+x.teacher.rows.length,0)},profile:r.profile,deterministicTopStability:checked.filter(x=>tops(x.deep).includes(tops(x.teacher)[0])).length/checked.length};
atomic(destination,compact);console.log(JSON.stringify({...compact.summary,examples:compact.summary.examples.length,labelTotals:compact.labelTotals,elapsedMs:m.elapsedMs,deterministicTopStability:compact.deterministicTopStability}));
