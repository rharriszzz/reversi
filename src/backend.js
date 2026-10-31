// A backend belongs to one worker. Initialization is lazy and shared by queued
// requests; cancellation terminates that worker and all its private Wasm memory.
import {scoreAllMoves,bestMove} from './search.js';
import {DEFAULT_WEIGHTS} from './features.js';
import {reviewGame} from './review.js';
export class SearchBackend {
 constructor(load=async()=>{const {WasmEngine}=await import('./wasm-engine.js');return WasmEngine.create();}){this.load=load;this.initializing=null;}
 async dispatch(request) {
  const {type,id,board,player,depth,history,human,evaluator='B',timeMs}=request;
  if(!['analyze','play','review'].includes(type))throw Error(`Unknown message type: ${type}`);
  if(!['B','L','P'].includes(evaluator))throw Error('Unknown evaluator');
  let engine=null,warning='';
  try{engine=await(this.initializing??=this.load());}
  catch(error){
   warning=`WebAssembly unavailable: ${error.message}`;
   if(evaluator!=='B')throw Error(`${warning}. Frozen ${evaluator} is unavailable; select B to use JavaScript. No evaluator was substituted.`);
   warning+=' · B is using the JavaScript fallback.';
  }
  const backend=engine?'WebAssembly':'JavaScript',model=evaluator;
  const tag=r=>({...r,backend,model,warning,initializationMs:engine?.initializationMs??0});
  const analyze=(b,p)=>tag(engine?engine.analyze(b,p,depth,evaluator):scoreAllMoves(Int8Array.from(b),p,depth,DEFAULT_WEIGHTS));
  if(type==='analyze')return {type:'analyzed',id,analysis:analyze(board,player),backend,model,warning};
  if(type==='play') {
   const choice=engine?engine.search(board,player,{model:evaluator,...(timeMs?{timeMs}:{depth})})
    :bestMove(Int8Array.from(board),player,depth,DEFAULT_WEIGHTS,timeMs?{timeMs}:{});
   return {type:'played',id,choice:tag(choice),backend,model,warning};
  }
  if(type==='review') {
   const rows=engine?history.flatMap((frame,index)=>{
    if(frame.player!==human)return [];
    const a=analyze(frame.board,frame.player),chosen=a.results.find(r=>r.move===frame.move),best=a.results[0];
    if(!chosen||!best)throw Error('Review history contains an illegal move');
    return [{index,played:chosen.notation,best:best.notation,score:chosen.score,bestScore:best.score,loss:best.score-chosen.score,exact:a.exact,pv:best.pv,depth,model,backend}];
   }).sort((a,b)=>b.loss-a.loss||a.index-b.index):reviewGame(history,depth,DEFAULT_WEIGHTS,human);
   return {type:'reviewed',id,rows,backend,model,warning};
  }
  throw Error(`Unknown message type: ${type}`);
 }
}
