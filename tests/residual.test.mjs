import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { initialBoard, legalMoves, play, counts } from '../src/rules.js';
import { evaluateFast } from '../src/fast-features.js';
import { evaluate, DEFAULT_WEIGHTS, phaseOf } from '../src/features.js';
import { findBestMove, terminalScore } from '../src/search.js';
import { seededRandom } from '../src/learning.js';
import { oracleChildren, oracleScore } from './oracle.mjs';
import { PROTOCOL, slots, transferIds, hash } from '../scripts/residual/protocol.mjs';
import { zero, weightsFor, childEncoding, objective, normalizePairs, moments, fit, makeModel, verifyModel, select, dot } from '../scripts/residual/model.mjs';
import { fullWindow, collectFrontier, staticAtCutoff, equivalent } from '../scripts/residual/frontier.mjs';
import { generate, verifyTrajectory, preferences, trajectoryKeys, keyFor } from '../scripts/residual/data.mjs';
import { Pool } from '../scripts/residual/pool.mjs';
import { pairBootstrap, game } from '../scripts/residual/games.mjs';
import { KeyIndex } from '../scripts/residual/index.mjs';
import { positionalGate, bootstrapSources, lossSummary, forecast } from '../scripts/residual/diagnostics.mjs';
import { workerHistory } from '../scripts/residual/worker-history.mjs';
import { changesBetween, executionIdentity, compactSearchReceipt } from '../scripts/residual/planning-source.mjs';
import { sourceDigest } from '../scripts/research/io.mjs';

