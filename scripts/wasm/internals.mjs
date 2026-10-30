// Compile the independent standalone native assertions into actual Wasm too.
import {python} from '../python.mjs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {homedir} from 'node:os';
const sdk=process.env.REVERSI_EMSDK??resolve(homedir(),'.local/share/reversi-emsdk');
const out=resolve('.local-research/wasm-build/internals.cjs');
execFileSync(resolve(sdk,'upstream/emscripten/em++'),['-O3','-std=c++17','-ffp-contract=off','-fno-fast-math','-fexceptions','-sDISABLE_EXCEPTION_CATCHING=0','-sENVIRONMENT=node','-sEXIT_RUNTIME=1','-I','native','-I','.local-research/wasm-build','native/engine.cpp','tests/native-internals.cpp','-o',out],{stdio:'inherit',env:{...process.env,EMSDK_PYTHON:python,EMCC_CORES:'2'}});
execFileSync(process.execPath,[out],{stdio:'inherit'});console.log('PASS actual Wasm: exhaustive pattern encoding, generation rollover, interruption and depth assertions');
