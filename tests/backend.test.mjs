import test from 'node:test';
import assert from 'node:assert/strict';
import {SearchBackend} from '../src/backend.js';
import {initialBoard} from '../src/rules.js';
import {DEFAULT_WEIGHTS} from '../src/features.js';
import {readFileSync} from 'node:fs';
import {WasmEngine,manifest} from '../src/wasm-engine.js';
const request={type:'analyze',id:1,board:[...initialBoard()],player:1,depth:2,weights:DEFAULT_WEIGHTS};
test('Wasm initialization queues requests once and keeps active frozen evaluator identity',async()=>{
 let release,loads=0;
 const pending=new Promise(resolve=>release=resolve);
 const backend=new SearchBackend(()=>{loads++;return pending;});
 const a=backend.dispatch({...request,evaluator:'P'}),b=backend.dispatch({...request,id:2,evaluator:'B'});
 assert.equal(loads,1);
 release({initializationMs:12,analyze:(board,player,depth,model)=>({results:[],depth,modelIdentity:model})});
 assert.equal((await a).analysis.model,'P');assert.equal((await b).analysis.model,'B');
});
test('a temporary initialization rejection retries; real frozen P serves analysis, play and review',async()=>{
 let attempts=0,engine;
 const backend=new SearchBackend(async()=>{
  if(++attempts===1)throw Error('temporary failure');
  return engine=await WasmEngine.create({moduleOptions:{wasmBinary:readFileSync(new URL('../src/wasm/'+manifest.module.replace('.mjs','.wasm'),import.meta.url))}});
 });
 try{
  await assert.rejects(backend.dispatch({...request,evaluator:'P'}),/No evaluator was substituted/);
  const a=await backend.dispatch({...request,evaluator:'P'});
  assert.equal(a.analysis.modelIdentity,manifest.models.P);assert.equal(a.analysis.backend,'WebAssembly');
  const p=await backend.dispatch({...request,type:'play',evaluator:'P'});assert.equal(p.choice.modelIdentity,manifest.models.P);
  const r=await backend.dispatch({type:'review',id:3,history:[{board:request.board,player:1,move:19}],human:1,depth:2,evaluator:'P'});
  assert.equal(r.model,'P');assert.equal(r.rows[0].model,'P');assert.equal(r.backend,'WebAssembly');assert.equal(attempts,2);
 }finally{engine?.close();}
});
test('failed Wasm visibly falls back only for equivalent B; P/L fail without substitution',async()=>{
 const backend=new SearchBackend(async()=>{throw Error('blocked binary');});
 const r=await backend.dispatch({...request,evaluator:'B'});assert.equal(r.backend,'JavaScript');assert.equal(r.model,'B');assert.match(r.warning,/fallback/);
 for(const evaluator of ['P','L'])await assert.rejects(backend.dispatch({...request,evaluator}),/unavailable.*No evaluator was substituted/);
 assert.equal((await backend.dispatch(request)).model,'B','omitted evaluator defaults to B');
 for(const evaluator of ['custom','unknown'])await assert.rejects(backend.dispatch({...request,evaluator}),/Unknown evaluator/);
 await assert.rejects(backend.dispatch({...request,type:'train'}),/Unknown message type/);
});
