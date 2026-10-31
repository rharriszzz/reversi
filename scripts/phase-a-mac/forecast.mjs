// Disclosed historical roots and scratch I/O only; never plays a game.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync,openSync,closeSync,fsyncSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {NativeEngine} from '../native/client.mjs';
import {sha} from '../native/build.mjs';
const [outArg]=process.argv.slice(2);assert.ok(outArg);
const out=resolve(outArg);assert.ok(!existsSync(out));mkdirSync(out,{recursive:true});
const q=JSON.parse(readFileSync('docs/data/phase-a-mac/qualification.json'));
assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');
const receipt=q.build;
for(const [p,h] of Object.entries(receipt.sourceHashes))assert.equal(sha(readFileSync(p)),h,p);
assert.equal(sha(readFileSync(receipt.executable)),receipt.executableSha256);
const roots=q.roots,rows=[],startup=[];
for(let rep=0;rep<3;rep++){
  const start=performance.now(),engines={B:new NativeEngine({receipt}),P:new NativeEngine({receipt})};
  try{
    for(const model of rep%2?['P','B']:['B','P']){
      const hello=await engines[model].ready();assert.equal(hello.cpuBackend,'single-target');
      for(const p of roots)await engines[model].search(p.board,p.player,{model,depth:3});
    }
    startup.push(performance.now()-start);
    if(rep===2)for(const [i,p] of roots.entries())for(const model of i%2?['P','B']:['B','P']){
      const r=await engines[model].search(p.board,p.player,{model,timeMs:80});
      rows.push({root:p.id,model,interfaceMs:r.interfaceMs,elapsedMs:r.elapsedMs,depth:r.depth});
    }
  }finally{Object.values(engines).forEach(e=>e.close());}
}
const io=[];
for(let i=0;i<100;i++){
  const start=performance.now(),fd=openSync(resolve(out,'scratch-checkpoint.json'),'w');
  try{writeFileSync(fd,JSON.stringify({engineeringOnly:true,root:roots[0],padding:'x'.repeat(64000)}));fsyncSync(fd);}finally{closeSync(fd);}
  const directory=openSync(out,'r');try{fsyncSync(directory);}finally{closeSync(directory);}
  io.push(performance.now()-start);
}
const components={
  search:512*52*Math.max(81,...rows.map(r=>r.interfaceMs))/60000,
  startupWarmup:512*2*Math.max(...startup)/60000,
  checkpointIO:512*106*2*Math.max(...io)/60000,
  coverageRevalidation:5,
  sourceAdmissionFreeze:12,
  independentReservationAudit:3,
  replayRoleAuditStatistics:15,
};
const raw=Object.values(components).reduce((a,b)=>a+b,0),required=1.35*raw+15;
const oldPreflight=JSON.parse(readFileSync('docs/data/phase-a-mac/manifest.json'));
const resumedSpanMinutes=(Date.now()-statSync('/tmp/reversi-provenance-resume-before.log').birthtimeMs)/60000;
const spent={priorQualifiedPreflightMinutes:oldPreflight.elapsedWallSpanThroughFinalChecksSeconds/60,
  resumedPreparationSpanMinutes:resumedSpanMinutes,
  additionalStoppedAttemptAndUnloggedLeadAllowanceMinutes:7};
const spentMinutes=Object.values(spent).reduce((a,b)=>a+b,0);
const result={format:'phase-a-m4-forecast-v1',executableSha256:receipt.executableSha256,
  buildFingerprint:receipt.fingerprint,models:receipt.models,roots:roots.map(p=>p.id),rows,startupWarmupMs:startup,
  checkpointMaxMs:Math.max(...io),componentsMinutes:components,rawMinutes:raw,requiredMinutes:required,
  preparationAlreadySpent:spent,wholeContinuationRequiredMinutes:1.35*(raw+spentMinutes)+15,
  nominalFutureRunFits:required<=120,completeForecastQualified:false,
  assumptions:'Measured worst root query (minimum 81 ms), twice worst fresh B/P startup plus symmetric D3 warmup per game, twice worst 64 KB fsync per at most 106 path steps/game. Remaining non-search components are explicit planning allowances, not measured upper bounds. Admission must stop at its allowance before outcomes; no successful admission is guaranteed.',
  unresolved:'Current provenance is not certified; final history/admission/replay pipeline costs remain to be qualified. This forecast is for a future run reusing the completed inventory, not a retrospective reset of the earlier two-hour experiment.',
  noGames:true,sourceSha256:sha(readFileSync(new URL(import.meta.url)))};
writeFileSync(resolve(out,'forecast.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({rawMinutes:raw,requiredMinutes:required,completeForecastQualified:false}));
