#!/usr/bin/env node
// Analysis-only repair after every game/search completed. Never reruns a search.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {read,atomic} from '../research/io.mjs';
import {PROTOCOL,hash} from './protocol.mjs';
import {inventory,sha,resource} from './execution.mjs';
import {frozenModels} from './models.mjs';
import {analyze} from './analyze.mjs';
const ORIGINAL='90f3d47';
export function verifyRepair(output,history,preflight){
 const p=read(`${preflight}/preflight.json`),launch=read(`${output}/launch.json`),expected=new Map(p.inventory),live=inventory(),changes=[];
 assert.equal(hash(p.inventory),p.source);assert.equal(launch.source,p.source);assert.equal(hash(PROTOCOL),read(`${output}/preregistration.json`).protocol?hash(read(`${output}/preregistration.json`).protocol):null);
 const transforms={
  'scripts/frozen-player/analyze.mjs':s=>s.replace('assert.equal(g.outcome,Math.sign(g.margin)*condition.color)','assert.equal(g.outcome,(Math.sign(g.margin)*condition.color)||0)'),
  'scripts/frozen-player/verify-run.mjs':s=>s.replace("import assert from 'node:assert/strict';","import assert from 'node:assert/strict';\nimport {verifyRepair} from './finalize.mjs';")
   .replace('assert.equal(hash(inventory()),p.source);','verifyRepair(output,history,preflight);')
   .replace('assert.equal(g.outcome,condition.color*Math.sign(g.margin))','assert.equal(g.outcome,(condition.color*Math.sign(g.margin))||0)'),
 };
 for(const [path,digest] of live){
  if(path==='scripts/frozen-player/finalize.mjs'){changes.push({path,before:null,after:digest});continue;}
  assert.ok(expected.has(path),`Unexpected source addition ${path}`);
  if(transforms[path]){const original=execFileSync('git',['show',`${ORIGINAL}:${path}`],{encoding:'utf8'});assert.equal(hash(original),expected.get(path));assert.equal(readFileSync(path,'utf8'),transforms[path](original),'Repair changed more than signed-zero audit/verification routing');changes.push({path,before:expected.get(path),after:digest});}
  else assert.equal(digest,expected.get(path),`Frozen numerical input changed ${path}`);
  expected.delete(path);
 }
 assert.equal(expected.size,0,'Frozen source file removed');
 const body={kind:'post-search-signed-zero-audit-repair-v1',originalCommit:ORIGINAL,originalSource:p.source,launch:launch.checksum,
  changes,liveSource:hash(live),models:PROTOCOL.models,protocolHash:hash(PROTOCOL),noSearchRerun:true,
  interpretation:'JSON represents both numeric zeros as 0. Only audit equality normalizes the expected draw outcome. Search, evaluations, teacher labels, model coefficients, sample, ordering, statistics, nomination and all completed receipts remain unchanged.'};
 const certificate={...body,checksum:hash(body)},path=`${output}/analysis-repair.json`;
 if(existsSync(path))assert.deepEqual(read(path),certificate);else atomic(path,certificate);
 return certificate;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [output,history,preflight]=process.argv.slice(2),started=performance.now(),state=read(`${output}/state.json`),repair=verifyRepair(output,history,preflight);
 assert.equal(state.counts.games,384);assert.ok(state.elapsedMs+1500000<PROTOCOL.resources.scientificCapMs);
 if(state.status==='complete'){console.log('Analysis already complete; use verify-run.mjs');process.exit(0);}
 const reserved=read(`${output}/reservations.json`);for(const root of reserved.roots.filter(r=>r.role!=='games'))for(const name of ['B','L','P'])for(const t of [80,300])assert.ok(existsSync(`${output}/timed/${root.id}-${name}-${t}.json`),'Incomplete predetermined timed probes');
 state.failures=[...(state.failures??[]),{stage:state.stage,error:state.error,elapsedMs:state.elapsedMs,repair:repair.checksum}];
 const summary=await analyze(output,history,preflight,frozenModels()),body={...summary,identity:state.identity};atomic(`${output}/summary.json`,{...body,checksum:hash(body)});
 const cpu=process.cpuUsage();state.cpu=cpu;state.cpuTotal={user:(state.cpuTotal?.user??0)+cpu.user,system:(state.cpuTotal?.system??0)+cpu.system};
 state.maxRssBytes=Math.max(state.maxRssBytes,process.resourceUsage().maxRSS*1024);state.elapsedMs+=performance.now()-started;
 state.status='complete';state.stage='complete';state.analysisRepair=repair.checksum;state.updated=new Date().toISOString();state.resources=resource();state.actualWorkers=0;delete state.error;
 atomic(`${output}/state.json`,state);console.log(JSON.stringify({complete:true,activeMinutes:state.elapsedMs/60000,repair:repair.checksum,independence:summary.independence}));
}