function trajectory(seed=61028931) {
  const rng=seededRandom(seed),states=[];let board=[...initialBoard()],player=1,passes=0;
  while(passes<2){states.push({board:[...board],player});const children=oracleChildren(board,player);
    if(!children.length){passes++;player=-player;continue;}passes=0;board=children[Math.floor(rng()*children.length)].board;player=-player;
  }return states;
}
test('residual zero preserves B features, score summation, full search and terminals exactly',()=>{
  const w=weightsFor(zero());assert.deepEqual(w,DEFAULT_WEIGHTS);
  for(const s of trajectory().filter((_,i)=>i%5===0))for(const player of [1,-1]) {
    assert.equal(evaluateFast(s.board,player,w),evaluateFast(s.board,player));
    assert.equal(evaluateFast(s.board,player,w),evaluate(s.board,player));
    const a=findBestMove(s.board,player,3,w),b=findBestMove(s.board,player,3);
    for(const k of ['move','score','nodes','evaluations','exact','depth'])assert.deepEqual(a[k],b[k]);
    assert.equal(childEncoding(s.board,player).base,legalMoves(s.board,1).length||legalMoves(s.board,-1).length?evaluateFast(s.board,player):terminalScore(s.board,player));
  }
  const terminal=[0,...Array(63).fill(1)],model=weightsFor(Array(21).fill(25));
  assert.equal(findBestMove(terminal,1,6,model).score,10063);
  assert.deepEqual(childEncoding(terminal,1).x,zero());
});
test('child features use exact child phases, color antisymmetry and serialized compiled weights',()=>{
  const states=trajectory();
  for(const occupied of [27,28,51,52]) {
    const s=states.find(s=>64-counts(s.board).empty===occupied);assert.ok(s);
    const enc=childEncoding(s.board,s.player),other=childEncoding(s.board,-s.player);
    assert.equal(enc.phase,occupied<28?'opening':occupied<52?'middle':'endgame');
    assert.deepEqual(enc.x.map(x=>x||0),other.x.map(x=>-x||0));
    const color=childEncoding(s.board.map(v=>-v),-s.player);assert.deepEqual(enc,color);
    const delta=Array.from({length:21},(_,i)=>(i-10)/2),model=JSON.parse(JSON.stringify(makeModel(delta)));
    const w=verifyModel(model);assert.ok(equivalent(evaluateFast(s.board,s.player,w),enc.base+dot(enc.x,delta)));
    model.weights.middle.discs++;assert.throws(()=>verifyModel(model),/identity/);
  }
  assert.throws(()=>weightsFor(Array(21).fill(25.1)),/corrections/);
});
test('independent exhaustive minimax confirms all continuation values and frontier static siblings',()=>{
  for(const s of trajectory(61733213).filter(s=>[15,28,43,57].includes(64-counts(s.board).empty))) {
    const root={...s,id:'independent',depth:4},r=collectFrontier(root);
    const oracle=oracleChildren(s.board,s.player).map(c=>({move:c.move,score:-oracleScore(c.board,-s.player,3,evaluateFast)})).sort((a,b)=>b.score-a.score||a.move-b.move);
    assert.deepEqual(r.rootScores,oracle);
    for(const line of r.lines) {
      let board=s.board,player=s.player,remaining=4;
      for(const step of line.steps) {
        assert.equal(step.remaining,remaining);assert.equal(step.player,player);
        if(step.move===null){assert.equal(oracleChildren(board,player).length,0);assert.ok(oracleChildren(board,-player).length);}
        else {
          const c=oracleChildren(board,player).find(c=>c.move===step.move);assert.ok(c);
          const score=-oracleScore(c.board,-player,remaining-1,evaluateFast);
          assert.ok(equivalent(score,step.score));board=c.board;remaining--;
        }player=-player;
      }
      assert.ok(line.terminal||remaining===0);
    }
    for(const p of r.parents){assert.equal(p.remaining,1);for(const c of p.children)assert.ok(equivalent(c.base,oracleScore(c.board,p.player,0,evaluateFast)));}
  }
});
test('forced passes at positive depth and static cutoff preserve perspective and placements',()=>{
  const states=Array.from({length:12},(_,i)=>trajectory(71820+i)).flat();
  const pass=states.find(s=>!legalMoves(s.board,s.player).length&&legalMoves(s.board,-s.player).length);
  assert.ok(pass);
  for(const d of [0,1,3])assert.ok(equivalent(fullWindow(pass,d).score,oracleScore(pass.board,pass.player,d,evaluateFast)));
  const terminal={board:[0,...Array(63).fill(1)],player:-1};
  assert.equal(staticAtCutoff(terminal.board,terminal.player),-10063);
  const r=collectFrontier({...pass,id:'pass',depth:3});assert.equal(r.parents.length,0); // no root alternatives on a forced pass
});
test('stable convex loss gradient matches central differences in all 21 original units',()=>{
  const rng=seededRandom(85236),groups=Array.from({length:7},(_,i)=>({id:`s${i}`,pairs:Array.from({length:i+1},()=>({x:zero().map(()=>rng()*2-1),base:rng()*60-30,rawWeight:.5+rng()/2}))}));
  const pairs=normalizePairs(groups),delta=zero().map(()=>rng()*10-5),lambda=.001,result=objective(delta,pairs,lambda);
  for(let j=0;j<21;j++) {
    const a=[...delta],b=[...delta],epsilon=1e-5;a[j]+=epsilon;b[j]-=epsilon;
    assert.ok(Math.abs((objective(a,pairs,lambda).loss-objective(b,pairs,lambda).loss)/(2*epsilon)-result.gradient[j])<1e-8);
  }
  assert.ok(Number.isFinite(objective(zero(),[{x:zero(),base:-1e9,weight:1}]).loss));
  assert.ok(Number.isFinite(objective(zero(),[{x:zero(),base:1e9,weight:1}]).loss));
  const trained=moments(pairs);objective(zero(),[{x:Array(21).fill(10000),base:1e9,weight:1}]);assert.deepEqual(moments(pairs),trained);
  for(const g of groups)assert.ok(Math.abs(pairs.filter(p=>p.source===g.id).reduce((s,p)=>s+p.weight,0)-1/7)<1e-14);
});
test('deterministic bounded optimizer descends, resumes identically and retains original-unit regularization',()=>{
  const pairs=normalizePairs([{id:'a',pairs:[{x:[1,...zero().slice(1)],base:-10,rawWeight:1}]}]);
  let checkpoint;const a=fit(pairs,.001,{checkpoint:s=>{checkpoint=structuredClone(s);}}),b=fit(pairs,.001);
  assert.deepEqual(a.delta,b.delta);assert.ok(a.converged);assert.ok(a.preferenceLoss<objective(zero(),pairs).loss);
  const resumed=fit(pairs,.001,{state:checkpoint});assert.deepEqual(a.delta,resumed.delta);
  assert.ok(Math.abs(objective(a.delta,pairs,.001).gradient[0])<1e-8);
  assert.ok(a.delta.every(x=>Math.abs(x)<=25));
  assert.throws(()=>fit(pairs,.002));
  assert.throws(()=>fit(pairs,.001,{state:{...checkpoint,dataHash:'corrupt'}}),/identity/);
  const control={delta:zero(),lambda:0},worse={delta:Array(21).fill(-1),lambda:.01};
  assert.equal(select([worse,control],pairs).lambda,0);
  const bounded=fit(normalizePairs([{id:'bounded',pairs:[{x:[1,...zero().slice(1)],base:-10000,rawWeight:1}]}]),.0001);
  assert.equal(bounded.delta[0],25);assert.ok(bounded.converged);
});
test('preference rules require both teacher gaps and normalize trajectories, without replacing missing labels',()=>{
  const state=trajectory(71836).find(s=>64-counts(s.board).empty===35),children=oracleChildren(state.board,state.player).slice(0,3);
  // Use a real frontier parent: teacher labels cover all legal alternatives.
  const parent={...state,occupied:35,bChoice:children[1].move,children:oracleChildren(state.board,state.player).map(c=>({...c,...childEncoding(c.board,state.player)}))};
  const rows=parent.children.map((c,i)=>({move:c.move,value:i===0?6:i===1?2:0}));
  const labels=[{10:{rows},12:{rows:rows.map(r=>({...r}))}}];
  let g=preferences({id:'s',phase:1,policy:'B1-12%',depth:4},{parents:[parent]},labels);
  assert.ok(g.pairs.some(p=>p.preferred===rows[0].move&&p.other===rows[1].move));
  labels[0][12].rows[1].value=7;g=preferences({id:'s'},{parents:[parent]},labels);
  assert.ok(!g.pairs.some(p=>p.preferred===rows[0].move&&p.other===rows[1].move));
  labels[0][10].rows.pop();assert.throws(()=>preferences({id:'s'},{parents:[parent]},labels),/Incomplete/);
});
test('reserved targets and balances remain full across sessions and deterministic size prefixes',()=>{
  for(const role of ['training','development','assessment']) {
    const plan=slots(role);assert.equal(plan.length,PROTOCOL.targets[role]);
    for(let p=0;p<4;p++)for(const policy of PROTOCOL.policies)for(const depth of [4,6]) {
      const cell=plan.filter(s=>s.phase===p&&s.policy===policy&&s.depth===depth);
      assert.equal(cell.length,role==='training'?100:25);
      for(const key of ['parity','player'])assert.ok(Math.abs(cell.filter(s=>s[key]===(key==='parity'?0:1)).length-cell.filter(s=>s[key]===(key==='parity'?1:-1)).length)<=1);
    }
  }
  assert.equal(slots('pilot').length,24);assert.equal(slots('games').length,256);
  const roots=slots('assessment').map(s=>({...s,id:`assessment-${s.slot}`}));assert.equal(new Set(transferIds(roots)).size,128);
});
test('generation policy replays deterministically and full trajectory/frontier keys include both colors',()=>{
  const spec=slots('pilot')[0],tr=generate(spec,9187);assert.ok(tr.root);verifyTrajectory(tr);
  const again=generate(spec,9187);assert.deepEqual(tr.moves,again.moves);assert.equal(tr.seed,again.seed);
  const f=collectFrontier({...tr.root,id:'test',depth:4}),keys=trajectoryKeys(tr,f);
  for(const p of f.parents)for(const c of p.children)for(const player of [1,-1])assert.ok(keys.has(keyFor(c.board,player)));
  const bad=structuredClone(tr);bad.moves[0].player=-1;assert.throws(()=>verifyTrajectory(bad),/turn/);
});
test('worker receipts recover after actual SIGKILL and reject protocol and result corruption',()=>{
  const dir=mkdtempSync(join(tmpdir(),'residual-recovery-'));
  try {
    const module=new URL('../scripts/residual/pool.mjs',import.meta.url).href;
    const job={type:'generate',spec:slots('pilot')[0],attempt:7182671};
    const code=`import {Pool} from ${JSON.stringify(module)};const [dir,mode]=process.argv.slice(1);const p=new Pool(1,dir,'frozen');await p.task('first',${JSON.stringify(job)});if(mode==='crash')process.kill(process.pid,'SIGKILL');await p.close();`;
    const first=spawnSync(process.execPath,['--expose-gc','--input-type=module','-e',code,dir,'crash']);assert.equal(first.signal,'SIGKILL');
    const before=readFileSync(join(dir,'tasks/first.json'),'utf8');
    assert.equal(spawnSync(process.execPath,['--input-type=module','-e',code,dir,'resume']).status,0);
    assert.equal(readFileSync(join(dir,'tasks/first.json'),'utf8'),before);
    const changed=spawnSync(process.execPath,['--input-type=module','-e',code.replace("'frozen'","'changed'"),dir,'resume']);assert.notEqual(changed.status,0);
    const r=JSON.parse(before);r.result.seed++;writeFileSync(join(dir,'tasks/first.json'),JSON.stringify(r));
    assert.notEqual(spawnSync(process.execPath,['--input-type=module','-e',code,dir,'resume']).status,0);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('corrected bootstrap samples complete opening pairs, with correct draw and endpoint behavior',()=>{
  assert.equal(pairBootstrap(Array(256).fill(.5)).lower975,.5);
  assert.equal(pairBootstrap(Array(256).fill(1)).lower975,1);
  const r=pairBootstrap([0,.25,.5,.75,1]);assert.equal(r.mean,.5);assert.ok(r.lower975<.5);assert.ok(r.interval95[1]>.5);
});
test('compact complete-hash exclusion index preserves every membership across disk recovery',()=>{
  const keys=new Set(Array.from({length:1000},(_,i)=>hash(`historical-${i}`))),index=KeyIndex.from(keys);
  for(const key of keys)assert.ok(index.has(key));
  assert.equal(index.has(hash('fresh')),false);assert.equal(index.bytes.length,32000);
  const dir=mkdtempSync(join(tmpdir(),'residual-index-'));try{index.save(join(dir,'index'));const loaded=KeyIndex.load(join(dir,'index'));assert.equal(loaded.digest(),index.digest());for(const key of keys)assert.ok(loaded.has(key));}finally{rmSync(dir,{recursive:true,force:true});}
});
test('locked gate uses complete fixed source counts, five percent loss and no six-depth regret increase',()=>{
  const rows=Array.from({length:128},(_,i)=>[4,6].map(depth=>({source:`s${i}`,phase:i%4,policy:i%2?'B1-12%':'B4-2%',depth,bRegret:2,candidateRegret:2}))).flat();
  assert.deepEqual(positionalGate(1,.95,rows),{complete:true,preference:true,root:true,relativePreferenceImprovement:.050000000000000044,rootMeanChange:0});
  assert.equal(positionalGate(1,.951,rows).preference,false);assert.equal(positionalGate(1,.9,rows.slice(2)).complete,false);
  rows[1].candidateRegret=3;assert.equal(positionalGate(1,.9,rows).root,false);
  assert.equal(positionalGate(0,0,rows).preference,false);
  const b=bootstrapSources(rows,r=>r.bRegret,{reps:100});assert.deepEqual(b.interval95,[2,2]);
});
test('timed game yields to a pause and resumes from the last move without repeating it',async()=>{
  const opening=trajectory(817330).find(s=>counts(s.board).empty===5);let saved,paused=false;
  await assert.rejects(game(opening,weightsFor(zero()),1,1,{check:()=>{if(paused)throw Error('pause');},
    checkpoint:s=>{saved=structuredClone(s);setImmediate(()=>{paused=true;});}}),/pause/);
  assert.equal(saved.moves.filter(m=>m.move!==null).length,1);
  const prefix=structuredClone(saved.moves),completed=await game(opening,weightsFor(zero()),1,1,{resume:saved});
  assert.deepEqual(completed.moves.slice(0,prefix.length),prefix);assert.ok(completed.moves.length>prefix.length);
  assert.equal(oracleChildren(completed.board,1).length+oracleChildren(completed.board,-1).length,0);
});
test('worker report distinguishes a recovered safe cap from the still-reduced actual pool',()=>{
  const dir=mkdtempSync(join(tmpdir(),'residual-workers-'));try {
    writeFileSync(join(dir,'manifest.json'),JSON.stringify({status:'running',sessions:[{pid:11,mode:'session-one',started:'2026-10-28T20:00:00Z'}]}));
    writeFileSync(join(dir,'launch-11.json'),JSON.stringify({workers:2}));
    writeFileSync(join(dir,'events.jsonl'),JSON.stringify({at:'2026-10-28T20:01:00Z',event:'workers-adjusted',workers:1,availableGiB:6})+'\n');
    writeFileSync(join(dir,'resource-history.jsonl'),[
      {at:'2026-10-28T20:00:59Z',workers:1,limitingAvailableGiB:2.5,availableGiB:6,windows:{availableKiB:2.5*2**20,cpuPercent:0},swapPagesInOutPerSecond:0},
      {at:'2026-10-28T20:02:00Z',workers:3,limitingAvailableGiB:3.5,availableGiB:6,windows:{availableKiB:3.5*2**20,cpuPercent:0}},
    ].map(JSON.stringify).join('\n')+'\n');
    const report=workerHistory(dir);assert.equal(report.latestSafeCap,3);assert.equal(report.latestActualPool,1);
    const change=report.timeline.find(r=>r.event==='pool-adjustment');assert.equal(change.limitingAvailableGiB,2.5);assert.equal(change.previousPool,2);assert.equal(change.requiredFreeHeadroomGiB,2.7);assert.match(change.reason,/memory/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('forecast caps measured speedup at the actual pool, regardless of a recovered safe cap',()=>{
  const pilot={roots:24,attempts:24,costs:slots('pilot').map(s=>({...s,generationMs:100,frontierMs:100,teacher10Ms:100,teacher12Ms:100})),
    scaling:{generate:{safeSpeedup:1.8},label:{safeSpeedup:1.9}},rootLabelCosts:[100],fitWallMs:1,
    gameCosts:[{timeMs:80,wallMs:100},{timeMs:300,wallMs:100}]};
  const one=forecast(pilot,{workers:3,effectiveWorkers:1}),two=forecast(pilot,{workers:3,effectiveWorkers:2});
  assert.equal(one.speedup,1);assert.equal(two.speedup,1.8);assert.ok(one.conservativeMs>two.conservativeMs);
  const elapsed=9*3600000;
  const oldCap=forecast(pilot,{effectiveWorkers:1},elapsed),newCap=forecast(pilot,{effectiveWorkers:1},elapsed,{experimentCapMs:10*3600000});
  assert.equal(oldCap.feasible,false);assert.equal(newCap.feasible,true);
  assert.equal(oldCap.conservativeMs,newCap.conservativeMs);
  assert.deepEqual(oldCap.stages,newCap.stages);
});
test('assessment references search observations without changing scores or the immutable witness',()=>{
  const result=fullWindow({board:initialBoard(),player:1},4),before=hash(result);
  assert.ok(result.observed.length>0);
  const compact=compactSearchReceipt(result,'search-fixture-4-B');
  const {observed,...numerical}=result;
  const {observedCount,observedReceipt,...saved}=JSON.parse(JSON.stringify(compact));
  assert.deepEqual(saved,numerical);assert.equal(observedCount,observed.length);
  assert.equal(observedReceipt,'tasks/search-fixture-4-B.json');assert.equal(hash(result),before);
  assert.ok(JSON.stringify(compact).length<JSON.stringify(result).length);
});
test('reviewed scheduling lineage preserves science identity and rejects changes to frozen math or gates',()=>{
  const dir=mkdtempSync(join(tmpdir(),'residual-planning-')),original=join(dir,'source'),execution=join(dir,'source-planning-v1');
  try {
    for(const name of ['src','scripts/residual','tests','docs/data'])mkdirSync(join(original,name),{recursive:true});
    writeFileSync(join(original,'package.json'),'{}');writeFileSync(join(original,'src/engine.js'),'export const B=21;');
    const diagnostics='export function forecast(){return 1;}\nexport function bootstrapSources(){return 42;}';
    writeFileSync(join(original,'scripts/residual/diagnostics.mjs'),diagnostics);cpSync(original,execution,{recursive:true});
    writeFileSync(join(execution,'scripts/residual/diagnostics.mjs'),diagnostics.replace('return 1','return 2'));
    const science=sourceDigest(original);
    const register=(extra={})=>{
      const body={kind:'residual-scheduling-only-v1',originalSource:science,executionSource:sourceDigest(execution),executionDirectory:execution,changes:changesBetween(original,execution),...extra};
      const certificate={...body,checksum:hash(body)};
      writeFileSync(join(dir,'planning-amendment.json'),JSON.stringify(certificate));
      writeFileSync(join(dir,'manifest.json'),JSON.stringify({source:science,planningAmendmentHash:certificate.checksum}));
    };
    register();assert.equal(executionIdentity(execution,dir).source,science);
    const previous=JSON.parse(readFileSync(join(dir,'planning-amendment.json'),'utf8'));
    mkdirSync(join(dir,'amendments'));writeFileSync(join(dir,`amendments/${previous.checksum}.json`),JSON.stringify(previous));
    const scheduling={previousExperimentCapMs:PROTOCOL.experimentCapMs,experimentCapMs:10*3600000,
      sessionAllowanceMs:8*3600000,protocolHash:hash(PROTOCOL),authorization:'Explicit user authorization'};
    register({previousAmendmentHash:previous.checksum,scheduling});
    assert.deepEqual(executionIdentity(execution,dir).scheduling,scheduling);
    register({previousAmendmentHash:previous.checksum,scheduling:{...scheduling,experimentCapMs:11*3600000}});
    assert.throws(()=>executionIdentity(execution,dir),/scheduling ceiling/);
    register({previousAmendmentHash:previous.checksum,scheduling:{...scheduling,protocolHash:'changed'}});
    assert.throws(()=>executionIdentity(execution,dir),/scheduling ceiling/);
    writeFileSync(join(execution,'src/engine.js'),'export const B=22;');register();assert.throws(()=>executionIdentity(execution,dir),/frozen numerical/);
    writeFileSync(join(execution,'src/engine.js'),'export const B=21;');
    writeFileSync(join(execution,'scripts/residual/diagnostics.mjs'),diagnostics.replace('return 1','return 2').replace('return 42','return 43'));
    register();assert.throws(()=>executionIdentity(execution,dir),/diagnostics\/gates/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
