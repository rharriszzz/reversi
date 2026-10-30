#!/usr/bin/env node
// Broad numerical qualification, independent of benchmark and scored openings.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { NativeEngine,decodeBoard } from './client.mjs';
import { initialBoard,legalMoves,play } from '../../src/rules.js';
import { extractFeatures } from '../../src/features.js';
import { findBestMove } from '../../src/search.js';
import { seededRandom } from '../../src/learning.js';
import { frozenModels } from '../frozen-player/models.mjs';
import { compile } from '../next-residual/model.mjs';
import { oracleChildren,oracleScore } from '../../tests/oracle.mjs';
import { atomic,output } from './measure.mjs';
import { mkdirSync } from 'node:fs';
const engine=new NativeEngine(),models=frozenModels(),evaluators=Object.fromEntries(Object.entries(models).map(([k,v])=>[k,compile(v).evaluate]));
const result={version:1,receipt:engine.receipt,games:32,positions:0,staticQueries:0,legalChildren:0,searchQueries:0,independentEndgames:0,maxStaticError:{B:0,L:0,P:0},maxFeatureError:0,maxSearchError:0,tolerance:1e-10};
try {
 await engine.ready();
 for(let game=0;game<32;game++) {
  const rng=seededRandom(0x4e510000+game);let board=[...initialBoard()],player=1,passes=0,ply=0;
  while(passes<2) {
   result.positions++;
   for(const p of [1,-1]) {
    const expected=oracleChildren(board,p);
    for(const model of ['B','L','P']) {
     const r=await engine.inspect(board,p,model);result.staticQueries++;result.legalChildren+=r.children.length;
     assert.deepEqual(r.children.map(c=>({move:c.move,board:decodeBoard(c)})),expected);
     const featureError=Math.max(...r.features.map((v,i)=>Math.abs(v-Object.values(extractFeatures(board,p))[i])));result.maxFeatureError=Math.max(result.maxFeatureError,featureError);
     const error=Math.abs(r.evaluation-evaluators[model](board,p));result.maxStaticError[model]=Math.max(result.maxStaticError[model],error);assert.ok(error<=1e-10);
    }
   }
   if(game<8&&[12,28,40,52].includes(board.filter(Boolean).length))for(const model of ['B','L','P']) {
    const reference=findBestMove(board,player,4,undefined,{evaluate:evaluators[model]});const native=await engine.search(board,player,{model,depth:4});const error=Math.abs(native.score-reference.score);assert.ok(error<=1e-10);result.maxSearchError=Math.max(result.maxSearchError,error);result.searchQueries++;
   }
   if(game<12&&board.filter(Boolean).length===56) {const exact=oracleScore(board,player);for(const model of ['B','L','P'])assert.equal((await engine.search(board,player,{model,depth:8})).score,exact);result.independentEndgames++;}
   const moves=legalMoves(board,player);if(!moves.length){passes++;player=-player;continue;}passes=0;
   board=[...play(board,player,moves[Math.floor(rng()*moves.length)])];player=-player;ply++;assert.ok(ply<=60);
  }
 }
 mkdirSync(output,{recursive:true});atomic(resolve(output,'qualification.json'),{...result,passed:true});console.log(JSON.stringify({...result,receipt:result.receipt.fingerprint,passed:true}));
}finally{engine.close();}
