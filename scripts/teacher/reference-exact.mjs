// Straightforward original mailbox alpha-beta, retained as a correctness oracle.
// No production search or evaluator imports. Optional instrumentation changes cost, not decisions.
import {oracleChildren} from '../../tests/oracle.mjs';
export function solveReference(board,player,awarded=true,deadline=performance.now()+10000,{children=oracleChildren,trace=null}={}) {
  let nodes=0;
  const visit=(b,p,a=-65,z=65)=>{
    if(++nodes%256===0&&performance.now()>deadline)throw Error('Independent solve cap');
    const moves=children(b,p);
    if(!moves.length){
      if(children(b,-p).length)return -visit(b,-p,-z,-a);
      const raw=b.reduce((v,x)=>v+x*p,0);
      return raw+(awarded?Math.sign(raw)*b.filter(x=>!x).length:0);
    }
    let best=-65;
    for(const c of moves){best=Math.max(best,-visit(c.board,-p,-z,-a));a=Math.max(a,best);if(a>=z){if(trace)trace.cutoffs++;break;}}
    return best;
  };
  const rows=children(board,player).map(c=>{
    const start=performance.now(),before=nodes;
    const value=-visit(c.board,-player);
    if(trace)trace.alternatives.push({move:c.move,nodes:nodes-before,wallMs:performance.now()-start});
    return {move:c.move,value};
  });
  return {value:rows.length?Math.max(...rows.map(r=>r.value)):visit(board,player),rows,nodes};
}
