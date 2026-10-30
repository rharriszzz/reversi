import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {selectPython,python} from '../scripts/python.mjs';

test('selected Python is supported and an explicit unavailable interpreter fails closed',()=>{
  const r=spawnSync(python,['-c','import sys; assert sys.version_info >= (3,13); print(sys.executable)'],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  assert.equal(selectPython({REVERSI_PYTHON:python}),r.stdout.trim());
  assert.throws(()=>selectPython({REVERSI_PYTHON:'/nonexistent/reversi-python'}),/Python 3.13/);
});
