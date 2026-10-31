import assert from 'node:assert/strict';
import test from 'node:test';
import {DRAFT,slots,schedule,requireRegistration} from '../scripts/phase-a-mac/prospective-protocol.mjs';
test('prospective 256-family plan balances every cell and keeps color pairs adjacent',()=>{
  const roots=slots(),games=schedule(),counts=Array(16).fill(0),seen=new Set();
  roots.forEach(r=>counts[r.cell]++);assert.deepEqual(counts,Array(16).fill(16));
  assert.equal(games.length,512);
  for(let i=0;i<games.length;i+=2){const a=games[i],b=games[i+1];assert.equal(a.family,b.family);assert.equal(a.color,-b.color);assert.equal(a.timeMs,80);assert.ok(!seen.has(a.family));seen.add(a.family);}
  assert.equal(seen.size,256);assert.deepEqual(schedule(),games);
  assert.ok(Math.abs(Math.sqrt(Math.log(20)/(2*256))-.07649208846)<1e-10);
});
test('unregistered draft fails closed',()=>assert.throws(()=>requireRegistration(DRAFT),/cannot authorize/));
