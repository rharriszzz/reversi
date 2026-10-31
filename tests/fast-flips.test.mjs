import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {build} from '../scripts/native/build.mjs';

test('production captures/resulting boards and experimental kernels match independent exhaustive mailbox lines and seeded boards',()=>{
  const receipt=build(),directory=resolve(receipt.executable,'..'),executable=resolve(directory,'flip-reference');
  execFileSync(process.env.CXX??'c++',[...receipt.flags,'-I',directory,'native/engine.cpp','scripts/fast-flips/kernels.cpp','scripts/fast-flips/micro.cpp','-o',executable]);
  const r=JSON.parse(execFileSync(executable,['--check'],{encoding:'utf8',timeout:60000}));
  assert.ok(r.checkedCases>1200000);assert.deepEqual(r.rows,[]);
});
