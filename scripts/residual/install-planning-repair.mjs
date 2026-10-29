#!/usr/bin/env node
// Register this reviewed scheduling repair without rewriting scientific receipts.
import { cpSync, copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { atomic, read, sourceDigest } from '../research/io.mjs';
import { hash, PROTOCOL } from './protocol.mjs';
import { changesBetween, executionIdentity, repairAssessmentSource } from './planning-source.mjs';
import { readFileSync, readdirSync } from 'node:fs';
const [directory,repository='.',authorization]=process.argv.slice(2),output=resolve(directory),root=resolve(repository),state=read(`${output}/manifest.json`);
const serialization=authorization==='--repair-assessment-serialization';
if(serialization) {
  if(state.status!=='failed'||!state.error?.startsWith('RangeError: Invalid string length\n')
    ||!state.error.includes('at assess (')||(existsSync(`${output}/failures`)&&readdirSync(`${output}/failures`).length))
    throw Error('Recovery is restricted to the known assessment serialization failure with no failed tasks');
} else if(state.status!=='paused')throw Error('Scheduling repair requires a clean paused checkpoint');
let previous=null;
if(existsSync(`${output}/planning-amendment.json`)) {
  previous=read(`${output}/planning-amendment.json`);executionIdentity(previous.executionDirectory,output);
  if(!serialization&&(authorization!=='--authorize-ten-hours'||previous.scheduling)){console.log('Reviewed scheduling repair already registered');process.exit(0);}
}
if(authorization&&!['--authorize-ten-hours','--repair-assessment-serialization'].includes(authorization))throw Error('Unknown scheduling authorization');
if(authorization&&!previous)throw Error('Ceiling amendment requires the verified scheduling predecessor');
const original=`${output}/source`,execution=`${output}/source-planning-${serialization?'v3':authorization?'v2':'v1'}`;
if(sourceDigest(original)!==state.source)throw Error('Original frozen source mismatch');
if(existsSync(execution))throw Error('Execution snapshot already exists; inspect rather than overwrite');
if(authorization) {
  atomic(`${output}/amendments/${previous.checksum}.json`,previous);
  atomic(`${output}/amendments/manifest-before-${serialization?'serialization-repair':'ten-hours'}.json`,state);
}
if(serialization&&readFileSync(`${root}/scripts/residual/run.mjs`,'utf8')!==
  repairAssessmentSource(readFileSync(`${previous.executionDirectory}/scripts/residual/run.mjs`,'utf8')))
  throw Error('Unexpected run code changes in serialization repair');
cpSync(original,execution,{recursive:true,dereference:false});
for(const file of ['run.mjs','diagnostics.mjs','launch.py','planning-source.mjs'])copyFileSync(`${root}/scripts/residual/${file}`,`${execution}/scripts/residual/${file}`);
const certificate={kind:serialization?'residual-operational-only-v1':'residual-scheduling-only-v1',registered:new Date().toISOString(),
  originalSource:state.source,executionSource:sourceDigest(execution),executionDirectory:execution,
  changes:changesBetween(original,execution),
  purpose:serialization?'Reference immutable search observation receipts instead of duplicating their arrays in assessment JSON. Recover only the known report-serialization failure; preserve all scientific calculations, completed task receipts, selected model and both time ledgers.':authorization?'User-authorized cumulative ceiling increase from eight to ten active hours; a separate new session has at most eight active hours. Frozen scientific inputs and receipt identities unchanged.':'Forecast using the actual pool, bounded crash accounting, and stricter reentry guards. Scientific model, objective, data, teacher, gates, seeds, splits and receipt identities unchanged.',
  ...(serialization?{previousAmendmentHash:previous.checksum,scheduling:previous.scheduling,
    operationalRepair:{kind:'assessment-observation-references-v1',failedManifest:'amendments/manifest-before-serialization-repair.json',
      changesFromPrevious:changesBetween(previous.executionDirectory,execution)}}:authorization?{previousAmendmentHash:previous.checksum,scheduling:{
    previousExperimentCapMs:PROTOCOL.experimentCapMs,experimentCapMs:10*3600000,sessionAllowanceMs:8*3600000,
    protocolHash:hash(PROTOCOL),authorization:'I authorize a new computational session of up to eight active hours, and an increase of the cumulative scientific computation ceiling from eight to ten active hours, if necessary to complete the originally planned experiment.'}}:{})};
certificate.checksum=hash(certificate);
atomic(`${output}/planning-amendment.json`,certificate);
state.planningAmendmentHash=certificate.checksum;state.executionSource=certificate.executionSource;state.executionDirectory=execution;
if(serialization) {
  state.recoveredEngineeringFailures=[...(state.recoveredEngineeringFailures??[]),{error:state.error,certificate:certificate.checksum,elapsedMs:state.elapsedMs}];
  delete state.error;state.status='paused';state.planningHold=false;state.pauseReason='Known assessment serialization repair verified; resume existing authorized session and immutable tasks';
}
atomic(`${output}/manifest.json`,state);
executionIdentity(execution,output);
console.log(JSON.stringify({registered:true,scienceSource:state.source,executionSource:certificate.executionSource,changed:certificate.changes.map(c=>c.path)}));
