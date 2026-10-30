#!/usr/bin/env node
// Validate every stored fixed-depth native choice with the production JS core.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { legalMoves,play } from '../../src/rules.js';
import { findBestMove,terminalScore } from '../../src/search.js';
import { frozenModels } from '../../scripts/frozen-player/models.mjs';
import { compile } from '../../scripts/next-residual/model.mjs';
const b=JSON.parse(readFileSync(new URL('./native-search-benchmarks-r2-20261030.json',import.meta.url))),models=frozenModels();
const evaluators=Object.fromEntries(Object.entries(models).map(([k,v])=>[k,compile(v).evaluate]));let checked=0,maxError=0;
for(const row of b.fixed) {
 const p=b.positions.find(p=>p.id===row.position),native=row.native,legal=legalMoves(p.board,p.player);
 if(native.move===null){assert.equal(legal.length,0);continue;}
 assert.ok(legal.includes(native.move));const child=play(p.board,p.player,native.move),depth=row.depth-1;
 const value=depth===0?(!legalMoves(child,-p.player).length&&!legalMoves(child,p.player).length?-terminalScore(child,-p.player):evaluators[row.model](child,p.player)):-findBestMove(child,-p.player,depth,undefined,{evaluate:evaluators[row.model]}).score;
 const error=Math.abs(value-native.score);assert.ok(error<=1e-10,`${row.position}: nonoptimal native choice`);maxError=Math.max(maxError,error);checked++;
}
console.log(JSON.stringify({passed:true,fixedNativeChoicesVerified:checked,maxError,tolerance:1e-10}));
