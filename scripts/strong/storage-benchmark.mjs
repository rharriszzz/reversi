#!/usr/bin/env node
import { readFileSync, statSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { atomic } from '../research/io.mjs';
import { Profiler, compactEpoch } from './telemetry.mjs';
const input=resolve(process.argv[2]??'.local-research/strong-six-hour-20261027'),output=resolve(process.argv[3]??'.local-research/next-storage');mkdirSync(output,{recursive:true});
const p=new Profiler(),s=p.measure('manifest.read_parse',()=>JSON.parse(readFileSync(`${input}/manifest.json`,'utf8')));
const originalBytes=statSync(`${input}/manifest.json`).size;
for(let i=0;i<3;i++)p.measure('original.stringify',()=>JSON.stringify(s));
const compact={...s,history:s.history.slice(-1024).map(compactEpoch),historyChunks:Object.keys(s.tasks).filter(k=>s.tasks[k].type==='fit').map(k=>s.tasks[k].path)};
for(let i=0;i<3;i++)p.measure('compact.stringify',()=>JSON.stringify(compact));
p.measure('original.atomic_write_fsync',()=>atomic(`${output}/original-copy.json`,s));
p.measure('compact.atomic_write_fsync',()=>atomic(`${output}/compact.json`,compact));
await new Promise(resolve=>setImmediate(resolve));
const result={originalBytes,compactBytes:statSync(`${output}/compact.json`).size,epochs:s.history.length,tasks:Object.keys(s.tasks).length,profile:p.snapshot()};atomic(`${output}/storage.json`,result);console.log(JSON.stringify(result,null,2));p.close();
