#!/usr/bin/env node
// Read-only identities and disclosed-root timing. No opening admission or games.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {frozenModels} from '../frozen-player/models.mjs';
import {hash} from '../frozen-player/protocol.mjs';
import {keysFor} from '../residual/data.mjs';
import {build,sha} from '../native/build.mjs';
import {NativeEngine} from '../native/client.mjs';
import {positions} from '../native-v2/positions.mjs';

const [researchArg,preflightArg,outputArg]=process.argv.slice(2);
assert.ok(researchArg&&preflightArg&&outputArg,'research root, preflight JSON, fresh output JSON required');
assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');
assert.equal(process.env.NATIVE_CPU??'portable','portable','Use the qualified ordinary Apple Silicon configuration');
assert.ok(!existsSync(outputArg),'Never overwrite evidence');
const research=resolve(researchArg),archive=`${research}/pc-import-20261029`,read=p=>JSON.parse(readFileSync(p));
const preflight=read(preflightArg),models=frozenModels(),started=performance.now();
const inputs={};
function raw(path){inputs[path]=sha(readFileSync(path));return read(path);}
for(const n of ['L','P'])assert.deepEqual(models[n],raw(`${archive}/residual-constraint-pattern-screen-v1-20261029/engineering-v2/${n}.json`));
const reservations=raw(`${archive}/residual-frontier-v1r2-20261028/reservations.json`),roles=reservations.roles;
assert.equal(roles.training.length,1600);assert.equal(roles.development.length,400);
const groups=role=>roles[role].map(r=>raw(`${archive}/residual-frontier-v1r2-20261028/preferences/${r.id}.json`).group);
const corpusHash=hash({training:groups('training'),development:groups('development')});
assert.equal(corpusHash,models.L.metadata.corpusHash);assert.equal(corpusHash,models.P.metadata.corpusHash);
const directPanels=new Set();
for(const role of ['training','development'])for(const root of roles[role]){
 const frontier=raw(`${archive}/residual-frontier-v1r2-20261028/frontiers/${root.id}.json`);
 assert.equal(hash(frontier.result),frontier.resultHash);
 for(const board of [root.board,...frontier.result.parents.flatMap(p=>[p.board,...p.children.map(c=>c.board)])])
  for(const key of keysFor(board))directPanels.add(key);
}
const originalFlagDirectPanelHits=preflight.original65FlagReinspection.filter(r=>directPanels.has(r.key)).map(r=>r.key);
assert.deepEqual(originalFlagDirectPanelHits,[],'Do not infer no L/P target hit from model names alone');
let checkedReceipts=0;
for(const relative of Object.keys(preflight.rawInputs)){
 const p=`${archive}/${relative}`;assert.equal(sha(readFileSync(p)),preflight.rawInputs[relative]);
 if(!p.endsWith('.json'))continue;
 const v=raw(p);
 if(v.job&&v.resultHash){assert.equal(hash(v.result),v.resultHash);assert.equal(hash({job:v.job,runIdentity:v.runIdentity}),v.inputHash);checkedReceipts++;}
}
// Python independently reconstructed each original occurrence under D4/color
// and both turns. Retain the exact original flag list and its restrictions.
const oldAudit=raw(`${research}/p-independent-confirmation-v1-20261029/provenance-audit.json`);
assert.deepEqual(preflight.original65FlagReinspection.map(r=>r.key),oldAudit.violations.map(r=>r.key));
const receipt=build(),engine=new NativeEngine({receipt});
const hello=await engine.ready();assert.equal(hello.cpuBackend,'single-target');
const roots=positions().slice(0,16).map(p=>({id:p.id,board:p.board,player:p.player}));
const rows=[];
try {
 for(const p of roots)for(const model of ['B','P'])await engine.search(p.board,p.player,{model,depth:3});
 for(const [i,p] of roots.entries())for(const model of i%2?['P','B']:['B','P']){
  const r=await engine.search(p.board,p.player,{model,timeMs:80});
  assert.equal(r.modelIdentity,receipt.models[model]);
  if(r.depth>0){const reference=await engine.search(p.board,p.player,{model,depth:r.depth});assert.equal(r.score,reference.score);}
  rows.push({root:p.id,model,...r});
 }
}finally{engine.close();}
assert.equal(sha(readFileSync(receipt.executable)),receipt.executableSha256);
const result={format:'phase-a-mac-disclosed-qualification-v1',at:new Date().toISOString(),
 purpose:'Engineering roots only; no new source candidates or scored games',
 build:receipt,hello,models:{B:'original-production',L:models.L.checksum,P:models.P.checksum},
 corpusHash,trainingSources:1600,developmentSources:400,checkedReceipts,
 directPanelKeys:directPanels.size,directPanelDigest:hash([...directPanels].sort()),originalFlagDirectPanelHits,
 inputs,roots,rootKeys:roots.map(p=>({id:p.id,keys:keysFor(p.board)})),timedSearches:rows,
 conservativeSearchComponentMinutes:512*52*Math.max(...rows.map(r=>Math.max(80,r.interfaceMs)))/60000,
 completeForecastMinutes:null,completeTimeGatePassed:false,
 incompleteForecastReason:'Historical coverage/transfer and complete current exclusion preparation cost are not certified; this root calibration cannot qualify the complete study.',
 wallMs:performance.now()-started,sourceSha256:sha(readFileSync(new URL(import.meta.url)))};
writeFileSync(outputArg,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output:outputArg,checkedReceipts,corpusHash,executableSha256:receipt.executableSha256,
 searches:rows.length,conservativeSearchComponentMinutes:result.conservativeSearchComponentMinutes,completeTimeGatePassed:false}));
