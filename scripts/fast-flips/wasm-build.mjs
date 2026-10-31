// Experimental Wasm stays ignored; do not replace distributed browser artifacts.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {homedir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {frozenHeader,sha} from '../native/build.mjs';
import {python} from '../python.mjs';
import production from '../../src/wasm/manifest.js';
const out=resolve(process.env.REVERSI_FLIP_RUN??'.local-research/fast-flips-m4-20261031','wasm-selected');mkdirSync(out,{recursive:true});
const compiler=resolve(process.env.REVERSI_EMSDK??resolve(homedir(),'.local/share/reversi-emsdk'),'upstream/emscripten/em++');
const env={...process.env,EMSDK_PYTHON:python,EMCC_CORES:'2'},version=execFileSync(compiler,['--version'],{encoding:'utf8',env}).trim();
if(!version.includes('4.0.22'))throw Error('Use the existing qualified Emscripten 4.0.22 SDK');
const flags=production.flags,{header}=frozenHeader();writeFileSync(resolve(out,'frozen.hpp'),header);
const sourceHashes=Object.fromEntries(['native/engine.cpp','native/engine.hpp','native/browser.cpp'].map(f=>[f,sha(readFileSync(f))]));
const fingerprint=sha(JSON.stringify({sourceHashes,header:sha(header),version,flags})),name=`engine-${fingerprint.slice(0,16)}.mjs`;
execFileSync(compiler,[...flags,`-DREVERSI_BUILD_ID="${fingerprint}"`,'-I',out,'native/engine.cpp','native/browser.cpp','-o',resolve(out,name)],{stdio:'inherit',env});
const receipt={...production,fingerprint,version,sourceHashes,modelHeaderSha256:sha(header),module:relative(resolve('src/wasm'),resolve(out,name)),artifacts:Object.fromEntries([name,name.replace('.mjs','.wasm')].map(f=>[f,sha(readFileSync(resolve(out,f)))])),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()};
writeFileSync(resolve(out,'manifest.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
