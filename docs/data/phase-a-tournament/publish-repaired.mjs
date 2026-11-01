#!/usr/bin/env node
// Publication-only correction: match the frozen primary Python verifier's
// explicitly coded linear percentile interpolation. Original JS used floor
// quantiles; the sample draws, score interval, Student and Hoeffding gates agree.
// Keep both original scientific files immutable and record the discrepancy.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {OUT,PUBLIC,checked,sealed,fileSha} from '../../../scripts/phase-a-mac/tournament-common.mjs';
import {summarize} from '../../../scripts/phase-a-mac/tournament-statistics.mjs';
const root=new URL('../../../',import.meta.url),stats=new URL('scripts/phase-a-mac/tournament-statistics.mjs',root),publisher=new URL('scripts/phase-a-mac/publish-tournament.mjs',root),r=checked(`${OUT}/registration.json`),a=checked(`${OUT}/analysis.json`);
for(const [p,u] of [['scripts/phase-a-mac/tournament-statistics.mjs',stats],['scripts/phase-a-mac/publish-tournament.mjs',publisher]])assert.equal(fileSha(fileURLToPath(u)),r.sources[p]);
const old="import {quantile} from '../teacher/qualification-core.mjs';",replacement="function quantile(xs,p){const a=[...xs].sort((x,y)=>x-y),q=(a.length-1)*p,i=Math.floor(q);return a[i]+(a[Math.ceil(q)]-a[i])*(q-i);}";
let source=readFileSync(stats,'utf8');assert.equal(source.split(old).length,2);source=source.replace(old,replacement);
const absolute=(s,base)=>s.replace(/from (['"])(\.[^'"]+)\1/g,(_,q,p)=>`from '${new URL(p,base).href}'`),url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const repairedStats=url(absolute(source,stats)),prior=summarize(a.pairRows,r.protocol.bootstrapSeed),next=(await import(repairedStats)).summarize(a.pairRows,r.protocol.bootstrapSeed);
assert.deepEqual(next.marginBootstrap95,a.bootstrap.stratifiedWholeFamilyMargin95);assert.deepEqual(next.scoreBootstrap95,prior.scoreBootstrap95);
sealed(`${PUBLIC}/percentile-convention-verification.json`,{registration:r.checksum,analysis:a.checksum,passed:true,primaryConvention:'Linear percentile interpolation, as explicitly implemented in the frozen independent Python analysis.',originalJSFloorMargin95:prior.marginBootstrap95,verifiedLinearMargin95:next.marginBootstrap95,scoreBootstrapAndAllPrimaryGatesUnchanged:true,originalStatisticsSha256:fileSha(fileURLToPath(stats)),originalPublisherSha256:fileSha(fileURLToPath(publisher)),repairSha256:fileSha(fileURLToPath(import.meta.url))});
let body=readFileSync(publisher,'utf8'),needle="from './tournament-statistics.mjs'";assert.equal(body.split(needle).length,2);body=body.replace(needle,`from '${repairedStats}'`);await import(url(absolute(body,publisher)));
