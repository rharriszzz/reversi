// Export the ORIGINAL compiled JS evaluator closure for browser-only benchmarks.
// No alternative evaluator mathematics: function body comes from compile().
import {writeFileSync,mkdirSync} from 'node:fs';
import {compile,GEOMETRIES,TEMPLATES} from '../next-residual/model.mjs';
import {frozenModels} from '../frozen-player/models.mjs';
import {positions} from '../native-v2/positions.mjs';
import {build,sha} from '../native/build.mjs';
const out='.local-research/wasm-20261030';mkdirSync(out,{recursive:true});
const models=frozenModels(),c=compile(models.P);
const code=`import {evaluateFast,fillFeaturesFast} from '../../src/fast-features.js';
const weights=${JSON.stringify(models.P.linear.weights)},scratch=new Float64Array(7),PHASES=['opening','middle','endgame'],FEATURES=${JSON.stringify(models.L.features)};
const phase=occupied=>occupied<28?0:occupied<52?1:2;
const tables=${JSON.stringify(c.tables.map(t=>[...t]))}.map(t=>Float32Array.from(t));
const records=${JSON.stringify(GEOMETRIES.map((g,j)=>({...g,squares:[...g.squares],size:TEMPLATES[Math.floor(j/8)].size,tableIndex:Math.floor(j/8)})))}.map(g=>({...g,table:tables[g.tableIndex]}));
export const evaluators={B:evaluateFast,P:${c.evaluate.toString()}};
`;
writeFileSync(`${out}/js-reference.js`,code);
writeFileSync(`${out}/fixtures.json`,JSON.stringify({native:build(),referenceSha256:sha(code),models:{B:'original-production',P:models.P.checksum},positions:positions().filter((_,i)=>[0,2,5,7,10,14,34,35].includes(i))},null,2)+'\n');
