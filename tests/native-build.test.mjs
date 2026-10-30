import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sha} from '../scripts/native/build.mjs';

test('concurrent fresh native builds publish complete identical executables and receipts',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'reversi concurrent build '));
  const code="import {build} from './scripts/native/build.mjs'; console.log(JSON.stringify(build({directory:process.argv[1]})));";
  const run=()=>new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['--input-type=module','-e',code,directory],{stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
    child.on('error',reject);child.on('exit',status=>status===0?resolve(JSON.parse(stdout)):reject(Error(stderr)));
  });
  try {
    const receipts=await Promise.all([run(),run()]);
    const saved=JSON.parse(readFileSync(join(directory,'build.json')));
    const actual=sha(readFileSync(saved.executable));
    for(const r of receipts){assert.equal(r.fingerprint,saved.fingerprint);assert.equal(r.executableSha256,actual);}
    assert.ok(!readdirSync(directory).some(name=>name.includes('.tmp-')));
  }finally{rmSync(directory,{recursive:true,force:true});}
});
