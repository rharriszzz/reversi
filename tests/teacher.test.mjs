import test from 'node:test';import assert from 'node:assert/strict';
import {obf,moveIndex,parse} from '../scripts/teacher/edax.mjs';
import {solve} from '../scripts/teacher/validate.mjs';
import {initialBoard} from '../src/rules.js';
test('teacher coordinates and turn serialization are explicit',()=>{assert.equal(moveIndex('a1'),0);assert.equal(moveIndex('H8'),63);assert.equal(moveIndex('PA'),null);assert.throws(()=>moveIndex('i9'));assert.equal(obf([...initialBoard()],-1).slice(-3),' O;');assert.equal(obf(initialBoard(),1),obf([...initialBoard()],1));assert.throws(()=>obf([0],1));});
test('teacher parser rejects selective, bounded, missing and wrong-depth results',()=>{const line='  1|    7   +02        0:00.010          6235     623500       d3 C5';assert.equal(parse(line,1,[7])[0].pv[0],19);for(const text of ['',line.replace('7   +','7  >+'),line.replace('7   +','7@95%   +')])assert.throws(()=>parse(text,1,[7]));assert.throws(()=>parse(line,1,[8]));assert.throws(()=>parse(line.replace('+02','+65'),1,[7]));});
test('independent terminal conventions retain raw discs and awarded empties separately',()=>{const b=[0,...Array(63).fill(1)];assert.equal(solve(b,1).value,64);assert.equal(solve(b,1,false).value,63);assert.equal(solve(b,-1).value,-64);});
