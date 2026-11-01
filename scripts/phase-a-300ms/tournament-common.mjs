import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,openSync,closeSync,writeFileSync,renameSync,fsyncSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {hash} from '../next-residual/protocol.mjs';
import {sha as fileSha} from '../frozen-player/execution.mjs';
import {KeyIndex} from '../residual/index.mjs';
import {priorEvidence} from './prior.mjs';
import {frozenModels} from '../frozen-player/models.mjs';
import {NativeEngine} from '../native/client.mjs';
export {hash,fileSha};
export const OUT=resolve('.local-research/phase-a-300ms-m4-v1');
export const PUBLIC=resolve('docs/data/phase-a-300ms');
export const PYTHON='/Users/rharris/git/reversi/.venv/bin/python';
export const START='2026-11-01T01:27:45.000Z';
export const CAP_MS=240*60000,RESERVE_MS=15*60000;
export const read=p=>JSON.parse(readFileSync(p,'utf8'));
export function atomic(path,value){mkdirSync(dirname(path),{recursive:true});const tmp=`${path}.tmp-${process.pid}`,fd=openSync(tmp,'w');try{writeFileSync(fd,JSON.stringify(value)+'\n');fsyncSync(fd);}finally{closeSync(fd);}renameSync(tmp,path);const d=openSync(dirname(path),'r');try{fsyncSync(d);}finally{closeSync(d);}}
export function checked(path){const raw=readFileSync(path,'utf8').trim(),r=JSON.parse(raw),at=raw.lastIndexOf(',\"checksum\":');assert.ok(at>=0);assert.equal(hash(raw.slice(0,at)+'}'),r.checksum,`Checksum ${path}`);return r;}
export function sealed(path,body){const r={...body,checksum:hash(body)};if(existsSync(path))assert.deepEqual(read(path),r,`Immutable ${path}`);else atomic(path,r);return r;}
export function ledger(stage,extra={}){const path=resolve(OUT,'ledger.json'),old=existsSync(path)?read(path):{start:START,capMs:CAP_MS,charging:'Conservative uninterrupted wall span from first preparation, including AI/implementation, tests, calibration, games, verification and publication. No time reset or paused-span deduction.',events:[]};assert.equal(old.start,START);old.elapsedMs=Date.now()-Date.parse(old.start);old.events.push({at:new Date().toISOString(),stage,elapsedMs:old.elapsedMs,...extra});atomic(path,old);return old.elapsedMs;}
export function checkTime(){assert.ok(Date.now()-Date.parse(START)+RESERVE_MS<CAP_MS,'Four-hour cap/report reserve reached');}
export function sources(){const rows={};function visit(p){for(const e of readdirSync(p,{withFileTypes:true})){const q=resolve(p,e.name);if(e.isDirectory()&&e.name!=='__pycache__')visit(q);else if(e.isFile()&&/\.(js|mjs|py|cpp|h|patch|json)$/.test(q))rows[relative(process.cwd(),q)]=fileSha(q);}}for(const p of ['src','scripts','tests'])visit(resolve(p));for(const p of ['package.json','docs/data/next-residual-coefficients-20261029.json','docs/data/next-residual-results-20261029.json','docs/data/phase-a-mac/qualification.json','docs/data/phase-a-provenance/coverage.json','docs/data/phase-a-provenance/forecast.json'])rows[p]=fileSha(p);return Object.fromEntries(Object.entries(rows).sort());}
export function snapshot(rows){for(const [p,h] of Object.entries(rows)){const dst=resolve(OUT,'snapshot',p);mkdirSync(dirname(dst),{recursive:true});if(!existsSync(dst))copyFileSync(p,dst);assert.equal(fileSha(dst),h);}}
export function verifySources(rows){assert.deepEqual(sources(),rows,'Scientific inputs changed');for(const [p,h] of Object.entries(rows))assert.equal(fileSha(resolve(OUT,'snapshot',p)),h);}
export function qualification(){const q=read('docs/data/phase-a-mac/qualification.json'),r=q.build;assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');assert.equal(fileSha(r.executable),r.executableSha256);for(const [p,h] of Object.entries(r.sourceHashes))assert.equal(fileSha(p),h,p);const m=frozenModels();assert.equal(m.P.checksum,r.models.P);assert.equal(m.L.checksum,r.models.L);return q;}
export function history({verify=true}={}){const coverage=read('docs/data/phase-a-provenance/coverage.json');assert.ok(coverage.sourceAdmissionInventoryQualified&&coverage.knownTargetAndAssessmentCoveragePassed);const extraction=coverage.extraction,final=dirname(coverage.finalMembershipPath);if(verify){assert.equal(fileSha(`${extraction}/manifest.json`),coverage.extractionManifestSha256);assert.equal(fileSha(`${final}/manifest.json`),coverage.reconciliationManifestSha256);assert.equal(fileSha(coverage.finalMembershipPath),coverage.finalMembershipSha256);}
 const index=KeyIndex.load(coverage.finalMembershipPath);assert.equal(index.size,17321472);assert.equal(index.digest(),coverage.finalMembershipSha256);const manifest=read(`${extraction}/manifest.json`);
 return {coverage,index,seeds:new Set([...manifest.seeds,...priorEvidence().seeds]),binding:{coverageSha256:fileSha('docs/data/phase-a-provenance/coverage.json'),indexPath:coverage.finalMembershipPath,indexSha256:coverage.finalMembershipSha256,indexKeys:index.size,extraction,extractionManifestSha256:coverage.extractionManifestSha256,reconciliationManifestSha256:coverage.reconciliationManifestSha256,retentionLimits:coverage.retentionLimits,priorLayers:coverage.priorLayers,artifacts:coverage.artifacts,reconciledArtifacts:coverage.reconciliation.artifacts}};
}
export async function players(receipt,order=0){const q=qualification(),engines={B:new NativeEngine({receipt,ttMiB:16}),P:new NativeEngine({receipt,ttMiB:16})};try{const hello={};for(const model of order%2?['P','B']:['B','P']){hello[model]=await engines[model].ready();assert.equal(hello[model].cpuBackend,'single-target');for(const p of q.roots)await engines[model].search(p.board,p.player,{model,depth:3});}return {engines,hello,pids:Object.fromEntries(Object.entries(engines).map(([model,e])=>[model,e.child.pid]))};}catch(e){Object.values(engines).forEach(e=>e.close());throw e;}}
export function resources(){const r=JSON.parse(execFileSync(PYTHON,['scripts/frozen-player/resources.py'],{encoding:'utf8'}));assert.ok(r.availableGiB>1.5,'Physical reserve');return r;}
