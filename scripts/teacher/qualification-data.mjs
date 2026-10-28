import {existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {historicalKeys} from '../strong/run.mjs';
import {read,atomic,seedFor} from '../research/io.mjs';
import {canonical} from '../research/core.mjs';
import {initialBoard,play,counts,legalMoves} from '../../src/rules.js';
import {legalMovesFast} from '../../src/fast-features.js';
import {findBestMove} from '../../src/search.js';
import {seededRandom} from '../../src/learning.js';
import {inspectOriginal,importReservations,verifyTrajectory} from './qualification-import.mjs';
import {PROTOCOL,hash} from './qualification-core.mjs';
export function boardKeys(s,children=false){const boards=[s.board];if(children)for(const m of legalMoves(s.board,s.player))boards.push([...play(s.board,s.player,m)]);return boards.flatMap(b=>[canonical(b,1),canonical(b,-1)]);}
export function loadHistorical(repository,excludeOutput=null,skipReservation=null){const previous=['strong-six-hour-20261027','six-hour-20261027','next-frozen-screen-20261028'].map(x=>resolve(repository,'.local-research',x));const local=resolve(repository,'.local-research');for(const name of readdirSync(local))if((name.startsWith('teacher-qualification')||name.startsWith('bound-benchmark'))&&resolve(local,name)!==resolve(excludeOutput??'/nonexistent')&&resolve(local,name)!==resolve(skipReservation??'/nonexistent')&&existsSync(`${local}/${name}/tasks/reservation.json`))previous.push(resolve(local,name));for(const name of readdirSync(local))if(name.startsWith('exact-benchmark')&&existsSync(`${local}/${name}/results.json`))previous.push(resolve(local,name));const h=historicalKeys(repository,previous),seeds=new Set();
 for(const dir of previous){let path=`${dir}/manifest.json`;if(!existsSync(path)&&existsSync(`${dir}/results.json`))path=`${dir}/results.json`;if(!existsSync(path))throw Error(`Missing historical run ${dir}`);const m=read(path);for(const state of m.inputs?.states??[])if(state.seed!==undefined)seeds.add(state.seed);if(existsSync(`${dir}/tasks/reservation.json`))for(const roots of Object.values(read(`${dir}/tasks/reservation.json`).result.roles))for(const r of roots)seeds.add(r.seed);for(const x of [m.seed,m.config?.seed])if(x!==undefined)seeds.add(x);for(const paths of Object.values(m.data??{}))for(const p of paths)for(const g of read(p).games??[])if(g.seed!==undefined)seeds.add(g.seed);}
 const teacher=resolve(repository,'.local-research/teacher-audit-v1-20261028');if(!existsSync(`${teacher}/manifest.json`))throw Error('Missing completed teacher audit');
 let teacherTasks=0;for(const name of readdirSync(`${teacher}/tasks`)){const r=read(`${teacher}/tasks/${name}`);if(r.state){for(const k of boardKeys(r.state,true))h.keys.add(k);for(const k of r.state.history??[])h.keys.add(k);if(r.state.index!==undefined)seeds.add(read(`${teacher}/manifest.json`).seed+r.state.index*7919);teacherTasks++;}for(const v of r.records??[])if(v.state)for(const k of boardKeys(v.state,true))h.keys.add(k);}
 // Published continuation endpoints also belong to the historical evidence.
 const published=read(`${repository}/docs/data/teacher-audit-20261028.json`);for(const e of published.summary.examples)for(const line of e.continuations??[])if(line.leaf)for(const k of boardKeys(line.leaf,true))h.keys.add(k);
 if(h.audit.missingLocalInputs)throw Error('Historical inputs incomplete');return {...h,seeds,audit:{...h.audit,teacherTasks,allKeys:h.keys.size,priorSeeds:seeds.size}};
}
export async function reserveData(repository,output,check,progress,{protocol=PROTOCOL}={}){
 const inspection=protocol.version<4?inspectOriginal(repository):null,h=loadHistorical(repository,output,inspection?.dir);
 // Only untouched assessment roles are exempted; every old engineering trajectory stays excluded.
 if(inspection)for(const role of ['cost','exact-cost'])for(const root of inspection.reservation.roles[role]){for(const k of verifyTrajectory(root,read(`${inspection.dir}/trajectories/${root.id}.json`),inspection.old.protocol.namespace))h.keys.add(k);h.seeds.add(root.seed);}
 if(inspection)h.audit.importExemption={directory:inspection.dir,digest:inspection.reservation.digest,engineeringRolesStillExcluded:['cost','exact-cost'],keysBeforeImport:h.keys.size};
 const imported=inspection?importReservations(repository,output,h,check,inspection):{roles:{},keys:new Set(),seeds:new Set(),provenance:null},used=h.keys,seedUsed=h.seeds;for(const k of imported.keys)used.add(k);for(const seed of imported.seeds)seedUsed.add(seed);
 const roles={cost:[],assessment:[],'exact-cost':[],'exact-assessment':[]};let attempts=0;const progressPath=`${output}/admission-progress.json`;let admitted=0;Object.assign(roles,imported.roles);
 if(existsSync(progressPath)){const saved=read(progressPath);if(protocol.version>=4&&saved.identity!==hash({protocol,attempts:saved.attempts,roles:saved.roles}))throw Error('Admission checkpoint identity mismatch');attempts=saved.attempts;if(inspection&&(hash(saved.roles.assessment)!==hash(imported.roles.assessment)||hash(saved.roles['exact-assessment'])!==hash(imported.roles['exact-assessment'])))throw Error('Changed imported admission checkpoint');Object.assign(roles,saved.roles);for(const roots of Object.values(roles))for(const root of roots){const tr=read(`${output}/trajectories/${root.id}.json`);for(const state of tr.history)for(const key of boardKeys(state))used.add(key);for(const key of boardKeys(root,true))used.add(key);seedUsed.add(root.seed);if(!inspection||root.role==='cost'||root.role==='exact-cost')admitted++;}}
 const plan=[];for(const role of (inspection?['cost']:['cost','assessment']))for(let phase=0;phase<4;phase++)for(let j=0;j<(role==='cost'?protocol.costPerPhase:protocol.assessmentPerPhase);j++)plan.push({role,phase,policy:j%2?'B4-2%':'B1-12%',lo:protocol.strata[phase][0],hi:protocol.strata[phase][1]});
 for(const role of (inspection?['exact-cost']:['exact-cost','exact-assessment']))for(const empty of [10,12])for(let j=0;j<(role==='exact-cost'?protocol.exactCostPerEmpty:protocol.exactAssessmentPerEmpty);j++)plan.push({role,phase:3,policy:'random-exact',lo:64-empty,hi:64-empty});
 for(const [slot,spec] of plan.entries()){if(slot<admitted)continue;let accepted=false;while(!accepted){check();if(attempts>=protocol.maxAttempts)throw Error('Admission attempt cap');const index=attempts++,seed=seedFor(protocol.namespace,spec.role,index);if(seedUsed.has(seed))continue;seedUsed.add(seed);const rng=seededRandom(seed),target=spec.lo+Math.floor(rng()*(spec.hi-spec.lo+1));let board=[...initialBoard()],player=1,passes=0,root=null,collision=false;const history=[],moves=[];
  while(passes<2){check();const legal=legalMovesFast(board,player),occupied=64-counts(board).empty;
   if(occupied>=12){const s={board:[...board],player},keys=boardKeys(s);if(keys.some(k=>used.has(k))){collision=true;break;}history.push(s);}
   if(occupied===target&&!root){if(legal.length<2){collision=true;break;}root={board:[...board],player};if(boardKeys(root,true).some(k=>used.has(k))){collision=true;break;}}
   if(!legal.length){passes++;moves.push({player,move:null});player=-player;continue;}passes=0;
   const random=spec.policy==='random-exact'||occupied<(spec.policy==='B4-2%'?12:12)||rng()<(spec.policy==='B4-2%'?.02:.12);
   const move=random?legal[Math.floor(rng()*legal.length)]:findBestMove(board,player,spec.policy==='B4-2%'?4:1,undefined,{legalMoves:legalMovesFast}).move;
   moves.push({player,move});board=[...play(board,player,move)];player=-player;
  }
  if(!collision&&root){const id=`${spec.role}-${roles[spec.role].length}`,r={...root,id,role:spec.role,phase:spec.phase,policy:spec.policy,seed,index,occupied:target,key:canonical(root.board,root.player)};for(const s of history)for(const k of boardKeys(s))used.add(k);for(const k of boardKeys(root,true))used.add(k);atomic(`${output}/trajectories/${id}.json`,{...r,moves,history,terminal:board});roles[spec.role].push(r);accepted=true;atomic(progressPath,{attempts,roles,...(protocol.version>=4?{identity:hash({protocol,attempts,roles})}:{})});}
  if(attempts%25===0)progress(attempts,Object.values(roles).reduce((n,a)=>n+a.length,0));await new Promise(ok=>setImmediate(ok));
 }}
 const result={roles,import:imported.provenance,oddIds:roles.assessment.filter((_,i)=>i%protocol.assessmentPerPhase<protocol.assessmentOddPerPhase).map(s=>s.id),attempts,exclusions:h.audit,allReservedKeys:used.size,seeds:protocol.seedNamespaces.map(name=>({name,namespace:`${protocol.namespace}:${name}`})),digest:hash(roles)};atomic(`${output}/reservations.json`,result);return result;
}
