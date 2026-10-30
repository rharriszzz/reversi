#!/usr/bin/env node
// Repair the elapsed-budget transport defect, without selecting new openings,
// changing the search executable, tuning algorithms, or combining old outcomes.
import { existsSync,readFileSync,readdirSync,mkdirSync,copyFileSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { NativeEngine } from './client.mjs';
import { build,sha } from './build.mjs';
import { playGame,choose } from './game.mjs';
import { engineeringPositions } from './positions.mjs';
import { measure,output,atomic,read } from './measure.mjs';
import { PROTOCOL,hash,schedule } from './protocol.mjs';
const original=resolve('.local-research/native-engine-20261030'),path=resolve(output,'registration.json');
assert.notEqual(output,original);assert.ok(!existsSync(path),'Never overwrite registration');
const parent=read(resolve(original,'registration.json')),{checksum,...parentBody}=parent;assert.equal(hash(parentBody),checksum);
const receipt=build();assert.equal(receipt.executableSha256,parent.receipt.executableSha256,'The entire C++ executable must remain byte-identical');
for(const p of ['native/engine.cpp','native/engine.hpp','native/main.cpp','src/search.js','src/features.js','src/fast-features.js','src/rules.js','docs/data/next-residual-coefficients-20261029.json'])assert.equal(sha(readFileSync(p)),parent.sources[p],`Numerical/rules source changed: ${p}`);
assert.deepEqual(schedule(),parent.schedule);assert.equal(parent.openings.length,256);
await measure('clock-refreeze-calibration',async budget=>{
 const pilot=read(resolve(original,'engineering-game-costs.json')).games.filter((_,i)=>[0,1,4,5].includes(i)),games=[],engine=new NativeEngine({receipt});
 try {
  await engine.ready();for(const p of engineeringPositions().slice(0,4))for(const backend of ['native','javascript'])await choose(engine,p.board,p.player,{backend,model:'P',depth:5});
  for(const old of pilot) {
   const start=performance.now(),game=await playGame(engine,old.opening,{timeMs:old.game.timeMs,nativeColor:old.game.nativeColor});
   for(const m of game.moves)if(m.backend==='native'&&m.timedOut&&m.occupied<28)assert.ok(m.elapsedMs>=game.timeMs-1.5,`Transport underspent: ${m.elapsedMs}`);
   games.push({opening:old.opening,game,wallMs:performance.now()-start});atomic(resolve(output,'engineering-game-costs.json'),{games});
   console.log(JSON.stringify({stage:'corrected-clock-pilot',completed:games.length,total:4,timeMs:game.timeMs,wallMs:games.at(-1).wallMs}));
  }
 }finally{engine.close();}
 let gameMs=0;const estimates={};
 for(const timeMs of [80,300]) {const observed=Math.max(...games.filter(g=>g.game.timeMs===timeMs).map(g=>g.wallMs)),allPlacements=48*(timeMs+1),perGame=Math.max(observed,allPlacements);estimates[timeMs]={observedMaxGameMs:observed,allPlacementBoundMs:allPlacements,perGameMs:perGame};gameMs+=perGame*(timeMs===80?512:256);}
 const preparationSoFar=Date.now()-budget.active.start;
 const forecast={gameMs,estimates,measurementSpentBeforeMs:budget.spentMs,preparationSoFarMs:preparationSoFar,contingency:1.35,auditAllowanceMs:PROTOCOL.auditAllowanceMs,reportingReserveMs:PROTOCOL.reportingReserveMs,totalMs:budget.spentMs+preparationSoFar+1.35*(gameMs+PROTOCOL.auditAllowanceMs)+PROTOCOL.reportingReserveMs,capMs:budget.capMs};
 atomic(resolve(output,'feasibility.json'),forecast);assert.ok(forecast.totalMs<=forecast.capMs,'Full corrected 768-game repeat does not fit; stop before scored repeat');
 const paths=[...Object.keys(parent.sources),...readdirSync('scripts/native').filter(n=>/\.(mjs|py)$/.test(n)).map(n=>`scripts/native/${n}`)];
 const sources=Object.fromEntries([...new Set(paths)].sort().map(p=>[p,sha(readFileSync(p))]));
 for(const [p,digest] of Object.entries(sources)){const dst=resolve(output,'snapshot',p);mkdirSync(dirname(dst),{recursive:true});copyFileSync(p,dst);assert.equal(sha(readFileSync(dst)),digest);}
 mkdirSync(resolve(output,'snapshot/build'),{recursive:true});const executable=resolve(output,'snapshot/build/reversi-native');copyFileSync(receipt.executable,executable);
 const repair={originalRegistration:checksum,originalSummarySha256:sha(readFileSync(resolve(original,'summary.json'))),reason:'A long-lived performance.timeOrigin+now timestamp drifted from fresh receiver realtime; native underused the intended budget.',fix:'Fresh Date.now at each request; conservative timestamp quantization at most 1 ms.',sample:'Exactly the originally reserved 256 families, same subset and complete 768-game order; no outcome-based admission or replacement.',inference:'Use corrected repeat as primary engineering sample. Original 768 outcomes retained separately and never pooled as independent observations.',unchangedExecutableSha256:receipt.executableSha256};
 const body={format:'native-strength-registration-v2-clock-repair',at:new Date().toISOString(),protocol:PROTOCOL,sources,receipt:{...receipt,executable},node:process.version,gitHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),openings:parent.openings,schedule:schedule(),pilotOpeningIds:pilot.map(g=>g.opening.id),historical:parent.historical,forecast,statistics:PROTOCOL.statistics,repair};
 const registration={...body,checksum:hash(body)};atomic(path,registration);console.log(JSON.stringify({registered:true,checksum:registration.checksum,forecastMinutes:forecast.totalMs/60000,cppExecutableIdentical:true}));
});
