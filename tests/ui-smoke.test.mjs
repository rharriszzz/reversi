// Dependency-free controller checks. Actual Windows browser acceptance is separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scoreAllMoves, bestMove} from '../src/search.js';
import {reviewGame} from '../src/review.js';
import {SearchBackend} from '../src/backend.js';
import {WasmEngine,manifest} from '../src/wasm-engine.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const PREFS='reversi-engine-preferences-v1', SAVED='reversi-coach-lab-learning-v1';
class Element {
  constructor() { this.children=[];this.events={};this.value='';this.textContent='';this.disabled=false;this.className='';this.attributes={}; }
  addEventListener(type,fn){this.events[type]=fn;}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;this.textContent='';}
  setAttribute(name,value){this.attributes[name]=value;}
  click(){this.events.click?.({target:this});}
}
class MockDocument {
  constructor(){
    this.ids=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
    for(const [id,value] of Object.entries({'human-color':'1','analysis-depth':'3','computer-depth':'2','review-slider':'0','computer-time':'0'}))this.ids.get(id).value=value;
    this.ids.get('evaluator').value=html.match(/value="([BLP])" selected/)[1];
  }
  getElementById(id){assert.ok(this.ids.has(id),`Unexpected UI element: ${id}`);return this.ids.get(id);}
  createElement(){return new Element();}
}
function response(job){
  const {type,id,board,player,depth,history,human,evaluator}=job;
  assert.ok(['B','L','P'].includes(evaluator));assert.equal('weights' in job,false);
  const tag=r=>({...r,model:evaluator,backend:'Test worker'});
  if(type==='play')return {type:'played',id,choice:tag(bestMove(Int8Array.from(board),player,depth))};
  if(type==='review')return {type:'reviewed',id,rows:reviewGame(history,depth,undefined,human),model:evaluator,backend:'Test worker'};
  assert.equal(type,'analyze');return {type:'analyzed',id,analysis:tag(scoreAllMoves(Int8Array.from(board),player,depth))};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
let serial=0;
async function setup({prefs=null,controlled=false,unavailable=false,pauseReview=false,real=false}={}){
  const workers=[],storage=new Map([[SAVED,'{"version":99,"weights":"historical user data"}']]);
  if(prefs!==null)storage.set(PREFS,typeof prefs==='string'?prefs:JSON.stringify(prefs));
  class Worker {
    constructor(){workers.push(this);this.jobs=[];this.replies=[];if(real)this.backend=new SearchBackend(async()=>this.engine=await WasmEngine.create({moduleOptions:{wasmBinary:readFileSync(new URL('../src/wasm/'+manifest.module.replace('.mjs','.wasm'),import.meta.url))}}));}
    terminate(){this.terminated=true;this.engine?.close();}
    postMessage(job){this.jobs.push(job);if(real){this.backend.dispatch(job).then(data=>{this.replies.push(data);this.onmessage?.({data});});}else if(!controlled&&!(pauseReview&&job.type==='review'))queueMicrotask(()=>this.answer(job));}
    // Deliberately allow a terminated worker to answer to test stale guards.
    answer(job=this.jobs.at(-1)){this.onmessage?.({data:response(job)});}
  }
  const document=new MockDocument();globalThis.document=document;globalThis.Worker=Worker;
  globalThis.localStorage={getItem:key=>{assert.equal(key,PREFS,'saved model must never be read');if(unavailable)throw Error('denied');return storage.get(key)??null;},setItem:(key,value)=>{assert.equal(key,PREFS);if(unavailable)throw Error('denied');storage.set(key,value);}};
  await import(`../src/app.js?ui=${serial++}`);if(!controlled)await tick();
  return {get:id=>document.getElementById(id),workers,storage};
}
function change(get,id,value,event='change'){get(id).value=value;get(id).events[event]({target:get(id)});}

test('player markup offers coaching and frozen B/L/P only',()=>{
  assert.doesNotMatch(html,/id="(?:train|export-model|reset-model|weights-table|training-status|model-version)"|trainer-panel|value="custom"/);
  assert.match(html,/B · Original evaluator/);assert.match(html,/L · Learned linear evaluator/);assert.match(html,/value="P" selected>P · Recommended pattern evaluator/);
  assert.match(html,/USING THE COACH/);assert.match(html,/Full game rules/);
});

test('first visit, custom migration, B/L/P preferences, malformed/unavailable storage',async()=>{
  for(const [prefs,expected,time] of [[null,'P','0'],[{evaluator:'custom',timeMs:'80'},'P','80'],...[...'BLP'].map(evaluator=>[{evaluator,timeMs:'300'},evaluator,'300']),[{evaluator:'unknown',timeMs:'bad'},'P','0'],['{','P','0']]){
    const {get,workers,storage}=await setup({prefs});
    assert.equal(get('evaluator').value,expected);assert.equal(get('computer-time').value,time);
    assert.equal(workers.length,3,'only analyzer, opponent and reviewer');
    assert.equal(workers[0].jobs[0].evaluator,expected,'actual outbound job uses the resolved preference');
    assert.equal(storage.get(SAVED),'{"version":99,"weights":"historical user data"}');
    change(get,'evaluator',expected);await tick();
    assert.deepEqual(JSON.parse(storage.get(PREFS)),{evaluator:expected,timeMs:time});
  }
  const {get,workers}=await setup({unavailable:true});assert.equal(workers[0].jobs[0].evaluator,'P');change(get,'evaluator','B');await tick();assert.equal(get('move-rows').children.length,4);
});

test('initialization label follows an explicit saved choice before any worker responds',async()=>{
  for(const evaluator of 'BLP'){
    const {get,workers}=await setup({prefs:{evaluator},controlled:true});
    assert.equal(workers[0].jobs[0].evaluator,evaluator);
    assert.equal(get('backend-status').textContent,`${evaluator} · Initializing WebAssembly…`);
  }
});

test('first-visit controller sends P and actual packaged Wasm returns P analysis and play',async()=>{
  const {get,workers}=await setup({real:true});
  const until=async predicate=>{for(let n=0;n<500&&!predicate();n++)await new Promise(r=>setTimeout(r,10));assert.ok(predicate());};
  try{
    await until(()=>workers[0].replies.length===1);
    assert.equal(workers[0].jobs[0].evaluator,'P');
    assert.equal(workers[0].replies[0].analysis.modelIdentity,manifest.models.P);
    get('board').children[19].click();await until(()=>get('history').children.length===2&&workers[0].replies.length===2);
    assert.equal(workers[1].jobs[0].evaluator,'P');
    assert.equal(workers[1].replies[0].choice.modelIdentity,manifest.models.P);
    assert.match(get('play-metrics').textContent,/P · WebAssembly/);
  }finally{workers.forEach(w=>w.terminate());}
});

test('failed analysis and play expose explicit B and retry actions without a stale identity',async()=>{
  const {get,workers,storage}=await setup({controlled:true});const old=workers[0],job=old.jobs[0];
  old.onmessage({data:{type:'error',id:job.id,message:'P unavailable; select B. No evaluator was substituted.'}});
  assert.ok(old.terminated);assert.equal(get('retry-engine').hidden,false);assert.equal(get('use-baseline').hidden,false);
  assert.doesNotMatch(get('search-metrics').textContent,/WebAssembly/);
  get('retry-engine').click();const fresh=workers.at(-1);fresh.answer();assert.match(get('search-metrics').textContent,/P · Test worker/);
  assert.equal(get('retry-engine').hidden,true);
  get('board').children[19].click();const opponent=workers[1],playJob=opponent.jobs.at(-1);
  opponent.onmessage({data:{type:'error',id:playJob.id,message:'Temporary initialization failure'}});
  assert.equal(get('history').children.length,1);get('use-baseline').click();
  const replacement=workers.findLast(w=>!w.terminated&&w.jobs.at(-1)?.type==='play');
  assert.equal(replacement.jobs.at(-1).evaluator,'B');replacement.answer();
  assert.equal(get('history').children.length,2);assert.equal(JSON.parse(storage.get(PREFS)).evaluator,'B');
  old.onerror({currentTarget:old,message:'stale error'});assert.ok(!fresh.terminated,'old worker errors cannot terminate the current analyzer');
});

test('coaching, both colors, complete turn, replay, undo and B/L/P switching',async()=>{
  const {get}=await setup();
  assert.equal(get('board').children.length,64);assert.equal(get('move-rows').children.length,4);
  assert.match(get('search-metrics').textContent,/Heuristic estimate.*Equal depth/);
  get('move-rows').children[1].click();change(get,'compare-move','37');
  assert.match(get('interpretation').children[0].textContent,/versus F5/);
  assert.equal(get('interpretation').children.filter(e=>e.className==='variation').length,2);
  get('board').children[19].click();await tick();assert.equal(get('history').children.length,2);
  change(get,'review-slider','0','input');await tick();assert.match(get('status').textContent,/earlier position/);
  change(get,'review-slider','2','input');await tick();get('undo').click();await tick();assert.equal(get('history').children.length,0);
  for(const model of 'BLP'){change(get,'evaluator',model);await tick();assert.match(get('search-metrics').textContent,new RegExp(model+' · Test worker'));}
  change(get,'human-color','-1');await tick();assert.equal(get('turn-title').textContent,'White to move');assert.equal(get('history').children.length,1);
});

test('completed-game review uses frozen evaluator identity and replays a decision',async()=>{
  const {get,storage}=await setup({prefs:{evaluator:'P'}});change(get,'analysis-depth','2');
  for(let i=0;i<65&&get('turn-title').textContent!=='Game over';i++){
    await tick();if(get('turn-title').textContent==='Game over')break;
    const move=get('board').children.find(b=>!b.disabled);assert.ok(move);move.click();
  }
  await tick();assert.equal(get('turn-title').textContent,'Game over');assert.equal(get('review-game').disabled,false);
  get('review-game').click();await tick();
  assert.match(get('game-review').children[0].textContent,/evaluator P · Test worker/);
  assert.doesNotMatch(get('game-review').children[0].textContent,/saved|version|99/);
  assert.ok(get('game-review').children.length>1);get('game-review').children[1].click();await tick();
  assert.match(get('status').textContent,/earlier position/);assert.equal(storage.get(SAVED),'{"version":99,"weights":"historical user data"}');
});

test('late worker responses, depth/model changes, replay and restart cannot overwrite current state',async()=>{
  const {get,workers}=await setup({controlled:true});const oldAnalyzer=workers[0];
  change(get,'analysis-depth','2');oldAnalyzer.answer();assert.equal(get('move-rows').children.length,1);workers.at(-1).answer();
  assert.equal(get('move-rows').children.length,4);
  get('board').children[19].click();const oldOpponent=workers[1];
  change(get,'computer-depth','2');const newOpponent=workers.at(-1);oldOpponent.answer();assert.equal(get('history').children.length,1);
  change(get,'review-slider','0','input');newOpponent.answer();assert.equal(get('history').children.length,1);
  change(get,'review-slider','1','input');const resumed=workers.at(-1);get('new-game').click();resumed.answer();assert.equal(get('history').children.length,0);
  const beforeSwitch=workers.findLast(w=>!w.terminated&&w.jobs.at(-1)?.type==='analyze');const staleJob=beforeSwitch.jobs.at(-1);change(get,'evaluator','L');beforeSwitch.answer(staleJob);assert.equal(get('move-rows').children.length,1);workers.findLast(w=>!w.terminated&&w.jobs.at(-1)?.type==='analyze').answer();assert.match(get('search-metrics').textContent,/L · Test worker/);
});


test('canceled completed-game review cannot publish an old evaluator after a switch',async()=>{
  const {get,workers}=await setup({prefs:{evaluator:'P'},pauseReview:true});change(get,'analysis-depth','2');
  for(let i=0;i<65;i++){
    await tick();if(get('turn-title').textContent==='Game over')break;
    get('board').children.find(b=>!b.disabled).click();
  }
  assert.equal(get('turn-title').textContent,'Game over');get('review-game').click();
  const oldReviewer=workers[2],oldJob=oldReviewer.jobs.at(-1);assert.equal(oldJob.evaluator,'P');
  change(get,'evaluator','L');assert.ok(oldReviewer.terminated);oldReviewer.answer(oldJob);
  assert.equal(get('game-review').children.length,0,'canceled P review must remain absent');
  get('review-game').click();workers.at(-1).answer();
  assert.match(get('game-review').children[0].textContent,/evaluator L · Test worker/);
});

test('failed completed review retries with the selected P evaluator and rejects an old reply',async()=>{
  const {get,workers}=await setup({pauseReview:true});change(get,'analysis-depth','2');
  for(let i=0;i<65;i++){
    await tick();if(get('turn-title').textContent==='Game over')break;
    get('board').children.find(b=>!b.disabled).click();
  }
  assert.equal(get('turn-title').textContent,'Game over');get('review-game').click();
  const old=workers[2],job=old.jobs.at(-1);
  old.onmessage({data:{type:'error',id:job.id,message:'P temporarily unavailable'}});
  assert.ok(old.terminated);assert.equal(get('retry-engine').hidden,false);
  get('retry-engine').click();const replacement=workers.at(-1);
  assert.equal(replacement.jobs.at(-1).evaluator,'P');old.answer(job);
  assert.doesNotMatch(get('game-review').textContent,/ranked by/);
  replacement.answer();assert.match(get('game-review').children[0].textContent,/evaluator P · Test worker/);
});
