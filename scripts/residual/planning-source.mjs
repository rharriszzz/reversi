// A narrowly scoped, explicit lineage for reviewed scheduling-only repairs.
// Numerical/search/data/teacher modules and the scientific protocol stay frozen.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { read, sourceDigest } from '../research/io.mjs';
import { hash } from './protocol.mjs';
const ALLOWED=new Set(['scripts/residual/run.mjs','scripts/residual/diagnostics.mjs',
  'scripts/residual/launch.py','scripts/residual/planning-source.mjs']);
function inventory(root) {
  const result={};
  function visit(dir){for(const entry of readdirSync(dir,{withFileTypes:true})) {
    if(entry.name==='__pycache__')continue;
    const path=resolve(dir,entry.name);
    if(entry.isDirectory())visit(path);
    else if(/\.(js|mjs|py|json|ps1|cpp|c|h|patch)$/.test(entry.name))result[relative(root,path)]=hash(readFileSync(path,'utf8'));
  }}
  for(const dir of ['src','scripts','tests','docs/data'])visit(resolve(root,dir));
  result['package.json']=hash(readFileSync(resolve(root,'package.json'),'utf8'));return result;
}
export function changesBetween(original,execution) {
  const a=inventory(original),b=inventory(execution);
  return [...new Set([...Object.keys(a),...Object.keys(b)])].sort().filter(path=>a[path]!==b[path])
    .map(path=>({path,before:a[path]??null,after:b[path]??null}));
}
export function executionIdentity(execution,output) {
  execution=resolve(execution);const original=resolve(output,'source'),digest=sourceDigest(execution);
  if(execution===original)return {source:digest,executionSource:digest};
  const certificate=read(`${output}/planning-amendment.json`),{checksum,...body}=certificate;
  if(checksum!==hash(body)||certificate.kind!=='residual-scheduling-only-v1'
    ||certificate.originalSource!==sourceDigest(original)||certificate.executionSource!==digest
    ||resolve(certificate.executionDirectory)!==execution)throw Error('Scheduling amendment source mismatch');
  const changes=changesBetween(original,execution);
  if(hash(changes)!==hash(certificate.changes)||changes.some(c=>!ALLOWED.has(c.path)))throw Error('Scheduling repair changed a frozen numerical input');
  // All non-forecast diagnostics, including gates, must remain byte-identical.
  const stripForecast=text=>{
    const a=text.indexOf('export function forecast('),b=text.indexOf('\nexport function bootstrapSources',a);
    if(a<0||b<0)throw Error('Unknown forecast module structure');return text.slice(0,a)+text.slice(b);
  };
  if(stripForecast(readFileSync(`${original}/scripts/residual/diagnostics.mjs`,'utf8'))!==
     stripForecast(readFileSync(`${execution}/scripts/residual/diagnostics.mjs`,'utf8')))throw Error('Scheduling repair changed scientific diagnostics/gates');
  const manifest=read(`${output}/manifest.json`);
  if(manifest.planningAmendmentHash!==checksum||manifest.source!==certificate.originalSource)throw Error('Unregistered scheduling amendment');
  return {source:certificate.originalSource,executionSource:digest,executionDirectory:execution,planningAmendmentHash:checksum};
}
