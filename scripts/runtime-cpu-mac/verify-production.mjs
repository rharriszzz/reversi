// New-source packaging gate. Historical fast-flips/verify-production.mjs stays pinned.
// Audits selected source, exact fingerprint, frozen coefficients, old ABI/options.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {frozenHeader} from '../native/build.mjs';
import {WasmEngine,manifest} from '../../src/wasm-engine.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const selected='911ce40096a869a684b21496f2c3060cd316fada';
const historical='6b480ed1bc6ddcdde2fdb37872c0ca8d0a804425';
const show=p=>execFileSync('git',['show',p],{maxBuffer:16*1024*1024});
const source=sha(show(`${selected}:native/engine.cpp`));
const old=JSON.parse(show(`${historical}:src/wasm/manifest.js`).toString().split('export default ')[1].trim().replace(/;$/, ''));
const expectedSources=['native/engine.hpp','native/engine.cpp','native/engine-impl.inc','native/engine-tables.hpp','native/browser.cpp','scripts/native/build.mjs','scripts/wasm/build.mjs'];
assert.deepEqual(Object.keys(manifest.sourceHashes),expectedSources);
for(const file of expectedSources)assert.equal(manifest.sourceHashes[file],sha(show(`${selected}:${file}`)),file+' selected PC source');
assert.deepEqual(manifest.flags,old.flags,'No compiler or memory option change');
assert.equal(manifest.version,old.version,'Pinned SDK unchanged');
assert.deepEqual(manifest.models,old.models);
assert.deepEqual(manifest.weights,old.weights);
assert.deepEqual(manifest.weights,frozenHeader().weights);
assert.equal(manifest.modelHeaderSha256,sha(frozenHeader().header));
assert.equal(manifest.fingerprint,sha(JSON.stringify({sourceHashes:manifest.sourceHashes,header:manifest.modelHeaderSha256,version:manifest.version,flags:manifest.flags})));
assert.equal(manifest.module,`engine-${manifest.fingerprint.slice(0,16)}.mjs`);
assert.deepEqual(Object.keys(manifest.artifacts),[manifest.module,manifest.module.replace('.mjs','.wasm')]);
for(const file of Object.keys(manifest.artifacts))assert.ok(!/\.local-research|\/Users\/|engine-enhanced|__builtin_cpu|REVERSI_CPU_DISPATCH/.test(readFileSync(`src/wasm/${file}`).toString()),'No temporary paths or x86 backend references');
const oldBinary=show(`${historical}:src/wasm/${old.module.replace('.mjs','.wasm')}`);
assert.deepEqual(WebAssembly.Module.exports(new WebAssembly.Module(readFileSync(`src/wasm/${manifest.module.replace('.mjs','.wasm')}`))),WebAssembly.Module.exports(new WebAssembly.Module(oldBinary)),'Unchanged raw exports');
assert.equal(manifest.sourceHashes['native/engine.cpp'],source);
for(const [file,digest] of Object.entries(manifest.sourceHashes))assert.equal(sha(readFileSync(file)),digest,file);
for(const [file,digest] of Object.entries(manifest.artifacts))assert.equal(sha(readFileSync(`src/wasm/${file}`)),digest,file);
assert.match(manifest.module,/^engine-[0-9a-f]{16}\.mjs$/);
assert.deepEqual(manifest.models,{B:'original-production',L:'ecf3fd376c680ced77d0b002ea2efb9fa4385737c4fffff734b901ab2968d97f',P:'de4b84745589b0384ea3639f879e3c98990e802d176298ff8ef54f681520067f'});
assert.equal(manifest.modelHeaderSha256,'1b286ed8371f0a2cd957b06b679e7422b68b3699cb7c8fe7c9f50968d27ceba1');
const binary=readFileSync(`src/wasm/${manifest.module.replace('.mjs','.wasm')}`);
const exports=WebAssembly.Module.exports(new WebAssembly.Module(binary));
// Emscripten minifies raw Wasm export names; its generated JS supplies the ABI.
if(process.argv[2])assert.deepEqual(exports,WebAssembly.Module.exports(new WebAssembly.Module(readFileSync(process.argv[2]))));
const e=await WasmEngine.create({moduleOptions:{wasmBinary:binary}});
try {
  for(const name of ['_rv_abi','_rv_build_id','_rv_identity','_rv_create','_rv_destroy','_rv_query'])assert.equal(typeof e.module[name],'function',name);
  // The optimizer splits zero-filled data segments in the file. Check the
  // complete table after those segments are loaded into actual linear memory.
  const geometry=Buffer.alloc(4096),directions=[[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
  for(let q=0;q<64;q++)for(let d=0;d<8;d++) {
    const [dr,dc]=directions[d];let ray=0n;
    for(let r=(q>>3)+dr,c=(q&7)+dc;r>=0&&r<8&&c>=0&&c<8;r+=dr,c+=dc)ray|=1n<<BigInt(r*8+c);
    geometry.writeBigUInt64LE(ray,(q*8+d)*8);
  }
  const offset=Buffer.from(e.module.HEAPU8.buffer).indexOf(geometry);
  assert.ok(offset>=0,'Complete 4 KiB geometry absent from production Wasm memory');
  assert.equal(e.module._rv_abi(),1);
  assert.equal(e.module.UTF8ToString(e.module._rv_build_id()),manifest.fingerprint);
  console.log(JSON.stringify({passed:true,fingerprint:manifest.fingerprint,sourceSha256:source,artifacts:manifest.artifacts,abi:1,exports,models:manifest.models,geometryBytes:geometry.length,geometrySha256:sha(geometry),geometryMemoryOffset:offset,memoryBytes:e.memoryBytes}));
}finally{e.close();}
