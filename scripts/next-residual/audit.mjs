#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync,readdirSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { atomic,read,sourceDigest } from '../research/io.mjs';
import { hash,PROTOCOL,slots,transferIds } from './protocol.mjs';
import { verifyTrajectory,trajectoryKeys,keysFor } from '../residual/data.mjs';
import { KeyIndex } from '../residual/index.mjs';
import { replay } from '../teacher/qualification.mjs';
import { identity } from '../teacher/edax.mjs';
import { verifyPreflight } from '../teacher/bound-preflight.mjs';
import { legalMoves,play } from '../../src/rules.js';
import { analyzeSources } from './analyze.mjs';
import { verifyLinear,verifyPattern,encodePairs,csr,objective as patternObjective } from './model.mjs';
import { normalizePairs,objective as linearObjective } from './linear.mjs';
import { projectedGradient } from './optimize.mjs';
import { pairBootstrap,gameSummary } from './games.mjs';
const [arg]=process.argv.slice(2),output=resolve(arg),old=resolve('.local-research/residual-frontier-v1r2-20261028'),engineering=`${output}/engineering-v2`;
const state=read(`${output}/manifest.json`);assert.ok(['complete','positional-gate-failed'].includes(state.status),'Scientific work incomplete');
const get=name=>{const r=read(`${output}/${name}.json`),{checksum,...body}=r;assert.equal(hash(body),checksum,`${name} checksum`);assert.equal(r.runIdentity,state.runIdentity);return r;};
const sourcePath=existsSync(`${output}/memory-repair.json`)?read(`${output}/memory-repair.json`).executionDirectory:`${output}/source`;
if(sourcePath!==`${output}/source`){const {executionIdentity}=await import(pathToFileURL(`${sourcePath}/scripts/next-residual/execution.mjs`));assert.equal(executionIdentity(sourcePath,output),state.source);}
else assert.equal(sourceDigest(sourcePath),state.source);
const protocol=get('protocol');assert.deepEqual(protocol.protocol,PROTOCOL);
const pin=identity(state.pin.binary,state.pin.evalFile,{buildFile:state.pin.experimental.buildFile});assert.deepEqual(pin,state.pin);
const qualification=read('.local-research/teacher-qualification-v4r1-20261028/manifest.json');verifyPreflight(qualification.adapterPreflightPath,pin);
const L=read(`${engineering}/L.json`),P=read(`${engineering}/P.json`);verifyLinear(L);verifyPattern(P);assert.equal(L.checksum,state.models.L);assert.equal(P.linearChecksum,L.checksum);
const fit=read(`${engineering}/fit-report.json`),benchmark=read(`${engineering}/benchmark.json`),pilot=read(`${engineering}/pilot.json`);
for(const r of [fit,benchmark,pilot]){const {checksum,...body}=r;assert.equal(hash(body),checksum);}
const reservations=get('reservations'),index=KeyIndex.load(`${output}/historical-index.bin`),indexReceipt=read(`${output}/historical-index.json`);
assert.equal(index.digest(),indexReceipt.digest);assert.equal(reservations.exclusionDigest,index.digest());
const design=reservations.design;assert.equal(reservations.assessment.length,design.sources);assert.equal(reservations.games.length,design.primaryPairs+design.shadowPairs);
assert.deepEqual(reservations.transferIds,transferIds(reservations.assessment,design.transfer));
const roots=[...reservations.assessment,...reservations.games],owners=new Map();
for(const root of roots){const tr=read(`${output}/trajectories/${root.id}.json`);verifyTrajectory(tr);assert.equal(hash(tr),root.trajectoryHash);
  const union=root.role==='games'?null:read(`${output}/frontiers/${root.id}.json`);if(union){assert.equal(union.rootHash,hash(root));assert.equal(union.resultHash,hash(union.result));}
  for(const k of trajectoryKeys(tr,union?.result)){assert.ok(!index.has(k),`Historical collision ${root.id}`);assert.ok(!owners.has(k),`Source collision ${root.id}`);owners.set(k,root.id);}
}
const pvSources=new Map();let independentTeacher=true,independentGames=true;
function checkIndependence(board,source,game=false){if(board.filter(v=>v!==0).length<12)return;for(const key of keysFor(board)){const owner=owners.get(key),seen=pvSources.get(key)??new Set();const bad=index.has(key)||(owner&&owner!==source)||[...seen].some(s=>s!==source);if(bad){if(game)independentGames=false;else independentTeacher=false;}seen.add(source);pvSources.set(key,seen);}}
let mainTasks=0,engineeringTasks=0,nativeCpuMs=0,maxNativeRss=0;const taskInventory=[],taskMap=new Map();
for(const file of readdirSync(`${output}/tasks`).filter(n=>n.endsWith('.json'))){const text=readFileSync(`${output}/tasks/${file}`,'utf8'),r=JSON.parse(text),id=file.slice(0,-5);
  assert.equal(r.resultHash,hash(r.result),`${file} result`);assert.equal(r.inputHash,hash({job:r.job,runIdentity:r.runIdentity}),`${file} input`);
  if(id.startsWith('main-')){assert.equal(r.runIdentity,state.runIdentity);mainTasks++;}else engineeringTasks++;
  taskInventory.push([file,createHash('sha256').update(text).digest('hex')]);taskMap.set(id,r);
  if(r.job.type==='label'){
    replay(r.job.state,r.result);
    if(id.startsWith('main-')){const source=id.match(/assessment-\d+/)[0];checkIndependence(r.job.state.board,source);for(const row of r.result.rows){let board=r.job.state.board,player=r.job.state.player;for(const move of [row.move,...row.pv]){if(move!==null)board=[...play(board,player,move)];checkIndependence(board,source);player=-player;}}}
    assert.equal(r.result.rootDepth,r.job.depth);
    const moves=legalMoves(r.job.state.board,r.job.state.player);assert.deepEqual(r.result.rows.map(x=>x.move).sort((a,b)=>a-b),moves);
    const usage=r.result.native??{};nativeCpuMs+=(usage.userSeconds??0)*1000+(usage.systemSeconds??0)*1000;
    maxNativeRss=Math.max(maxNativeRss,usage.maxRssBytes??0);
  }
}
const frontier=root=>Object.fromEntries(['B','L'].map(s=>[s,taskMap.get(`main-frontier-${root.id}-${s}-a${root.attempt}`).result]));
const labelsFor=id=>{const labels={};for(const d of [10,12])labels[d]=taskMap.get(`${id}-d${d}`).result;if(taskMap.has(`${id}-exact`))labels.independent=taskMap.get(`${id}-exact`).result;return labels;};
const records=reservations.assessment.map(root=>{const panels=frontier(root),union=[...new Map(Object.values(panels).flatMap(f=>f.parents).map(p=>[p.key,p])).values()];
  for(const f of Object.values(panels))for(const line of f.lines) {
    const endpointTerminal=!legalMoves(line.endpoint.board,1).length&&!legalMoves(line.endpoint.board,-1).length;
    assert.ok(line.terminal||line.rootLeafObserved||endpointTerminal,'No actual searched cutoff witness');
  }
  return {root,panels,labels:Object.fromEntries(['B','L'].map(s=>[s,panels[s].parents.map(p=>labelsFor(`main-label-${root.id}-p${union.findIndex(q=>q.key===p.key)}`))]))};
});
assert.equal(independentTeacher,get('independence-audit').passed,'Independently reconstructed teacher-PV separation');
const assessment=get('assessment-results'),models={B:'B',L,...(state.models.P?{P}:{})},rootRows=[];
for(const source of reservations.transferIds){const root=reservations.assessment.find(r=>r.id===source),labels=labelsFor(`main-transfer-${source}`),values=new Map(labels[12].rows.map(r=>[r.move,r.value])),best=Math.max(...values.values());
  for(const searchDepth of [4,6]){
    const saved=assessment.rootRows.find(r=>r.source===source&&r.searchDepth===searchDepth);assert.ok(saved);const choice={},regret={};
    for(const name of Object.keys(models)){
      const result=taskMap.get(`main-search-${source}-${searchDepth}-${name}`).result;assert.equal(result.rows.length,legalMoves(root.board,root.player).length);
      choice[name]=result.rows[0].move;regret[name]=best-values.get(choice[name]);assert.equal(saved.search[name].score,result.score);
      assert.equal(saved.search[name].nodes,result.nodes);assert.equal(saved.search[name].evaluations,result.evaluations);
    }
    assert.deepEqual(saved.choice,choice);assert.deepEqual(saved.regret,regret);rootRows.push(saved);
  }
}
const recomputed=analyzeSources(records,models,design,rootRows,get('independence-audit').passed);
for(const key of ['panels','sourceRows','frontierRows','rootSummary','gates'])assert.deepEqual(recomputed[key],assessment[key],`Recomputed ${key}`);
// Recheck every accepted fit's original-unit KKT residual without optimizing.
const oldReservations=read(`${old}/reservations.json`),groups=role=>oldReservations.roles[role].map(r=>read(`${old}/preferences/${r.id}.json`).group);
const training=groups('training'),development=groups('development');assert.equal(hash({training,development}),fit.corpusHash);
const frontierCache=new Map(),oldFrontier=id=>{if(!frontierCache.has(id))frontierCache.set(id,read(`${old}/frontiers/${id}.json`).result);return frontierCache.get(id);};
const encoded=encodePairs(training,oldFrontier,L),all=csr(encoded.groups);assert.deepEqual(encoded.support,fit.encoding.support);for(let i=0;i<P.coefficients.length;i++)if(!encoded.support[i])assert.equal(P.coefficients[i],0);
const convergence=[];
for(const [name,size] of [['linear-fit',1600],['curve-L-400',400],['curve-L-800',800]]){
  const fitted=read(`${engineering}/${name}.json`),result=linearObjective(fitted.delta,normalizePairs(training.slice(0,size)),0),pg=projectedGradient(fitted.delta,result.gradient,100);
  assert.ok(fitted.converged&&pg<1e-8);assert.ok(Math.abs(result.loss-fitted.loss)<1e-12);convergence.push({name,pg,iterations:fitted.iteration});
}
for(const [name,size,lambda] of [['pattern-fit-0',1600,0],['pattern-fit-0.000001',1600,1e-6],['pattern-fit-0.00001',1600,1e-5],['curve-P-400',400,fit.pattern.selected.lambda],['curve-P-800',800,fit.pattern.selected.lambda]]){
  const fitted=read(`${engineering}/${name}.json`),data=size===1600?all:csr(encoded.groups.slice(0,size)),result=patternObjective(fitted.coefficients,data,lambda),pg=projectedGradient(fitted.coefficients,result.gradient,25);
  assert.ok(fitted.converged&&pg<1e-8,`${name} convergence`);assert.ok(Math.abs(result.loss-fitted.loss)<1e-12);convergence.push({name,pg,iterations:fitted.iteration});
}
let gamesAudit=null;
if(existsSync(`${output}/game-results.json`)){
  const gameResults=get('game-results'),recalculated={};
  for(const [condition,result] of Object.entries(gameResults.conditions)){
    const pairs=[];for(let i=0;i<result.pairs;i++){
      const pair=get(`confirmation/${condition}-${i}`),opening=reservations.games[(condition==='P80'?design.primaryPairs:0)+i];assert.equal(pair.openingId,opening.id);
      for(const g of pair.games){let board=opening.board,player=opening.player,passes=0;
        for(const step of g.moves){assert.equal(step.player,player);if(step.move===null){assert.equal(legalMoves(board,player).length,0);passes++;}else{assert.ok(legalMoves(board,player).includes(step.move));board=[...play(board,player,step.move)];passes=0;}checkIndependence(board,opening.id,true);player=-player;}
        assert.equal(passes,2);assert.deepEqual(board,g.board);assert.equal(g.outcome,Math.sign(board.reduce((s,v)=>s+v,0))*g.candidateColor);
      }
      assert.equal(pair.games.length,2);assert.deepEqual(pair.games.map(g=>g.candidateColor),i%2?[-1,1]:[1,-1]);pairs.push(pair);
    }
    assert.deepEqual(pairBootstrap(pairs.map(p=>p.points)),result.bootstrap);assert.deepEqual(gameSummary(pairs.flatMap(p=>p.games)),result.summary);recalculated[condition]=pairs.length;
  }
  assert.equal(recalculated.L80,design.primaryPairs);assert.equal(recalculated.L300,design.primaryPairs);
  if(assessment.gates.P?.pass)assert.equal(recalculated.P80,design.shadowPairs);gamesAudit=recalculated;assert.equal(gameResults.independence,independentTeacher&&independentGames);
}else assert.equal(assessment.gates.L.pass,false);
// Every file present before engineering remains byte-identical, with no additions.
const before=read(`${output}/preservation-before.json`);let preservedBytes=0;
for(const [path,size,digest] of before){const bytes=readFileSync(`${old}/${path}`);assert.equal(bytes.length,size);assert.equal(createHash('sha256').update(bytes).digest('hex'),digest,`Preserved ${path}`);preservedBytes+=size;}
function countFiles(directory){return readdirSync(directory,{withFileTypes:true}).reduce((n,e)=>n+(e.isSymbolicLink()?0:e.isDirectory()?countFiles(`${directory}/${e.name}`):1),0);}
assert.equal(countFiles(old),before.length);
const events=readFileSync(`${output}/events.jsonl`,'utf8').trim().split('\n').map(JSON.parse),freeze=events.find(r=>r.event==='all-identities-frozen');assert.ok(freeze);
const firstLabel=[...taskMap].filter(([id])=>id.startsWith('main-')&&id.includes('label-')).map(([,r])=>r.committed).sort()[0];assert.ok(firstLabel>freeze.at);
let diagnosticChecksum=null;if(existsSync(`${output}/outcome-diagnostics.json`)){const d=read(`${output}/outcome-diagnostics.json`),{checksum,...body}=d;assert.equal(hash(body),checksum);assert.equal(d.runIdentity,state.runIdentity);for(const selector of ['B','L'])for(const name of Object.keys(models)){const q=d.panels[selector].totals[name];assert.ok(Math.abs(q.total-assessment.panels[selector].loss[name])<1e-10);assert.ok(Math.abs(q.nonterminal+q.terminalContaining-q.total)<1e-10);}assert.equal(d.collisions.records,get('independence-audit').collisions.length);diagnosticChecksum=checksum;}
const pilotGameAudit=read(`${output}/pilot-game-exclusion-audit.json`);const {checksum:pilotGameChecksum,...pilotGameBody}=pilotGameAudit;assert.equal(hash(pilotGameBody),pilotGameChecksum);assert.equal(pilotGameAudit.runIdentity,state.runIdentity);
const result={kind:'next-residual-independent-audit-v1',pilotGameChecksum,diagnosticChecksum,passed:true,runIdentity:state.runIdentity,source:state.source,executionSource:sourceDigest(sourcePath),
  protocolChecksum:protocol.checksum,reservationChecksum:reservations.checksum,modelChecksums:state.models,mainTasks,engineeringTasks,taskInventoryHash:hash(taskInventory),
  acceptedSources:design.sources,transferRoots:design.transfer,reservedOpenings:reservations.games.length,independence:get('independence-audit').passed,
  convergence,games:gamesAudit,preservedFiles:before.length,preservedBytes,preservationInventoryHash:createHash('sha256').update(readFileSync(`${output}/preservation-before.json`)).digest('hex'),
  firstLabelCommitted:firstLabel,identitiesFrozen:freeze.at,nativeCpuMs,maxNativeRss,at:new Date().toISOString()};
result.checksum=hash(result);atomic(`${output}/audit.json`,result);console.log(JSON.stringify(result));
