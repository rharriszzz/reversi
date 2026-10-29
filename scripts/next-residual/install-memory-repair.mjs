#!/usr/bin/env node
// Operational correction only. All already reserved scientific identities stay.
import { cpSync,readFileSync,writeFileSync,readdirSync,existsSync,symlinkSync } from 'node:fs';
import { resolve,relative } from 'node:path';
import { sourceDigest,read,atomic } from '../research/io.mjs';
import { hash } from './protocol.mjs';
import { MEMORY_PATCHES } from './execution.mjs';
const output=resolve(process.argv[2]),original=`${output}/source`,execution=`${output}/source-memory-v2`,manifest=read(`${output}/manifest.json`);
if(manifest.status!=='paused'||manifest.counts.labeled||manifest.counts.transferred)throw Error('Repair requires stopped pre-label run');
if(sourceDigest(original)!==manifest.source)throw Error('Original snapshot changed');
cpSync(original,execution,{recursive:true,filter:path=>!path.endsWith('/.local-research')});
const patches=MEMORY_PATCHES;
let code=readFileSync(`${original}/scripts/next-residual/run.mjs`,'utf8');for(const p of patches){if(code.split(p.before).length!==2)throw Error('Unexpected original scheduling code');code=code.replace(p.before,p.after);}
writeFileSync(`${execution}/scripts/next-residual/run.mjs`,code);cpSync(new URL('./execution.mjs',import.meta.url),`${execution}/scripts/next-residual/execution.mjs`);
const files=[];function visit(dir){for(const e of readdirSync(dir,{withFileTypes:true})){if(e.name==='.local-research')continue;const p=`${dir}/${e.name}`;if(e.isDirectory())visit(p);else files.push(relative(original,p));}}visit(original);
const changes=[];for(const p of files){const a=hash(readFileSync(`${original}/${p}`,'utf8')),b=hash(readFileSync(`${execution}/${p}`,'utf8'));if(a!==b)changes.push({path:p,before:a,after:b});}
if(changes.length!==1||changes[0].path!=='scripts/next-residual/run.mjs')throw Error('Unexpected frozen source change');
const certificate={kind:'next-residual-resident-memory-scheduling-v1',originalSource:manifest.source,executionSource:sourceDigest(execution),executionDirectory:execution,patches,changes,
  helperHash:hash(readFileSync(`${execution}/scripts/next-residual/execution.mjs`,'utf8')),runIdentity:manifest.runIdentity,reserved:manifest.counts.reserved,
  reason:'Preflight already returns a safe cap of one below 2.1 GiB; the coordinator redundantly required another 0.6 GiB for an already resident worker. Keep the 1.5 GiB physical-free reserve, preflight swapping/CPU blockers and two-worker 2.7 GiB admission. Add collection before resource measurements. No sampling, scoring, fitting, labeling, teacher, gate or game rule changes.',
  at:new Date().toISOString()};certificate.checksum=hash(certificate);if(existsSync(`${output}/memory-repair.json`)){const previous=read(`${output}/memory-repair.json`);atomic(`${output}/repair-history/${previous.checksum}.json`,previous);}
atomic(`${output}/memory-repair.json`,certificate);
symlinkSync(`${resolve(output,'../..')}/.local-research`,`${execution}/.local-research`,'dir');
console.log(JSON.stringify({certificate:certificate.checksum,originalSource:certificate.originalSource,executionSource:certificate.executionSource,reserved:certificate.reserved}));
