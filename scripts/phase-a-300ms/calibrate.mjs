// Disclosed nonconfirmation complete opening games, not selected match samples.
import {qualification,players,OUT,sealed,atomic,ledger} from './tournament-common.mjs';
import {playGame} from '../native-v2/game.mjs';
const q=qualification(),games=[];
for(let i=0;i<2;i++){
 const p=await players(q.build,i),start=performance.now();
 try{
  const opening=q.roots[0],result=await playGame(p.engines,opening,{color:i?-1:1,timeMs:300,checkpoint:g=>atomic(`${OUT}/calibration-prefix-${i}.json`,g)});
  games.push({opening,result,wallMs:performance.now()-start});
 }finally{Object.values(p.engines).forEach(e=>e.close());}
}
sealed(`${OUT}/calibration.json`,{nonconfirmation:true,disclosedRoot:'native-engineering-0',games});
ledger('complete-opening-calibration',{games:2});
console.log(JSON.stringify({games:2,searchMs:games.map(g=>g.result.moveTimeMs),wallMs:games.map(g=>g.wallMs)}));
