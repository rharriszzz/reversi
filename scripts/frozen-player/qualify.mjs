#!/usr/bin/env node
// Disclosed engineering only. No sampling, training, eligibility gate or scored launch.
import assert from 'node:assert/strict';
import { existsSync,mkdirSync,readdirSync,readFileSync } from 'node:fs';
import { resolve,relative } from 'node:path';
import { execFileSync,spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { atomic,read } from '../research/io.mjs';
import { findBestMove,terminalScore } from '../../src/search.js';
import { legalMoves,counts } from '../../src/rules.js';
import { MAPS } from '../research/core.mjs';
import { oracleScore } from '../../tests/oracle.mjs';
import { compile,makePattern,DIMENSION,sparseScore } from '../next-residual/model.mjs';
import { makeModel,zero } from '../next-residual/linear.mjs';
import { fullWindow,collectFrontier } from '../next-residual/frontier.mjs';
import { pinFor,trajectory } from '../machine-benchmark/suite.mjs';
import { preflight,extremeFixtures } from '../teacher/bound-preflight.mjs';
import { alternatives } from '../teacher/edax.mjs';
import { solveBoth } from '../teacher/exact.mjs';
import { solveReference } from '../teacher/reference-exact.mjs';
import { replay as replayPV } from '../teacher/qualification.mjs';
import { PROTOCOL,hash } from './protocol.mjs';
import { frozenModels } from './models.mjs';
import { receipt } from './receipts.mjs';
import { playGame,replay } from './game.mjs';
import { historyAvailability } from './history.mjs';

const output=resolve(process.argv[2]??'.local-research/frozen-player-screen-v1-20261029/engineering');
mkdirSync(output,{recursive:true});
const started=performance.now(),models=frozenModels(),names=['B','L','P'];
const report={format:'frozen-player-engineering-v1',at:new Date().toISOString(),protocolHash:hash(PROTOCOL),
  machine:{platform:process.platform,arch:process.arch,node:process.version},models:PROTOCOL.models,
  history:historyAvailability(process.cwd()),scientific:{activeMs:0,reservedSources:0,reservedOpenings:0,scoredGames:0}};
assert.equal(process.platform,'darwin','This qualification is for the actual M4 Mac');assert.equal(process.arch,'arm64');
const inventory=[];
function visit(dir) {for(const e of readdirSync(dir,{withFileTypes:true})){
  const p=resolve(dir,e.name);if(e.isDirectory())visit(p);else if(/\.(mjs|js|json|patch|h|c|py)$/.test(p))
    inventory.push([relative(process.cwd(),p),createHash('sha256').update(readFileSync(p)).digest('hex')]);}}
visit('src');visit('scripts');
for(const p of ['tests/oracle.mjs','tests/fixtures/edax-bound.json','tests/fixtures/edax-bound-leaf.json',
  'docs/data/next-residual-coefficients-20261029.json','docs/data/next-residual-results-20261029.json'])
  inventory.push([p,createHash('sha256').update(readFileSync(p)).digest('hex')]);
const source=hash(inventory.sort()),work=(id,input,fn)=>receipt(`${output}/tasks/${id}.json`,hash({source,protocol:report.protocolHash,input}),fn);
const manifestPath=`${output}/source.json`;
if(existsSync(manifestPath))assert.equal(read(manifestPath).source,source,'Engineering source changed; retain receipts and use a new directory');
else atomic(manifestPath,{source,inventory,protocol:PROTOCOL});
report.source=source;
function event(stage) {console.log(JSON.stringify({at:new Date().toISOString(),stage,elapsedSeconds:(performance.now()-started)/1000}));}
function resourceSample() {
  return {at:new Date().toISOString(),vm:execFileSync('vm_stat',[],{encoding:'utf8'}),
    swap:execFileSync('sysctl',['vm.swapusage'],{encoding:'utf8'}),
    processes:execFileSync('ps',['-axo','pid,ppid,%cpu,rss,comm'],{encoding:'utf8'}),
    memoryPressure:execFileSync('memory_pressure',['-Q'],{encoding:'utf8'}),
    disk:execFileSync('df',['-k','.'],{encoding:'utf8'}),power:execFileSync('pmset',['-g','custom'],{encoding:'utf8'})};
}
report.resources=[resourceSample()];
const evaluate=Object.fromEntries(names.map(n=>[n,compile(models[n]).evaluate]));
const prior=read('docs/data/next-residual-results-20261029.json'),roots=prior.reservedRootIdentities.slice(0,16);
assert.equal(new Set(roots.map(r=>`${r.phase}/${r.policy}/${r.depth}`)).size,16);
atomic(`${output}/engineering-inputs.json`,{roots,note:'Previously disclosed assessment boards, now engineering only; previous outcomes unchanged'});
event('frozen-model-and-symmetry-checks');
report.validation=await work('validation',{models:report.models,roots},async()=>{
  const Bzero=compile(makePattern(makeModel(zero()),new Float64Array(DIMENSION))).evaluate;
  const Lzero=compile(makePattern(models.L,new Float64Array(DIMENSION))).evaluate;
  let states=0,symmetryChecks=0,maxSparseDifference=0;
  for(const seed of [74102901,74102902,74102903,74102904]) for(const s of trajectory(seed)) {
    states++;
    if(legalMoves(s.board,1).length||legalMoves(s.board,-1).length) {
      for(const n of names) {
        const value=evaluate[n](s.board,s.player),close=x=>assert.ok(Math.abs(x-value)<1e-7);
        close(-evaluate[n](s.board,-s.player));close(evaluate[n](s.board.map(v=>-v),-s.player));
        for(const map of MAPS) {close(evaluate[n](map.map(i=>s.board[i]),s.player));symmetryChecks++;}
      }
      assert.equal(Bzero(s.board,s.player),evaluate.B(s.board,s.player));assert.equal(Lzero(s.board,s.player),evaluate.L(s.board,s.player));
      const error=Math.abs(evaluate.P(s.board,s.player)-sparseScore(s.board,s.player,models.L,models.P.coefficients));
      maxSparseDifference=Math.max(error,maxSparseDifference);assert.ok(error<5e-6,'Float32 table tolerance');
    }
  }
  for(const s of [...extremeFixtures(),...roots]) for(const n of names) {
    const result=findBestMove(s.board,s.player,2,undefined,{evaluate:evaluate[n]});
    assert.ok(Math.abs(result.score-oracleScore(s.board,s.player,2,evaluate[n]))<1e-8);
    if(!legalMoves(s.board,1).length&&!legalMoves(s.board,-1).length)assert.equal(result.score,terminalScore(s.board,s.player));
  }
  for(const r of roots)for(const [base,zeroEval] of [['B',Bzero],['L',Lzero]]) {
    const a=findBestMove(r.board,r.player,4,undefined,{evaluate:evaluate[base]}),b=findBestMove(r.board,r.player,4,undefined,{evaluate:zeroEval});
    for(const k of ['score','move','nodes','evaluations','exact'])assert.equal(a[k],b[k]);
  }
  return {passed:true,states,symmetryChecks,maxSparseDifference,phaseBoundaries:[27,28,51,52],zeroSearchRoots:16};
});
event('complete-static-evaluator-cost');
report.static=await work('static-cost',{roots},async()=>{
  const rows=[];let sink=0;
  for(let rep=0;rep<5;rep++)for(const known of [false,true])for(let j=0;j<3;j++) {
    const name=names[(j+rep)%3],fn=evaluate[name],mobility=roots.map(r=>legalMoves(r.board,r.player).length);
    for(let i=0;i<2000;i++){const k=i%16,r=roots[k];sink+=fn(r.board,r.player,undefined,known?mobility[k]:undefined);}
    const start=performance.now(),n=40000;
    for(let i=0;i<n;i++){const k=i%16,r=roots[k];sink+=fn(r.board,r.player,undefined,known?mobility[k]:undefined);}
    rows.push({name,rep,known,ns:(performance.now()-start)*1e6/n});
  }return {rows,sink};
});
event('production-and-full-window-search');report.search=[];report.frontiers=[];
for(const root of roots) {
  for(const name of names)for(const depth of [4,5,6]) {
    const row=await work(`search-${root.id}-${name}-${depth}`,{root,name,depth},async()=>{
      const start=performance.now(),full=fullWindow(root,depth,undefined,()=>{},evaluate[name]);
      const production=findBestMove(root.board,root.player,depth,undefined,{evaluate:evaluate[name]});
      assert.ok(Math.abs(full.score-production.score)<1e-8);
      assert.ok(full.rows.some(r=>r.move===production.move&&Math.abs(r.score-full.score)<1e-8));
      return {id:root.id,name,depth,full:{...full,observed:undefined},production,wallMs:performance.now()-start};
    });report.search.push(row);
  }
  for(const name of names) {
    const row=await work(`frontier-${root.id}-${name}`,{root,name},async()=>collectFrontier(root,{evaluate:evaluate[name]}));
    assert.ok(row.lines.every(l=>l.terminal||l.rootLeafObserved));report.frontiers.push({id:root.id,name,parents:row.parents,wallMs:row.wallMs});
  }
  event(`search-frontier-complete-${root.id}`);
}
event('native-teacher-and-independent-exact-qualification');
const installation=resolve('.local-research/machine-benchmark-teacher-mac-aligned');
const pin=pinFor(`${installation}/fixed/build.json`,`${installation}/eval.dat`);
assert.equal(pin.binarySha,'643b4a39dea9d85f3a862c37510c90e70188f0b7f02b37bde693841746c8f1c2');
report.teacher=pin;
const adapter=await work('native-adapter',pin,async()=>preflight(pin,`${output}/native`));
report.native={passed:adapter.passed,fixtures:adapter.validation.fixtures,extremes:adapter.exact.length,
  legacyReadyForQualification:adapter.readyForQualification,
  note:'Legacy readiness requires PC receipts bound to its different executable. Mac acceptance additionally uses the already qualified numerical references.'};
const fixture=read('scripts/machine-benchmark/positions.json'),normalized=r=>r.map(({move,value})=>({move,value:value||0}));
report.nativeQueries=[];
for(const [i,s] of fixture.roots.entries()) for(const depth of [10,12]) {
  const r=await work(`reference-${i}-${depth}`,{s,depth,pin},async()=>{
    const start=performance.now(),result=await alternatives(pin,s,depth,{measureNative:true,transcript:`${output}/native/reference-${i}-${depth}.json`});
    assert.deepEqual(normalized(result.rows),fixture.expected[`edax${depth}`][i]);replayPV(s,result);
    return {id:s.id,depth,result,wallMs:performance.now()-start};
  });report.nativeQueries.push(r);
}
report.exact=[];
for(const [i,s] of fixture.exact.entries()) {
  const r=await work(`exact-${i}`,s,async()=>{
    const start=performance.now(),result=solveBoth(s.board,s.player,{capMs:120000});
    for(const awarded of [false,true]) {
      const key=awarded?'awarded':'raw',ref=solveReference(s.board,s.player,awarded,performance.now()+120000);
      assert.deepEqual({value:result[key].value,rows:normalized(result[key].rows)},fixture.expected.exact[i][key]);
      assert.deepEqual(normalized(ref.rows),normalized(result[key].rows));assert.equal(ref.value,result[key].value);
    }
    return {id:s.id,result,wallMs:performance.now()-start};
  });report.exact.push(r);
}
// Measure full selected-frontier union labeling cost on all 16 disclosed cells.
event('engineering-frontier-label-tail-measurements');report.frontierQueries=[];
for(const root of roots) {
  const parents=new Map(report.frontiers.filter(f=>f.id===root.id).flatMap(f=>f.parents.map(p=>[hash({board:p.board,player:p.player}),p])));
  let wallMs=0,queries=0;
  for(const [key,s] of parents)for(const depth of [10,12]) {
    const r=await work(`frontier-label-${key}-${depth}`,{s,depth,pin},async()=>{
      const start=performance.now(),result=await alternatives(pin,s,depth,{measureNative:true,transcript:`${output}/native/frontier-${key}-${depth}.json`});
      replayPV(s,result);return {result,wallMs:performance.now()-start};
    });wallMs+=r.wallMs;queries++;
  }
  report.frontierQueries.push({id:root.id,cell:`${root.phase}/${root.policy}/${root.depth}`,parents:parents.size,queries,wallMs});
  event(`frontier-label-complete-${root.id}`);
}
event('isolated-timed-roots');report.timed=[];
for(const root of roots)for(const timeMs of [80,300])for(const name of names) {
  report.timed.push(await work(`timed-${root.id}-${name}-${timeMs}`,{root,name,timeMs},async()=>({id:root.id,name,timeMs,
    ...findBestMove(root.board,root.player,14,undefined,{evaluate:evaluate[name],timeMs})})));
}
event('engineering-games-and-real-process-restart');report.games=[];
for(let i=0;i<4;i++) {
  const occupied=12+i%2,opening={...trajectory(74102901+i).find(s=>s.board.filter(Boolean).length===occupied),id:`public-engineering-${i}`};
  const candidate=i%2?'P':'L',timeMs=i<2?80:300;
  for(const color of (i%2?[-1,1]:[1,-1])) {
    const result=await work(`game-${i}-${color}`,{opening,candidate,color,timeMs},async()=>{
      const checkpointPath=`${output}/games/${i}-${color}-checkpoint.json`;
      if(i===0&&color===1) {
        const job=`${output}/restart-job.json`,out=`${output}/restart-result.json`;
        atomic(job,{opening,candidate,color,timeMs});
        const first=spawnSync(process.execPath,['scripts/frozen-player/restart-probe.mjs',job,checkpointPath,out,'interrupt'],{encoding:'utf8'});
        assert.equal(first.status,73,first.stderr);assert.equal(read(checkpointPath).moves.length,1);
        execFileSync(process.execPath,['scripts/frozen-player/restart-probe.mjs',job,checkpointPath,out,'resume'],{timeout:120000});
        return {...read(out),realProcessRestart:true};
      }
      return playGame(opening,models[candidate],color,timeMs,{checkpoint:s=>atomic(checkpointPath,s)});
    });
    assert.deepEqual(replay(opening,result.moves,{complete:true}).board,result.board);
    report.games.push({opening,candidate,...result});event(`engineering-game-complete-${i}-${color}`);
  }
}
report.resources.push(resourceSample());report.cpu=process.cpuUsage();report.maxRssBytes=process.resourceUsage().maxRSS*1024;
report.configuredWorkers=1;report.actualWorkers=1;report.safeCap=1;
report.workerNote='Conservative single-worker engineering qualification; no concurrency speedup assumed. Native queries run serially; games have no labeling/search competitors.';
report.engineeringWallMs=performance.now()-started;
report.status='engineering-complete-history-awaits-independent-audit';report.independentLaunchPermitted=false;
atomic(`${output}/qualification.json`,{...report,checksum:hash(report)});
event(report.status);
