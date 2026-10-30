#!/usr/bin/env node
// Verification-only repair. Original frozen files and every game stay untouched.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {OUT,checked,sealed,sha,scientificInventory,read,atomic} from '../../scripts/p-confirmation/common.mjs';
import {hash} from '../../scripts/p-confirmation/protocol.mjs';
const output=process.argv.slice(2).find(a=>!a.startsWith('--'))??OUT,launch=checked(`${output}/launch.json`),state=read(`${output}/state.json`),originalPath='scripts/p-confirmation/audit.mjs';
assert.equal(state.counts.games,2048);assert.ok(!existsSync(`${output}/writer.lock`));
assert.equal(hash(scientificInventory()),launch.source);
for(const [path,digest] of launch.inventory){assert.equal(sha(path),digest);assert.equal(sha(`${output}/snapshot/${path}`),digest);}
const original=readFileSync(originalPath,'utf8'),before='tr.root.board.map(v=>-v)',after='tr.root.board.map(v=>v===0?0:-v)';
assert.equal(original.split(before).length,2,'Only the single audited zero-reversal comparison may change');
const patched=original.replace(before,after);
// Test the concrete failure, both signed zeros, both colors and rejection of
// genuinely different discs. This never alters a stored scientific board.
const board=[0,-0,1,-1];assert.throws(()=>assert.deepEqual(JSON.parse(JSON.stringify(board.map(v=>-v))),board.map(v=>-v)));
assert.deepEqual(JSON.parse(JSON.stringify(board.map(v=>-v))),board.map(v=>v===0?0:-v));
assert.throws(()=>assert.deepEqual([0,1,-1],[0,-1,1]));
const body={format:'p-confirmation-signed-zero-verification-repair-v1',launch:launch.checksum,source:launch.source,
 originalFile:originalPath,originalSha:sha(originalPath),patchedModuleSha:hash(patched),replacement:{before,after},
 originalFailureLogSha:sha(`${output}/completion-stage-1.log`),repairFileSha:sha('docs/data/p-confirmation-audit-repair-20261030.mjs'),
 unchangedFrozenInventory:launch.inventory,allGamesComplete:2048,noSearchRerun:true,noOutcomesExamined:true,
 interpretation:'JSON serializes both zeros as 0. Normalize only the expected empty cells in the audit comparison after color reversal. All frozen source bytes, B/P, search, sample, ordering, games, statistics and original failure log stay unchanged.'};
const certificate=sealed(`${output}/verification-repair.json`,body);console.log(JSON.stringify({repair:certificate.checksum,originalSha:body.originalSha,testsPassed:true}));
if(process.argv.includes('--check-only'))process.exit(0);
const absolute=patched.replace(/from (['"])(\.[^'"]+)\1/g,(_,quote,spec)=>`from ${quote}${pathToFileURL(resolve(dirname(originalPath),spec)).href}${quote}`);
const started=performance.now(),prior=state.activeMs;
const watchdog=setTimeout(()=>{console.error('Protected eight-hour scientific ceiling/report reserve reached during audit');process.exit(2);},8*3600000-20*60000-prior);watchdog.unref();
try{const module=await import(`data:text/javascript;base64,${Buffer.from(absolute).toString('base64')}`);const result=await module.audit(output);
 console.log(JSON.stringify({auditComplete:true,independentClaim:result.independentClaim,violations:result.violations.length,wallMs:result.wallMs}));
}finally{clearTimeout(watchdog);const current=read(`${output}/state.json`);current.activeMs=prior+performance.now()-started;current.updated=new Date().toISOString();current.verificationRepair=certificate.checksum;current.stage=existsSync(`${output}/provenance-audit.json`)?'provenance-audited-awaiting-statistics':'verification-repair-stopped';atomic(`${output}/state.json`,current);}
