// Independent exact endgame solver. Sentinel-board rules are implemented here;
// no production rules/search, external-engine code, or learned data are imported.
const STEPS=[-11,-10,-9,-1,1,9,10,11];
const CELLS=Int16Array.from({length:64},(_,i)=>11+(i>>3)*10+(i&7));
const SQUARE=new Int16Array(100).fill(-1);CELLS.forEach((at,i)=>{SQUARE[at]=i;});
const EXACT=1,LOWER=2,UPPER=3;
export class ExactAbort extends Error {
  constructor(reason,stats){super(`Independent exact cap: ${reason}`);this.name='ExactAbort';this.stats={...stats};}
}
function validate(board,player){if(board.length!==64||!Array.from(board).every(x=>x===-1||x===0||x===1)||![-1,1].includes(player))throw Error('Invalid exact board/turn');}

export class ExactSolver {
  constructor({tableBits=18,useTT=true,ordering=true,signal=null,now=()=>performance.now(),onNode=null}={}){
    if(!Number.isInteger(tableBits)||tableBits<0||tableBits>22)throw Error('Exact tableBits must be 0..22');
    this.useTT=useTT;this.ordering=ordering;this.signal=signal;this.now=now;this.onNode=onNode;
    const n=useTT?2**tableBits:1;this.mask=n-1;
    this.keys=Array.from({length:4},()=>new Uint32Array(n));
    this.tags=new Uint8Array(n);this.scores=new Int8Array(n);this.bestMoves=new Int8Array(n);
    this.tableBytes=this.keys.reduce((n,a)=>n+a.byteLength,0)+this.tags.byteLength+this.scores.byteLength+this.bestMoves.byteLength;
    // One move list per placement depth. Passes need no additional ply buffer.
    this.buffers=Array.from({length:65},()=>({moves:new Int16Array(64),sizes:new Uint8Array(64),flips:new Int16Array(4096),order:new Uint8Array(64),priority:new Int16Array(64)}));
    this.scratchBytes=this.buffers.reduce((n,b)=>n+Object.values(b).reduce((n,a)=>n+a.byteLength,0),0);
  }
  clear(){this.tags.fill(0);}
  check(){
    if(this.signal?.aborted)throw new ExactAbort('cancelled',this.stats);
    if(this.now()>=this.deadline)throw new ExactAbort('deadline exceeded',this.stats);
  }
  generate(player,ply,favored=-1){
    const b=this.board,buf=this.buffers[ply];let n=0;
    for(const at of this.emptyCells){
      if(b[at]!==0)continue;let size=0;
      for(const step of STEPS){let cursor=at+step;while(b[cursor]===-player)cursor+=step;if(b[cursor]!==player)continue;
        for(let pos=at+step;pos!==cursor;pos+=step)buf.flips[n*64+size++]=pos;
      }
      if(!size)continue;buf.moves[n]=at;buf.sizes[n]=size;buf.order[n]=n;
      const move=SQUARE[at],corner=move===0||move===7||move===56||move===63;
      const adjacentEmpty=(b[at-10]===0)+(b[at+10]===0)+(b[at-1]===0)+(b[at+1]===0);
      buf.priority[n]=(move===favored?20000:0)+(corner?1000:0)+(adjacentEmpty===0?100:0)-size;
      n++;
    }
    if(this.ordering)for(let i=1;i<n;i++){const x=buf.order[i];let j=i;while(j>0&&buf.priority[buf.order[j-1]]<buf.priority[x]){buf.order[j]=buf.order[j-1];j--;}buf.order[j]=x;}
    this.stats.generations++;this.stats.generatedMoves+=n;return n;
  }
  // Full bitboards are keys only, not the rule implementation. XOR updates are
  // reversible. The index hash can collide; all four words AND side/convention
  // are checked before accepting any entry.
  toggle(at,player){const square=SQUARE[at],word=(square>>>5)+(player===1?0:2);this.words[word]=(this.words[word]^(1<<(square&31)))>>>0;}
  make(buf,i,player){const at=buf.moves[i],n=buf.sizes[i];this.board[at]=player;this.toggle(at,player);
    for(let j=0;j<n;j++){const f=buf.flips[i*64+j];this.board[f]=player;this.toggle(f,-player);this.toggle(f,player);}
    this.stats.applications++;
  }
  unmake(buf,i,player){const at=buf.moves[i],n=buf.sizes[i];this.board[at]=0;this.toggle(at,player);
    for(let j=0;j<n;j++){const f=buf.flips[i*64+j];this.board[f]=-player;this.toggle(f,player);this.toggle(f,-player);}
  }
  visit(player,empty,margin,alpha,beta,ply,passed=false){
    this.stats.nodes++;if(this.onNode)this.onNode(this.stats.nodes);if((this.stats.nodes&255)===0)this.check();
    const alphaOriginal=alpha,betaOriginal=beta,w=this.words;
    let indexHash=Math.imul(w[0],-1640531535)^Math.imul(w[1],-2048144789)^Math.imul(w[2],-1028477387)^w[3]^(player===1?0x9e3779b9:0);
    indexHash^=indexHash>>>16;indexHash=Math.imul(indexHash,-2048144789);indexHash^=indexHash>>>13;const slot=indexHash&this.mask;
    const tag=(player===1?4:0)|(this.awarded?8:0);let favored=-1;
    if(this.useTT&&this.tags[slot]){
      const stored=this.tags[slot];
      if((stored&12)===tag&&this.keys[0][slot]===w[0]&&this.keys[1][slot]===w[1]&&this.keys[2][slot]===w[2]&&this.keys[3][slot]===w[3]){
        this.stats.ttHits++;favored=this.bestMoves[slot];const flag=stored&3,score=this.scores[slot];
        if(flag===EXACT){this.stats.ttExactHits++;return score;}
        if(flag===LOWER){this.stats.ttLowerHits++;alpha=Math.max(alpha,score);}else{this.stats.ttUpperHits++;beta=Math.min(beta,score);}
        if(alpha>=beta){this.stats.ttCutoffs++;return score;}
      }else this.stats.ttCollisions++;
    }
    let best=-65,bestMove=-1;
    const n=this.generate(player,ply,favored),buf=this.buffers[ply];
    if(n===0){
      // No placement: side changes but board, empties and depth do not.
      if(passed){const raw=margin*player;best=raw+(this.awarded?Math.sign(raw)*empty:0);this.stats.terminals++;}
      else {this.stats.passes++;best=-this.visit(-player,empty,margin,-beta,-alpha,ply,true);}
    }else{
      for(let j=0;j<n;j++){
        const i=buf.order[j],move=SQUARE[buf.moves[i]],nextMargin=margin+player*(1+2*buf.sizes[i]);
        this.make(buf,i,player);let value;
        try{value=-this.visit(-player,empty-1,nextMargin,-beta,-alpha,ply+1);}finally{this.unmake(buf,i,player);}
        if(value>best){best=value;bestMove=move;}alpha=Math.max(alpha,best);
        if(alpha>=beta){this.stats.cutoffs++;if(j===0)this.stats.firstMoveCutoffs++;break;}
      }
    }
    if(this.useTT){
      // Classify against the incoming window, including any reused compatible
      // bounds. A bound at one root child never becomes another child's value.
      const flag=best<=alphaOriginal?UPPER:best>=betaOriginal?LOWER:EXACT;
      for(let i=0;i<4;i++)this.keys[i][slot]=w[i];this.scores[slot]=best;this.bestMoves[slot]=bestMove;this.tags[slot]=tag|flag;
      this.stats.ttStores++;this.stats[flag===EXACT?'exactStores':flag===LOWER?'lowerStores':'upperStores']++;
    }
    return best;
  }
  solve(board,player,awarded=true,deadline=performance.now()+10000){
    validate(board,player);if(typeof awarded!=='boolean'||!Number.isFinite(deadline))throw Error('Invalid exact convention/deadline');
    const start=this.now();this.deadline=deadline;this.awarded=awarded;this.stats={nodes:0,generations:0,generatedMoves:0,applications:0,cutoffs:0,firstMoveCutoffs:0,passes:0,terminals:0,ttHits:0,ttExactHits:0,ttLowerHits:0,ttUpperHits:0,ttCutoffs:0,ttCollisions:0,ttStores:0,exactStores:0,lowerStores:0,upperStores:0};
    this.check();this.board=new Int8Array(100).fill(2);this.emptyCells=[];this.words=new Uint32Array(4);let margin=0;
    for(let i=0;i<64;i++){const v=board[i],at=CELLS[i];this.board[at]=v;margin+=v;if(!v)this.emptyCells.push(at);else this.toggle(at,v);}
    const n=this.generate(player,0),buf=this.buffers[0],rows=[];let value;
    if(!n)value=this.visit(player,this.emptyCells.length,margin,-65,65,0);
    else{
      // Every root alternative is independently searched to a FULL window.
      // Compatible TT information is shared, alpha never carries across roots.
      for(let j=0;j<n;j++){
        this.check();const i=buf.order[j],move=SQUARE[buf.moves[i]],before=this.stats.nodes,t=this.now(),nextMargin=margin+player*(1+2*buf.sizes[i]);
        this.make(buf,i,player);let v;try{v=-this.visit(-player,this.emptyCells.length-1,nextMargin,-65,65,1);}finally{this.unmake(buf,i,player);}
        rows.push({move,value:v||0,nodes:this.stats.nodes-before,wallMs:this.now()-t});
      }
      value=Math.max(...rows.map(x=>x.value));
    }
    this.check();rows.sort((a,b)=>a.move-b.move);
    return {value:value||0,rows,nodes:this.stats.nodes,stats:{...this.stats},wallMs:this.now()-start,tableBytes:this.tableBytes,scratchBytes:this.scratchBytes,exact:true,convention:awarded?'winner-awarded-empties':'occupied-disc-margin',perspective:'root side to move'};
  }
}
export function solveExact(board,player,awarded=true,deadline=performance.now()+10000,options={}){
  const solver=new ExactSolver(options);return solver.solve(board,player,awarded,deadline);
}
export function solveBoth(board,player,{capMs=10000,deadline, ...options}={}){
  if(!Number.isFinite(capMs)||capMs<0)throw Error('Invalid exact cap');
  const start=performance.now(),limit=deadline??start+capMs,solver=new ExactSolver(options);
  const awarded=solver.solve(board,player,true,limit),raw=solver.solve(board,player,false,limit);
  if(performance.now()>=limit)throw new ExactAbort('combined convention deadline exceeded',raw.stats);
  return {awarded,raw,wallMs:performance.now()-start,exact:true};
}
