// A narrowly scoped, explicit lineage for reviewed scheduling-only repairs.
// Numerical/search/data/teacher modules and the scientific protocol stay frozen.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { read, sourceDigest } from '../research/io.mjs';
import { hash, PROTOCOL } from './protocol.mjs';
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
  if(checksum!==hash(body)||!['residual-scheduling-only-v1','residual-operational-only-v1'].includes(certificate.kind)
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
  const scheduling=certificate.scheduling;
  if(scheduling&&(scheduling.previousExperimentCapMs!==PROTOCOL.experimentCapMs
    ||scheduling.experimentCapMs!==10*3600000||scheduling.sessionAllowanceMs!==8*3600000
    ||scheduling.protocolHash!==hash(PROTOCOL)||!scheduling.authorization
    ||!certificate.previousAmendmentHash))throw Error('Invalid authorized scheduling ceiling');
  if(scheduling) {
    const previous=read(`${output}/amendments/${certificate.previousAmendmentHash}.json`),{checksum:oldChecksum,...oldBody}=previous;
    if(oldChecksum!==hash(oldBody)||oldChecksum!==certificate.previousAmendmentHash
      ||previous.originalSource!==certificate.originalSource)throw Error('Scheduling predecessor mismatch');
  }
  if(certificate.kind==='residual-operational-only-v1') {
    const previous=read(`${output}/amendments/${certificate.previousAmendmentHash}.json`);
    if(certificate.operationalRepair?.kind!=='assessment-observation-references-v1'
      ||sourceDigest(previous.executionDirectory)!==previous.executionSource
      ||hash(certificate.scheduling)!==hash(previous.scheduling)
      ||readFileSync(`${execution}/scripts/residual/run.mjs`,'utf8')!==
        repairAssessmentSource(readFileSync(`${previous.executionDirectory}/scripts/residual/run.mjs`,'utf8'))
      ||changesBetween(previous.executionDirectory,execution).some(c=>!['scripts/residual/run.mjs','scripts/residual/planning-source.mjs'].includes(c.path)))
      throw Error('Operational repair changed more than assessment serialization');
  }
  return {source:certificate.originalSource,executionSource:digest,executionDirectory:execution,planningAmendmentHash:checksum,
    ...(scheduling?{scheduling}:{})};
}

// Keep the complete observation witness in its immutable task receipt. Repeating
// these arrays inside every assessment/mismatch row can exceed V8's string limit.
export function compactSearchReceipt(result,id) {
  const {observed,...summary}=result;
  return {...summary,observedCount:observed.length,observedReceipt:`tasks/${id}.json`};
}
const SEARCH_BEFORE=`      const search={};for(const which of ['B','candidate'])search[which]=await pool.task(\`search-\${root.id}-\${depth}-\${which}\`,{
        type:'root-search',state:{board:root.board,player:root.player},depth,weights:which==='B'?weightsFor(zero()):model.weights});`;
const SEARCH_AFTER=`      const search={};for(const which of ['B','candidate']) {
        const id=\`search-\${root.id}-\${depth}-\${which}\`;
        search[which]=compactSearchReceipt(await pool.task(id,{
          type:'root-search',state:{board:root.board,player:root.player},depth,weights:which==='B'?weightsFor(zero()):model.weights}),id);
      }`;
export function repairAssessmentSource(text) {
  if(text.split(SEARCH_BEFORE).length!==2)throw Error('Unknown assessment serialization structure');
  return text.replace("import { executionIdentity } from './planning-source.mjs';",
    "import { executionIdentity, compactSearchReceipt } from './planning-source.mjs';").replace(SEARCH_BEFORE,SEARCH_AFTER);
}
