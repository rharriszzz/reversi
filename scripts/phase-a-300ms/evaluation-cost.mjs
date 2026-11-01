import {boardArgs} from '../native/client.mjs';
import {qualification,players,sealed,OUT,ledger} from './tournament-common.mjs';
const q=qualification(),p=await players(q.build),rows=[];
try{
 for(let rep=0;rep<5;rep++)for(const root of q.roots)for(const model of rep%2?['P','B']:['B','P']){
  const result=await p.engines[model].request(`evalbench ${boardArgs(root.board,root.player,model)} 20000`);
  rows.push({rep,root:root.id,occupied:root.board.filter(Boolean).length,model,...result});
 }
 sealed(`${OUT}/evaluation-cost.json`,{nonconfirmation:true,scope:'Repeated static evaluation of disclosed engineering roots. Same boards for B/P; not tree throughput or independent strength observations.',rows});
 ledger('matched-static-evaluation-cost',{rows:rows.length});console.log(JSON.stringify({rows:rows.length}));
}finally{Object.values(p.engines).forEach(e=>e.close());}
