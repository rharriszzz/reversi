import manifest from './wasm/manifest.js';
import {coord,play} from './rules.js';
import {evaluateDetailed,FEATURE_NAMES} from './features.js';
export {manifest};
const names=['B','L','P'];
function boardWords(board,player,model) {
 if(!board||board.length!==64||![1,-1].includes(player)||!names.includes(model))throw Error('Invalid board/player/model');
 const words=[0,0,0,0];
 for(let q=0;q<64;q++){
  const cell=board[q];if(![-1,0,1].includes(cell))throw Error('Invalid board cell');
  if(cell)words[(cell===1?0:2)+(q>>>5)]=(words[(cell===1?0:2)+(q>>>5)]|(1<<(q&31)))>>>0;
 }
 return words;
}
export class WasmEngine {
 static async create({ttMiB=16,moduleOptions={},expected=manifest}={}) {
  if(!Number.isInteger(ttMiB)||ttMiB<0||ttMiB>32)throw Error('Wasm TT must be 0..32 MiB');
  const start=performance.now(),{default:factory}=await import(new URL(`./wasm/${expected.module}`,import.meta.url));
  const module=await factory(moduleOptions);
  if(module._rv_abi()!==expected.abi||module.UTF8ToString(module._rv_build_id())!==expected.fingerprint)throw Error('Wasm module version mismatch; reload the application');
  for(const [i,name] of names.entries())if(module.UTF8ToString(module._rv_identity(i))!==expected.models[name])throw Error(`Wasm ${name} model identity mismatch`);
  const handle=module._rv_create(ttMiB);if(!handle)throw Error('Could not allocate Wasm engine');
  return new WasmEngine(module,handle,performance.now()-start);
 }
 constructor(module,handle,initializationMs){this.module=module;this.handle=handle;this.initializationMs=initializationMs;}
 close(){if(this.handle)this.module._rv_destroy(this.handle);this.handle=0;}
 get memoryBytes(){return this.module.HEAPU8.buffer.byteLength;}
 query(op,board,player,model='B',{depth=3,timeMs=0,nodeLimit=0,tt=true,hints=true}={}) {
  if(!this.handle)throw Error('Wasm engine closed');
  const words=boardWords(board,player,model);
  const start=performance.now();const ptr=this.module._rv_query(this.handle,op,...words,player,names.indexOf(model),depth,timeMs,nodeLimit,+tt,+hints);
  const r=JSON.parse(this.module.UTF8ToString(ptr));
  if(r.error)throw Object.assign(Error(r.error.message),{code:r.error.code});
  const identities=[r.modelIdentity,r.summary?.modelIdentity,...(r.results??[]).map(row=>row.search?.modelIdentity)].filter(Boolean);
  if(identities.some(identity=>identity!==manifest.models[model]))throw Error('Wasm response model identity mismatch');
  return {...r,interfaceMs:performance.now()-start,backend:'WebAssembly',model,modelIdentity:manifest.models[model],buildIdentity:manifest.fingerprint,memoryBytes:this.memoryBytes};
 }
 inspect(board,player,model='B'){return this.query(0,board,player,model);}
 search(board,player,{model='B',depth,timeMs=0,...options}={}) {
  if(!Number.isInteger(depth??0)||!Number.isFinite(timeMs)||timeMs<0||!Number.isSafeInteger(options.nodeLimit??0)||((options.nodeLimit??0)<0))throw Error('Invalid search options');
  return {...this.query(1,board,player,model,{...options,depth:depth??(timeMs>0?0:3),timeMs}),player,budgetMs:timeMs||null};
 }
 analyze(board,player,depth=3,model='B') {
  const r=this.query(2,board,player,model,{depth});
  const keys=Object.keys(FEATURE_NAMES),weights=Object.fromEntries(['opening','middle','endgame'].map((phase,i)=>[phase,Object.fromEntries(keys.map((k,j)=>[k,manifest.weights[names.indexOf(model)][i][j]]))]));
  const results=r.results.map(row=>{
   const child=play(board,player,row.search.move),immediate=evaluateDetailed(child,player,weights);
   if(model==='P'){
    const actual=this.inspect(child,player,model).evaluation;
    immediate.patternCorrection=actual-immediate.score;immediate.score=actual;
   }
   return {...row.search,notation:coord(row.search.move),immediate,pv:row.pv.map(q=>q<0?'pass':coord(q))};
  });
  return {...r.summary,player,results,backend:r.backend,model,modelIdentity:r.modelIdentity,buildIdentity:r.buildIdentity,memoryBytes:this.memoryBytes,interfaceMs:r.interfaceMs,initializationMs:this.initializationMs};
 }
 windows(board,player,model,depth,alpha,beta,tt=true){return this.query(4,board,player,model,{depth,timeMs:alpha,nodeLimit:beta,tt}).values;}
 evalbench(board,player,model,n=20000){return this.query(3,board,player,model,{depth:n});}
}
