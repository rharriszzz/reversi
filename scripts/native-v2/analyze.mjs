#!/usr/bin/env node
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {output,read,checked,atomic,measure} from './common.mjs';
import {analyze,telemetry} from './statistics.mjs';
await measure('complete-fixed-sample-analysis',async()=>{
 const reg=checked(resolve(output,'registration.json')),provenance=checked(resolve(output,'provenance-audit.json'));assert.equal(provenance.registration,reg.checksum);assert.equal(provenance.scoreSummariesOpened,false);
 const games=reg.schedule.map((c,i)=>{const r=checked(resolve(output,`games/game-${i}.json`));assert.deepEqual(r.condition,c);return {...r.result,...c,game:i,wallMs:r.wallMs};});
 const statistics=analyze(games),subgroups=[];
 for(const ms of [80,300])for(const factor of ['policy','occupied','cell','player'])for(const value of new Set(reg.openings.map(r=>r[factor]))){const xs=statistics.pairs.filter(p=>p.timeMs===ms&&reg.openings[p.family][factor]===value);subgroups.push({timeMs:ms,factor,value,families:xs.length,mean:xs.reduce((n,x)=>n+x.score,0)/xs.length});}
 const summary={registration:reg.checksum,receipt:reg.receipt,statistics,telemetry:telemetry(games),subgroups,provenance:{checksum:provenance.checksum,sourceFamilySeparation:provenance.sourceFamilySeparation,directLPKeys:provenance.directLPKeys,provenOlderDirectKeys:provenance.provenOlderDirectKeys,prohibitedKeys:provenance.prohibitedKeys,unresolvedKeys:provenance.unresolvedKeys,broaderDirectStateSeparation:provenance.broaderDirectStateSeparation},games:2048,complete:true};
 atomic(resolve(output,'summary.json'),summary);console.log(JSON.stringify({complete:true,scores:Object.fromEntries(Object.entries(statistics.conditions).map(([k,v])=>[k,{mean:v.mean,lower:v.approximateOneSided975Lower,bounded:v.conservativeOneSided975Lower,wins:v.wins,draws:v.draws,losses:v.losses}])),matchedDifference:statistics.difference.mean}));
});
