#!/usr/bin/env node
// Run with --cpu-prof for source-line sampling, separately from fair benchmarks.
import { generate, searchLabel, solveIndependent } from '../strong/data.mjs';
import { createModel } from '../strong/model.mjs';
import { fit, speed } from '../strong/train.mjs';
import { read, atomic, instrumentIO } from '../research/io.mjs';
import { Profiler } from '../strong/telemetry.mjs';
import { mkdirSync } from 'node:fs';
const output=process.argv[2]??'.local-research/next-cpu';mkdirSync(output,{recursive:true});
const p=new Profiler();instrumentIO(p);const games=p.measure('generation',()=>Array.from({length:64},(_,i)=>generate({seed:2026102910+i,index:i,split:'profile',depth:2})));
const states=games.flatMap(g=>g.states),labels=p.measure('labeling',()=>games.slice(0,16).map(g=>searchLabel(g.states[10],5)));
const exact=p.measure('exact-labeling',()=>games.slice(0,16).map(g=>{const s=g.states.find(s=>s.placements===52);try{return solveIndependent(s.board,s.player);}catch{return null;}}));
p.measure('fit',()=>fit(createModel('long','rank'),games,labels,games,{epochs:6,profile:p}));
const costs=p.measure('evaluation-speed',()=>speed('B',states,{calls:100000}));
atomic(`${output}/data.json`,{games});p.measure('read-shards',()=>read(`${output}/data.json`));
await new Promise(resolve=>setImmediate(resolve));atomic(`${output}/results.json`,{profile:p.snapshot(),costs,exactLabels:exact.filter(Boolean).length});p.close();
