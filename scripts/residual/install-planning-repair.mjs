#!/usr/bin/env node
// Register this reviewed scheduling repair without rewriting scientific receipts.
import { cpSync, copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { atomic, read, sourceDigest } from '../research/io.mjs';
import { hash } from './protocol.mjs';
import { changesBetween, executionIdentity } from './planning-source.mjs';
const [directory,repository='.']=process.argv.slice(2),output=resolve(directory),root=resolve(repository),state=read(`${output}/manifest.json`);
if(state.status!=='paused')throw Error('Scheduling repair requires a clean paused checkpoint');
if(existsSync(`${output}/planning-amendment.json`)){executionIdentity(read(`${output}/planning-amendment.json`).executionDirectory,output);console.log('Reviewed scheduling repair already registered');process.exit(0);}
const original=`${output}/source`,execution=`${output}/source-planning-v1`;
if(sourceDigest(original)!==state.source)throw Error('Original frozen source mismatch');
cpSync(original,execution,{recursive:true,dereference:false});
for(const file of ['run.mjs','diagnostics.mjs','launch.py','planning-source.mjs'])copyFileSync(`${root}/scripts/residual/${file}`,`${execution}/scripts/residual/${file}`);
const certificate={kind:'residual-scheduling-only-v1',registered:new Date().toISOString(),
  originalSource:state.source,executionSource:sourceDigest(execution),executionDirectory:execution,
  changes:changesBetween(original,execution),
  purpose:'Forecast using the actual pool, bounded crash accounting, and stricter reentry guards. Scientific model, objective, data, teacher, gates, seeds, splits and receipt identities unchanged.'};
certificate.checksum=hash(certificate);
atomic(`${output}/planning-amendment.json`,certificate);
state.planningAmendmentHash=certificate.checksum;state.executionSource=certificate.executionSource;state.executionDirectory=execution;
atomic(`${output}/manifest.json`,state);
executionIdentity(execution,output);
console.log(JSON.stringify({registered:true,scienceSource:state.source,executionSource:certificate.executionSource,changed:certificate.changes.map(c=>c.path)}));
