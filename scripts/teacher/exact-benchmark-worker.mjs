import {readFileSync} from 'node:fs';
import {runCase} from './exact-benchmark.mjs';
const {state,kind,options}=JSON.parse(readFileSync(0,'utf8'));
console.log(JSON.stringify(runCase(state,kind,options)));
