import test from 'node:test';
import assert from 'node:assert/strict';
import {SearchBackend} from '../src/backend.js';
import {initialBoard} from '../src/rules.js';
import {DEFAULT_WEIGHTS,cloneWeights} from '../src/features.js';
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
test('failed Wasm visibly falls back only for equivalent B; P/L fail without substitution',async()=>{
 const backend=new SearchBackend(async()=>{throw Error('blocked binary');});
 const r=await backend.dispatch({...request,evaluator:'B'});assert.equal(r.backend,'JavaScript');assert.equal(r.model,'B');assert.match(r.warning,/fallback/);
 for(const evaluator of ['P','L'])await assert.rejects(backend.dispatch({...request,evaluator}),/unavailable.*No evaluator was substituted/);
 const custom=cloneWeights(DEFAULT_WEIGHTS);custom.opening.mobility+=23;
 const original=JSON.stringify(custom),c=await backend.dispatch({...request,weights:custom,evaluator:'custom'});
 assert.equal(c.model,'custom');assert.equal(c.backend,'JavaScript');assert.equal(JSON.stringify(custom),original);
});
