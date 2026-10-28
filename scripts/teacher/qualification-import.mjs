// Read-only import of previously reserved, never evaluated assessment inputs.
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {read,sourceDigest,seedFor,atomic} from '../research/io.mjs';
import {hash} from './qualification-core.mjs';
import {canonical} from '../research/core.mjs';
import {initialBoard,legalMoves,play,counts} from '../../src/rules.js';
import {findBestMove} from '../../src/search.js';
import {legalMovesFast} from '../../src/fast-features.js';
import {seededRandom} from '../../src/learning.js';
export const ORIGINAL_RESERVATION={directory:'teacher-qualification-v2-20261028',digest:'380ec247b80087296a993e6d2925bd1a81735b8b4291e93da68c1040f920242b',receiptSha:'88fa005675864fe9bd247172283f0e09cd5f77a9b30147612ec292d1eba3aadb',resultsSha:'e8890494361dac2f1efcde74c141de8d430d4e6ccb789bc2ef77c5cc829eba03'};
const same=(a,b)=>hash(a)===hash(b);
export function verifyTrajectory(root,tr,namespace){
 if(!Array.isArray(root.board)||root.board.length!==64||!root.board.every(x=>[-1,0,1].includes(x))||![-1,1].includes(root.player)||root.occupied!==64-counts(root.board).empty||root.key!==canonical(root.board,root.player)||legalMoves(root.board,root.player).length<2)throw Error('Invalid imported board/turn/canonical identity');
 for(const key of Object.keys(root))if(!same(root[key],tr[key]))throw Error('Trajectory root metadata mismatch');
 if(root.seed!==seedFor(namespace,root.role,root.index))throw Error('Trajectory seed mismatch');
 const [lo,hi]=(root.role==='assessment'||root.role==='cost')?[[12,19],[20,35],[36,47],[48,55]][root.phase]:[root.occupied,root.occupied];
 const target=lo+Math.floor(seededRandom(root.seed)()*(hi-lo+1));if(target!==root.occupied)throw Error('Trajectory target mismatch');
 let board=[...initialBoard()],player=1,passes=0,found=false;const history=[];
 for(const step of tr.moves){if(passes===2||step.player!==player)throw Error('Invalid source trajectory turn');
  if(board.filter(Boolean).length>=12)history.push({board:[...board],player});
  if(same(board,root.board)&&player===root.player)found=true;
  const legal=legalMoves(board,player);if(step.move===null){if(legal.length)throw Error('Illegal source pass');passes++;}else{if(!legal.includes(step.move))throw Error('Illegal source move');board=[...play(board,player,step.move)];passes=0;}player=-player;
 }
 if(!found||passes!==2||!same(board,tr.terminal)||!same(history,tr.history))throw Error('Incomplete or mismatched source trajectory');
 return new Set([...history.flatMap(s=>[canonical(s.board,1),canonical(s.board,-1)]),...legalMoves(root.board,root.player).flatMap(m=>{const b=play(root.board,root.player,m);return [canonical(b,1),canonical(b,-1)];})]);
}
export function verifySourcePolicy(root,tr){
 const rng=seededRandom(root.seed);rng();let board=[...initialBoard()],player=1;
 for(const step of tr.moves){const legal=legalMovesFast(board,player);if(!legal.length){if(step.move!==null)throw Error('Source-policy pass mismatch');player=-player;continue;}
  const occupied=board.filter(Boolean).length,random=root.policy==='random-exact'||occupied<12||rng()<(root.policy==='B4-2%'?.02:.12);
  const move=random?legal[Math.floor(rng()*legal.length)]:findBestMove(board,player,root.policy==='B4-2%'?4:1,undefined,{legalMoves:legalMovesFast}).move;
  if(move!==step.move)throw Error('Source-policy deterministic replay mismatch');board=[...play(board,player,move)];player=-player;
 }
}
export function inspectOriginal(repository){
 const dir=`${repository}/.local-research/${ORIGINAL_RESERVATION.directory}`,r=read(`${dir}/tasks/reservation.json`),old=read(`${dir}/results.json`),manifest=read(`${dir}/manifest.json`);
 if(hash(readFileSync(`${dir}/tasks/reservation.json`,'utf8'))!==ORIGINAL_RESERVATION.receiptSha||hash(readFileSync(`${dir}/results.json`,'utf8'))!==ORIGINAL_RESERVATION.resultsSha||r.result.digest!==ORIGINAL_RESERVATION.digest||hash(r.result.roles)!==r.result.digest)throw Error('Original reservation digest mismatch');
 if(old.status!=='stopped'||old.stage!=='calibration'||old.assessment||old.exactAssessment||old.selection||manifest.runIdentity!==old.runIdentity||hash({frozen:old.source,pin:old.pin,protocol:old.protocol})!==old.runIdentity||r.inputHash!==hash({input:r.input,runIdentity:old.runIdentity})||sourceDigest(`${dir}/source`)!==old.source)throw Error('Original stopped-run provenance mismatch');
 for(const sub of ['tasks','raw','failed-tasks'])if(existsSync(`${dir}/${sub}`))for(const file of readdirSync(`${dir}/${sub}`))if(/^(assessment-|exact-assessment-)/.test(file))throw Error('Original assessment has been evaluated');
 // Policy replay uses the unchanged B implementation; enforce byte identity.
 for(const name of readdirSync(`${repository}/src`))if(/\.js$/.test(name)&&hash(readFileSync(`${repository}/src/${name}`,'utf8'))!==hash(readFileSync(`${dir}/source/src/${name}`,'utf8')))throw Error('Original source-policy implementation changed');
 return {dir,old,reservation:r.result};
}
export function importReservations(repository,output,historical,check,inspection=inspectOriginal(repository)){
 const {dir,old,reservation}=inspection,roles={assessment:reservation.roles.assessment,'exact-assessment':reservation.roles['exact-assessment']},seen=new Set(),seeds=new Set(),trajectories={};
 if(roles.assessment.length!==256||roles['exact-assessment'].length!==64)throw Error('Wrong import denominator');
 for(const [role,roots] of Object.entries(roles))for(const [i,root] of roots.entries()){
  check();if(root.id!==`${role}-${i}`||root.role!==role||seeds.has(root.seed)||historical.seeds.has(root.seed))throw Error('Duplicate/imported trajectory seed');seeds.add(root.seed);
  if(role==='assessment'&&(root.phase!==Math.floor(i/64)||root.policy!==(i%2?'B4-2%':'B1-12%')))throw Error('Changed phase/policy distribution');
  if(role==='exact-assessment'&&(root.occupied!==(i<32?54:52)||root.policy!=='random-exact'||root.phase!==3))throw Error('Changed exact distribution');
  const tr=read(`${dir}/trajectories/${root.id}.json`),keys=verifyTrajectory(root,tr,old.protocol.namespace);
  for(const k of keys){if(historical.keys.has(k)||seen.has(k))throw Error('Imported reservation historical/duplicate leakage');seen.add(k);}verifySourcePolicy(root,tr);trajectories[root.id]=hash(tr);atomic(`${output}/trajectories/${root.id}.json`,tr);
 }
 const provenance={...ORIGINAL_RESERVATION,oldSource:old.source,oldProtocol:old.protocol,oldRunIdentity:old.runIdentity,previouslyReserved:true,previouslyEvaluated:false,deterministicSourcePolicyReplay:true,sourcePolicyByteIdentity:true,rolesDigest:hash(roles),oddIds:roles.assessment.filter((_,i)=>i%64<8).map(s=>s.id),trajectoryHashes:trajectories,verifiedKeys:seen.size};
 return {roles,provenance,keys:seen,seeds};
}
