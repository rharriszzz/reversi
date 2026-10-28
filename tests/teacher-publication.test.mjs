import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAcceptedLabel} from '../scripts/teacher/qualification-publish.mjs';
import {initialBoard,legalMoves} from '../src/rules.js';
import {optionalDepthDecision,bootstrapMean} from '../scripts/teacher/qualification-core.mjs';
import {reportBootstrap} from '../scripts/teacher/qualification-v4-publish.mjs';

test('report bootstrap actually resamples a power-of-two stratum with replacement',()=>{
 const rows=Array.from({length:32},(_,i)=>({phase:0,policy:'fixed',regret:i%2}));
 const interval=reportBootstrap(rows);
 assert.ok(interval[0]>.2&&interval[0]<.5&&interval[1]>.5&&interval[1]<.8);
 assert.deepEqual(reportBootstrap(rows),interval);assert.deepEqual(bootstrapMean(rows),interval);
 assert.deepEqual(reportBootstrap(rows,()=>7),[7,7]);
});

test('optional calibration must fit both total and individual query caps before any search',()=>{
 const p={allowance:1.35,queryCapMs:9000,optionalDepthEnabled:true};
 const exceeds=optionalDepthDecision([100],[1000],100000,p);
 assert.equal(exceeds.sampleFits,true);assert.equal(exceeds.queryFits,false);assert.equal(exceeds.attempted,false);
 assert.equal(optionalDepthDecision([100],[1000],100000,{...p,queryCapMs:20000}).attempted,true);
 assert.equal(optionalDepthDecision([100],[1000],100000,{...p,queryCapMs:20000,optionalDepthEnabled:false}).attempted,false);
 assert.equal(optionalDepthDecision([100],[1000],1000,{...p,queryCapMs:20000}).attempted,false);
});

test('publication rejects unresolved endpoint directions, changed depths and incomplete alternatives',()=>{
 const state={board:[...initialBoard()],player:1};
 const result={rows:legalMoves(state.board,1).map(move=>({move,score:63,value:-63,depth:11,bound:'exact-window',pv:[]}))};
 verifyAcceptedLabel(state,12,result);
 for(const change of [{bound:'>'},{bound:'<',score:64,value:-64},{depth:10},{selective:true}]){
  const r=structuredClone(result);Object.assign(r.rows[0],change);assert.throws(()=>verifyAcceptedLabel(state,12,r));
 }
 assert.throws(()=>verifyAcceptedLabel(state,12,{rows:result.rows.slice(1)}));
 const terminal=structuredClone(result);Object.assign(terminal.rows[0],{adapterTerminal:true,depth:0,bound:'terminal'});
 assert.throws(()=>verifyAcceptedLabel(state,12,terminal),/terminal/);
});

test('publication independently proves terminal children with unplayed empties',()=>{
 const board=Array(64).fill(1);board[0]=0;board[1]=-1;board[63]=0;
 const s={board,player:1},r={rows:[{move:0,score:-64,value:64,depth:0,bound:'terminal',adapterTerminal:true,pv:[]}]};
 verifyAcceptedLabel(s,12,r);
 const wrong=structuredClone(r);wrong.rows[0].value=63;wrong.rows[0].score=-63;
 assert.throws(()=>verifyAcceptedLabel(s,12,wrong),/terminal/);
});
