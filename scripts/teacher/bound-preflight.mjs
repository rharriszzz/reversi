// Independent adapter preflight; imports no Edax search implementation.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {sha,query,alternatives} from './edax.mjs';
import {validate} from './validate.mjs';
import {solveBoth} from './exact.mjs';
import {hash} from './qualification-core.mjs';
import {read,atomic} from '../research/io.mjs';
import {replay} from './qualification.mjs';
import {play} from '../../src/rules.js';
const root=fileURLToPath(new URL('../..',import.meta.url));
const files=['scripts/teacher/edax.mjs','scripts/teacher/edax-bound.patch','scripts/teacher/bound-preflight.mjs','scripts/teacher/bound-window-check.mjs','scripts/teacher/bound-confirm.mjs','scripts/teacher/bound-horizon-oracle.c','scripts/teacher/exact.mjs','scripts/teacher/validate.mjs','scripts/teacher/qualification.mjs','tests/oracle.mjs','tests/fixtures/edax-bound.json','tests/fixtures/edax-bound-leaf.json','src/rules.js','src/learning.js'];
export const preflightIdentity=pin=>({pin,files:Object.fromEntries(files.map(p=>[p,sha(resolve(root,p))]))});
export function verifyPreflight(path,pin,{requireReady=true}={}){const r=read(path);if(!r.passed||r.identity!==hash(preflightIdentity(pin)))throw Error('Independent adapter preflight source/build mismatch');if(requireReady&&(!r.readyForQualification||!r.evidence?.length))throw Error('Independent adapter preflight is not ready for qualification');for(const e of r.evidence??[])if(sha(e.path)!==e.sha256)throw Error('Preflight engineering evidence changed');return r;}
export function extremeFixtures(){
 const live=Array(64).fill(1);for(const i of [0,3,8,16])live[i]=0;for(const i of [1,17])live[i]=-1;
 const pass=Array(64).fill(1);pass[0]=0;pass[1]=-1;
 return [{id:'live-awarded-64-raw-63',board:live,player:1},{id:'live-color-exchange',board:live.map(x=>-x),player:-1},{id:'forced-pass-minus64',board:pass,player:-1},{id:'forced-pass-color',board:pass.map(x=>-x),player:1},{id:'terminal-raw63',board:[0,...Array(63).fill(1)],player:1},{id:'terminal-raw-minus63',board:[0,...Array(63).fill(1)],player:-1},{id:'terminal-draw',board:Array.from({length:64},(_,i)=>i%2?1:-1),player:1}];
}
export async function preflight(pin,output,{windows,confirmation}={}){
 const start=performance.now(),validation=await validate(pin,output),exact=[];
 for(const s of extremeFixtures()){
  const reference=solveBoth(s.board,s.player,{capMs:10000}),teacher=await alternatives(pin,s,Math.max(2,s.board.filter(x=>!x).length),{measureNative:true,transcript:`${output}/extreme-${s.id}.json`});
  if(reference.awarded.rows.length){if(hash(teacher.rows.map(({move,value})=>({move,value})))!==hash(reference.awarded.rows.map(({move,value})=>({move,value}))))throw Error('Extreme alternative mismatch');}else if(teacher.rows[0].value!==reference.awarded.value)throw Error('Extreme pass/terminal mismatch');replay(s,teacher);exact.push({state:s,reference,teacher});
 }
 const leafFixture=read(`${root}/tests/fixtures/edax-bound-leaf.json`).state,leafTerminal=await query(pin,[leafFixture],1,{measureNative:true,transcript:`${output}/leaf-terminal.json`}),leafReference=solveBoth(leafFixture.board,leafFixture.player);if(leafTerminal.rows[0].score!==-64||leafReference.awarded.value!==-64)throw Error('Terminal leaf/pass horizon mismatch');
 const fixture=read(`${root}/tests/fixtures/edax-bound.json`),board=[...play(fixture.board,fixture.player,4)],native63=await query(pin,[{board,player:1},{board,player:-1}],11,{measureNative:true,transcript:`${output}/horizon63.json`});
 if(hash(native63.rows.map(x=>x.score))!==hash([63,-63]))throw Error('Requested-horizon saturation mismatch');
 const repaired=await alternatives(pin,fixture,12,{measureNative:true,transcript:`${output}/disclosed-d12.json`});if(hash(repaired.rows.map(x=>x.value))!==hash([-63,-61,-63,-63]))throw Error('Disclosed all-alternative mismatch');replay(fixture,repaired);
 const rotate=b=>{const out=Array(64);for(let i=0;i<64;i++)out[(i%8)*8+7-(i>>3)]=b[i];return out;};
 for(const [board,player,map] of [[rotate(fixture.board),fixture.player,i=>(i%8)*8+7-(i>>3)],[fixture.board.map(x=>-x),-fixture.player,i=>i]]){const r=await alternatives(pin,{board,player},12,{measureNative:true});if(r.rows.some(x=>x.value!==repaired.rows.find(y=>map(y.move)===x.move)?.value))throw Error('Bound fixture transformation mismatch');replay({board,player},r);}
 let readyForQualification=false;const evidence=[];if(windows&&confirmation){const w=read(windows),c=read(confirmation);if(!w.passed||w.protocol.referenceSha256!==sha(confirmation)||w.comparisons<2000||hash(w.protocol.pin)!==hash(pin)||!c.passed||!c.allValidated||c.records.fresh.length!==64||c.records.exact.length!==16||c.records.regression.length!==154||hash(c.protocol.pin)!==hash(pin))throw Error('Engineering readiness evidence incomplete/mismatched');for(const p of [windows,confirmation])evidence.push({path:resolve(p),sha256:sha(p)});readyForQualification=true;}
 const result={passed:true,readyForQualification,evidence,identity:hash(preflightIdentity(pin)),inputs:preflightIdentity(pin),validation,exact,leafTerminal:{state:leafFixture,teacher:leafTerminal,reference:leafReference},horizon63:native63,disclosed:repaired,elapsedMs:performance.now()-start};atomic(`${output}/adapter-preflight.json`,result);return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [buildFile,evalFile,output,windows,confirmation]=process.argv.slice(2),{identity}=await import('./edax.mjs'),meta=read(buildFile);const r=await preflight(identity(meta.binary,evalFile,{buildFile}),resolve(output),{windows,confirmation});console.log(JSON.stringify({passed:r.passed,fixtures:r.validation.fixtures,extremes:r.exact.length,elapsedMs:r.elapsedMs}));
}
