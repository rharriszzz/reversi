#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync,readdirSync,existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { read,atomic } from '../research/io.mjs';
import { frozenModels } from './models.mjs';
import { hash,PROTOCOL } from './protocol.mjs';
import { replay } from './game.mjs';
import { replay as replayPV } from '../teacher/qualification.mjs';
const dir=resolve(process.argv[2]??'.local-research/frozen-player-screen-v1-20261029/engineering');
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const report=read(`${dir}/qualification.json`),{checksum,...body}=report;
assert.equal(hash(body),checksum);assert.equal(report.protocolHash,hash(PROTOCOL));frozenModels();
const source=read(`${dir}/source.json`);assert.equal(hash(source.inventory),source.source);assert.equal(source.source,report.source);
for(const [path,digest] of source.inventory)assert.equal(sha(path),digest,`Engineering input changed: ${path}`);
const tasks=[],taskMap=new Map();
for(const file of readdirSync(`${dir}/tasks`).filter(n=>n.endsWith('.json')).sort()) {
  const path=`${dir}/tasks/${file}`,r=read(path),{checksum,...body}=r;assert.equal(hash(body),checksum);
  tasks.push({file,identity:r.identity,resultHash:hash(r.result),sha256:sha(path),wallMs:r.wallMs});
  taskMap.set(file.slice(0,-5),r);
}
const roots=read(`${dir}/engineering-inputs.json`).roots,fixture=read('scripts/machine-benchmark/positions.json');
const checked=new Set();
function check(id,input) {
  const r=taskMap.get(id);assert.ok(r,`Missing engineering task ${id}`);
  assert.equal(r.identity,hash({source:report.source,protocol:report.protocolHash,input}),`Wrong task input ${id}`);
  checked.add(id);return r.result;
}
check('validation',{models:report.models,roots});check('static-cost',{roots});check('native-adapter',report.teacher);
for(const root of roots)for(const name of ['B','L','P']) {
  for(const depth of [4,5,6])check(`search-${root.id}-${name}-${depth}`,{root,name,depth});
  check(`frontier-${root.id}-${name}`,{root,name});
  for(const timeMs of [80,300])check(`timed-${root.id}-${name}-${timeMs}`,{root,name,timeMs});
}
const normalized=rows=>rows.map(({move,value})=>({move,value:value||0}));
for(const [i,s] of fixture.roots.entries())for(const depth of [10,12]) {
  const r=check(`reference-${i}-${depth}`,{s,depth,pin:report.teacher});
  assert.deepEqual(normalized(r.result.rows),fixture.expected[`edax${depth}`][i]);replayPV(s,r.result);
}
for(const [i,s] of fixture.exact.entries()) {
  const r=check(`exact-${i}`,s);
  for(const key of ['raw','awarded'])assert.deepEqual({value:r.result[key].value,rows:normalized(r.result[key].rows)},fixture.expected.exact[i][key]);
}
for(const root of roots) {
  const parents=new Map(report.frontiers.filter(f=>f.id===root.id).flatMap(f=>f.parents.map(p=>[hash({board:p.board,player:p.player}),p])));
  for(const [key,s] of parents)for(const depth of [10,12]) {
    const r=check(`frontier-label-${key}-${depth}`,{s,depth,pin:report.teacher});replayPV(s,r.result);
  }
}
for(const g of report.games) {
  const index=Number(g.opening.id.split('-').at(-1));
  check(`game-${index}-${g.color}`,{opening:g.opening,candidate:g.candidate,color:g.color,timeMs:g.timeMs});
  const end=replay(g.opening,g.moves,{complete:true});assert.deepEqual(end.board,g.board);
  assert.equal(end.board.reduce((s,v)=>s+v,0),g.margin);assert.equal(g.outcome,Math.sign(g.margin)*g.color);assert.equal(g.points,(1+g.outcome)/2);
}
assert.equal(checked.size,tasks.length,'Unaccounted engineering tasks');
// Preserve raw monitor output. Its initial substring classifier counted the
// Python resource wrapper as another search. Reclassify by argv[0], not text.
const occupancyPath=existsSync(`${dir}/monitor.jsonl`)?`${dir}/monitor.jsonl`:resolve(dir,'../occupancy.jsonl');
const occupancy=existsSync(occupancyPath)?readFileSync(occupancyPath,'utf8').trim().split('\n').map(JSON.parse).map(r=>{
  const native=r.native.filter(line=>line.trim().split(/\s+/).at(-1)?.endsWith('/mEdax-armv8-a'));
  return {...r,rawSubstringCount:r.activeNativeSearches,activeNativeSearches:native.length,native};
}):[];
assert.ok(occupancy.length);assert.ok(occupancy.every(r=>r.activeNativeSearches<=1));
const result={format:'frozen-player-engineering-audit-v1',passed:true,source:report.source,
  qualificationSha256:sha(`${dir}/qualification.json`),protocolHash:report.protocolHash,tasks,
  taskCount:tasks.length,replayedGames:report.games.length,
  realProcessRestart:report.games.some(g=>g.realProcessRestart),occupancy,
  occupancyCorrection:'Raw substring count included Python wrapper argv; corrected using executable argv[0]. Raw samples retained.',
  scientific:{sources:0,openingFamilies:0,scoredGames:0,activeMs:0},
  independentLaunchPermitted:false};
atomic(`${dir}/audit.json`,{...result,checksum:hash(result)});
console.log(JSON.stringify({passed:true,tasks:tasks.length,games:report.games.length,source:report.source}));
