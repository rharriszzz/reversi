#!/usr/bin/env node
// Only callable after both independent integrity and historical audits finish.
import assert from 'node:assert/strict';
import {copyFileSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {OUT,PUBLIC,read,checked,sealed,fileSha,ledger,hash} from './tournament-common.mjs';
import {summarize} from './tournament-statistics.mjs';
const r=checked(resolve(OUT,'registration.json')),integrity=checked(resolve(OUT,'integrity-verification.json')),provenance=checked(resolve(OUT,'provenance-verification.json')),a=checked(resolve(OUT,'analysis.json'));
assert.ok(integrity.passed&&provenance.auditCompleted);for(const v of [integrity,provenance,a])assert.equal(v.registration,r.checksum);
const s=summarize(a.pairRows,r.protocol.bootstrapSeed),near=(x,y)=>assert.ok(Math.abs(x-y)<1e-9,`${x} != ${y}`);
for(const k of ['mean','variance','standardError','studentOneSided95Lower','hoeffdingOneSided95Lower'])near(s[k],a[k]);
if(s.studentP!==null)assert.ok(Math.abs(s.studentP-a.studentP)<1e-7*Math.max(s.studentP,a.studentP)+1e-300);
for(let i=0;i<2;i++){near(s.scoreBootstrap95[i],a.bootstrap.stratifiedWholeFamilyScore95[i]);near(s.marginBootstrap95[i],a.bootstrap.stratifiedWholeFamilyMargin95[i]);}
const numerical=sealed(resolve(OUT,'independent-js-statistics.json'),{registration:r.checksum,passed:true,independentStudentRecurrence:true,independentPositiveStudentTail:true,exactStratifiedBootstrapMatch:true,summary:s});
const columns=['ply','id','score','depth','exact','timedOut','elapsedMs','cpuMs','tableBytes','generation','nodes','evaluations','ttProbes','ttHits','ttBoundHits','ttCollisions','ttReplacements','cutoffs','ttCutoffs','ttStores','ttRejectedStores','firstMoveCutoffs','interfaceMs','occupied','measuredMs','overrunMs'];
const games=r.schedule.map((c,i)=>{const g=checked(resolve(OUT,`games/game-${i}.json`));return {...c,index:i,receipt:g.checksum,resultHash:g.resultHash,committed:g.committed,warmupMs:g.warmupMs,wallMs:g.wallMs,hello:g.hello,processIds:g.processIds,identity:g.result.identity,board:g.result.board,margin:g.result.margin,outcome:g.result.outcome,points:g.result.points,moveTimeMs:g.result.moveTimeMs,moves:g.result.moves.map(m=>[m.player,m.move]),telemetry:g.result.moves.flatMap((m,ply)=>m.move===null?[]:[columns.map(k=>k==='ply'?ply:m[k])])};});
writeFileSync(resolve(PUBLIC,'games.json.gz'),gzipSync(JSON.stringify({registration:r.checksum,telemetryColumns:columns,games}),{level:9}),{flag:'wx'});
for(const name of ['reservation-verification.json','integrity-verification.json','provenance-verification.json','analysis.json','independent-js-statistics.json','forecast-before-admission.json','forecast-before-registration.json','development-verification.json','execution-complete.json','registration-publication.json','development-test-trajectories.json','calibration.json','evaluation-cost.json','diagnostics.json','seed-registry-verification.json','preplay-tests.json'])copyFileSync(resolve(OUT,name),resolve(PUBLIC,name));
writeFileSync(resolve(PUBLIC,'admission-attempts.jsonl.gz'),gzipSync(Buffer.concat(Array.from({length:r.attempts},(_,i)=>readFileSync(resolve(OUT,`attempts/${i}.json`)))),{level:9}),{flag:'wx'});
const resources=readdirSync(OUT).filter(n=>/^resources-.*\.json$/.test(n)).map(n=>({path:n,data:read(resolve(OUT,n))}));
sealed(resolve(PUBLIC,'resources.json'),{records:resources,processCheckSha256:fileSha(resolve(OUT,'processes-preparation.txt')),topPreparationSha256:fileSha(resolve(OUT,'top-preparation.txt'))});
const files=Object.fromEntries(readdirSync(PUBLIC).filter(n=>!['manifest.json','ledger.json'].includes(n)).map(n=>[n,fileSha(resolve(PUBLIC,n))]));
sealed(resolve(PUBLIC,'manifest.json'),{format:'phase-a-300ms-m4-public-v1',registration:r.checksum,files,allGames:512,families:256,originalArchivesUnchanged:true,unmodifiedProduction:true,scope:'Compact public legal paths, all per-move numerical telemetry in column form, complete admission receipts, literal registered source trajectories and hashes. Full raw game/prefix/pair files and historical bulk index remain local; independent certificates bind their SHA-256 identities.'});
ledger('compact-evidence-published',{registration:r.checksum});console.log(JSON.stringify({passed:true,games:512,score:a.mean,independentConfirmation:a.independentConfirmation}));
