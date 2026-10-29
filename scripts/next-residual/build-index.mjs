// Extend the completed run's compact complete historical index without rebuilding
// its multi-million-string heap. Verify the base and inventory the entire delta.
import { readFileSync,readdirSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { KeyIndex } from '../residual/index.mjs';
import { trajectoryKeys,keysFor } from '../residual/data.mjs';
import { legalMoves,play,initialBoard,counts } from '../../src/rules.js';
import { seededRandom } from '../../src/learning.js';
import { atomic,read } from '../research/io.mjs';
import { hash } from './protocol.mjs';
import { pilotGameKeys } from './exclusions.mjs';
const [old,output,runIdentity]=process.argv.slice(2),start=performance.now();
const base=KeyIndex.load(`${old}/historical-index.bin`),saved=read(`${old}/historical-index.json`);
if(base.digest()!==saved.digest)throw Error('Base historical index corrupted');
const extra=new Set(),seeds=new Set(saved.seeds),inventory=[];
const add=board=>{if(64-counts(board).empty>=12)for(const k of keysFor(board))extra.add(k);};
function addPV(state,result){
  add(state.board);for(const row of result.rows??[]){let board=[...state.board],player=state.player;
    for(const move of [row.move,...(row.pv??[])]){
      if(move===undefined)continue;
      if(move===null){if(legalMoves(board,player).length)throw Error('Exclusion PV illegal pass');}
      else{if(!legalMoves(board,player).includes(move))throw Error('Exclusion PV illegal move');board=[...play(board,player,move)];}
      add(board);player=-player;
    }
  }
}
// Base inventory predates completion of OLD. Every trajectory, reservation,
// frontier and later queried PV is added, including unused game reservations.
const reservations=read(`${old}/reservation-progress.json`);
for(const root of reservations.roots){const tr=read(`${old}/trajectories/${root.id}.json`),f=existsSync(`${old}/frontiers/${root.id}.json`)?read(`${old}/frontiers/${root.id}.json`).result:null;
  for(const k of trajectoryKeys(tr,f))extra.add(k);seeds.add(tr.seed);}
for(const directory of [old,output])for(const file of readdirSync(`${directory}/tasks`).filter(n=>n.endsWith('.json'))) {
  const path=`${directory}/tasks/${file}`,bytes=readFileSync(path),r=JSON.parse(bytes);
  inventory.push([resolve(path),hash(bytes.toString('utf8'))]);
  if(r.resultHash!==hash(r.result))throw Error('Historical task digest mismatch');
  if(r.job.type==='label')addPV(r.job.state,r.result);
  if(r.job.type==='frontier'){
    for(const p of r.result.parents){add(p.board);for(const c of p.children)add(c.board);}
    const root=r.job.root;
    for(const line of r.result.lines){let b=root.board,p=root.player;for(const step of line.steps){if(step.move!==null)b=[...play(b,p,step.move)];add(b);p=-p;}}
  }
}
// New correctness fixtures use seeded complete trajectories. They are disclosed
// engineering boards, so explicitly exclude all of them from every new role.
for(const seed of Array.from({length:12},(_,i)=>9302811+i)) {
  const random=seededRandom(seed);let board=[...initialBoard()],player=1,passes=0;
  while(passes<2){add(board);const moves=legalMoves(board,player);if(!moves.length){passes++;player=-player;continue;}passes=0;board=[...play(board,player,moves[Math.floor(random()*moves.length)])];player=-player;}
}
const played=pilotGameKeys(read(`${old}/pilot-results.json`),read(`${output}/engineering-v2/pilot.json`),read(`${old}/reservations.json`));for(const key of played.keys)extra.add(key);
const delta=KeyIndex.from(extra),merged=Buffer.allocUnsafe(base.bytes.length+delta.bytes.length);let i=0,j=0,k=0;
while(i<base.size||j<delta.size){let source,index;
  if(j===delta.size||i<base.size&&base.bytes.compare(delta.bytes,j*32,j*32+32,i*32,i*32+32)<0){source=base.bytes;index=i++;}
  else if(i===base.size||delta.bytes.compare(base.bytes,i*32,i*32+32,j*32,j*32+32)<0){source=delta.bytes;index=j++;}
  else{source=base.bytes;index=i++;j++;}
  source.copy(merged,k*32,index*32,index*32+32);k++;
}
const index=new KeyIndex(merged.subarray(0,k*32));index.save(`${output}/historical-index.bin`);
const body={runIdentity,base:{path:resolve(old),digest:saved.digest,keys:base.size},delta:delta.size,keys:index.size,digest:index.digest(),seeds:[...seeds],
  inventoryHash:hash(inventory),inventory,engineeringGames:played.games,engineeringGameKeys:played.keys.size,wallMs:performance.now()-start,rssBytes:process.resourceUsage().maxRSS*1024};
atomic(`${output}/historical-index.json`,body);console.log(JSON.stringify({keys:index.size,delta:delta.size,seconds:body.wallMs/1000,rssMiB:body.rssBytes/2**20}));
