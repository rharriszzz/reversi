// Narrow scheduling lineage: retain scientific identity and immutable receipts.
import { readFileSync,readdirSync } from 'node:fs';
import { sourceDigest,read } from '../research/io.mjs';
import { hash } from './protocol.mjs';
export const MEMORY_PATCHES=[
  {before:"import { Progress } from './progress.mjs';",after:"import { executionIdentity } from './execution.mjs';\nimport { Progress } from './progress.mjs';"},
  {before:"source=sourceDigest(fileURLToPath(new URL('../..',import.meta.url)))",after:"source=executionIdentity(fileURLToPath(new URL('../..',import.meta.url)),output)"},
  {before:"  const r=spawnSync('python3'",after:"  global.gc?.(); // Release coordinator garbage before measuring free memory.\n  const r=spawnSync('python3'"},
  {before:"const safe=Math.min(2,state.configuredWorkers,value.workers,Math.floor((value.limitingAvailableGiB-1.5)/.6));",after:"if(value.limitingAvailableGiB<1.5)throw new Pause('Physical-memory free reserve below 1.5 GiB');\n  const safe=Math.min(2,state.configuredWorkers,value.workers);"},
];
export function executionIdentity(root,output) {
  const certificate=read(`${output}/memory-repair.json`),{checksum,...body}=certificate;
  if(hash(certificate.patches)!==hash(MEMORY_PATCHES)||hash(body)!==checksum||sourceDigest(root)!==certificate.executionSource||sourceDigest(`${output}/source`)!==certificate.originalSource)throw Error('Memory scheduling certificate mismatch');
  const original=readFileSync(`${output}/source/scripts/next-residual/run.mjs`,'utf8');
  let expected=original;
  for(const patch of MEMORY_PATCHES) {
    if(expected.split(patch.before).length!==2)throw Error('Ambiguous memory scheduling patch');expected=expected.replace(patch.before,patch.after);
  }
  if(readFileSync(`${root}/scripts/next-residual/run.mjs`,'utf8')!==expected)throw Error('Execution differs beyond certified memory scheduling repair');
  function compare(directory,relative=''){for(const entry of readdirSync(directory,{withFileTypes:true})){if(entry.name==='.local-research')continue;const name=relative+entry.name;if(entry.isDirectory())compare(`${directory}/${entry.name}`,`${name}/`);else if(name!=='scripts/next-residual/run.mjs'&&hash(readFileSync(`${directory}/${entry.name}`,'utf8'))!==hash(readFileSync(`${root}/${name}`,'utf8')))throw Error(`Frozen numerical source changed: ${name}`);}}
  compare(`${output}/source`);
  return certificate.originalSource;
}
