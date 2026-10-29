import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { read, sourceDigest } from '../research/io.mjs';
import { identity } from '../teacher/edax.mjs';
import { PROTOCOL, hash, slots, transferIds } from './protocol.mjs';
import { verifyModel } from './model.mjs';
import { verifyTrajectory, trajectoryKeys } from './data.mjs';
import { KeyIndex } from './index.mjs';
import { executionIdentity } from './planning-source.mjs';
import { oracleChildren } from '../../tests/oracle.mjs';

export function audit(output,{deep=true}={}) {
  output=resolve(output);const state=read(`${output}/manifest.json`),frozen=read(`${output}/protocol.json`);
  if(hash(frozen.protocol)!==hash(PROTOCOL)||sourceDigest(`${output}/source`)!==state.source
    ||frozen.source!==state.source||frozen.runIdentity!==state.runIdentity
    ||hash(identity(state.pin.binary,state.pin.evalFile,{buildFile:state.pin.experimental.buildFile}))!==hash(state.pin))throw Error('Audit source/protocol/teacher mismatch');
  if(state.executionDirectory)executionIdentity(state.executionDirectory,output);
  const files=existsSync(`${output}/tasks`)?readdirSync(`${output}/tasks`).filter(x=>x.endsWith('.json')):[];
  let nativeCpuSeconds=0,nativeMaxRssBytes=0,nodeWorkerCpuSeconds=0,evaluatedAlternatives=0,teacherQueries=0;
  const byType={},byRole={};
  for(const file of files) {
    const receipt=read(`${output}/tasks/${file}`);
    if(receipt.runIdentity!==state.runIdentity||receipt.inputHash!==hash({job:receipt.job,runIdentity:state.runIdentity})||receipt.resultHash!==hash(receipt.result))throw Error(`Audit task mismatch ${file}`);
    byType[receipt.job.type]=(byType[receipt.job.type]??0)+1;
    if(receipt.job.type==='label') {
      const role=file.startsWith('label-')?file.split('-')[1]:'engineering-or-transfer';
      byRole[role]??={queries:0,alternatives:0};byRole[role].queries++;byRole[role].alternatives+=receipt.result.rows.length;
      evaluatedAlternatives+=receipt.result.rows.length;teacherQueries++;
      const native=receipt.result.native;
      nativeCpuSeconds+=(native?.userSeconds??0)+(native?.systemSeconds??0);nativeMaxRssBytes=Math.max(nativeMaxRssBytes,native?.maxRssBytes??0);
    }
    nodeWorkerCpuSeconds+=((receipt.metrics?.cpu?.user??0)+(receipt.metrics?.cpu?.system??0))/1e6;
  }
  const reserved=existsSync(`${output}/reservation-progress.json`)?read(`${output}/reservation-progress.json`).roots:[],counts={},preferences={};
  const witnesses={continuations:0,earlyTerminal:0,nonterminal:0,terminalAtFrontier:0,staticFrontier:0,
    unobservedStatic:0,unobservedStaticWithVerifiedTies:0,originalStaticObserved:0,passSteps:0,parents:0,children:0,childPhases:{}};
  const seen=new Map(),historical=deep&&existsSync(`${output}/historical-index.bin`)?KeyIndex.load(`${output}/historical-index.bin`):null;
  if(historical&&historical.digest()!==read(`${output}/historical-index.json`).digest)throw Error('Historical binary index mismatch');
  for(const root of reserved) {
    counts[root.role]=(counts[root.role]??0)+1;
    const spec=slots(root.role).find(s=>s.slot===root.slot);
    for(const key of Object.keys(spec))if(spec[key]!==root[key])throw Error('Audit reserved slot balance mismatch');
    const trajectory=read(`${output}/trajectories/${root.id}.json`);verifyTrajectory(trajectory);
    if(root.trajectoryHash!==hash(trajectory)||root.seed!==trajectory.seed||root.attempt!==trajectory.attempt)throw Error('Trajectory identity mismatch');
    const frontier=root.role==='games'?null:read(`${output}/frontiers/${root.id}.json`);
    if(frontier&&(frontier.runIdentity!==state.runIdentity||frontier.rootHash!==hash(root)||frontier.resultHash!==hash(frontier.result)))throw Error('Frontier witness audit mismatch');
    if(frontier) {
      for(const line of frontier.result.lines) {
        witnesses.continuations++;witnesses.passSteps+=line.steps.filter(s=>s.move===null).length;
        if(line.terminal)witnesses.earlyTerminal++;
        else {witnesses.nonterminal++;witnesses.originalStaticObserved+=!!line.rootLeafObserved;
          const endpoint=line.endpoint.board,terminal=!oracleChildren(endpoint,1).length&&!oracleChildren(endpoint,-1).length;
          if(terminal)witnesses.terminalAtFrontier++;
          else {
            witnesses.staticFrontier++;
            if(!line.rootLeafObserved){witnesses.unobservedStatic++;
              witnesses.unobservedStaticWithVerifiedTies+=line.steps.some(step=>(step.rows??[]).filter(row=>Math.abs(row.score-step.score)<1e-9).length>1);}
          }
          if(line.steps.filter(s=>s.move!==null).length!==root.depth||line.steps.at(-1).remaining!==1)throw Error('Incorrect deployment frontier depth');}
      }
      witnesses.parents+=frontier.result.parents.length;
      for(const parent of frontier.result.parents)for(const child of parent.children) {
        witnesses.children++;
        const phase=child.occupied<28?'opening':child.occupied<52?'middle':'endgame';
        if(child.occupied!==parent.occupied+1||child.phase!==phase||child.player!==-parent.player)throw Error('Frontier child phase/turn mismatch');
        witnesses.childPhases[phase]=(witnesses.childPhases[phase]??0)+1;
      }
    }
    if(deep)for(const key of trajectoryKeys(trajectory,frontier?.result)) {
      if(historical?.has(key)||seen.has(key))throw Error(`Cross-role/historical leakage at ${root.id}`);seen.set(key,root.id);
    }
    const path=`${output}/preferences/${root.id}.json`;
    if(existsSync(path)) {
      const r=read(path);if(r.runIdentity!==state.runIdentity||r.rootHash!==hash(root)||r.frontierHash!==hash(frontier.result)||r.groupHash!==hash(r.group))throw Error('Preference provenance mismatch');
      const x=preferences[root.role]??={sources:0,informative:0,parents:0,pairs:0};x.sources++;x.informative+=r.group.pairs.length>0;x.parents+=r.group.parents.length;x.pairs+=r.group.pairs.length;
    }
  }
  if(existsSync(`${output}/reservations.json`)) {
    const r=read(`${output}/reservations.json`);if(hash(r.roles)!==r.digest||hash(transferIds(r.roles.assessment))!==hash(r.transferIds))throw Error('Frozen split audit mismatch');
    for(const role of Object.keys(PROTOCOL.targets))if(r.roles[role].length!==PROTOCOL.targets[role])throw Error('Frozen sample target changed');
  }
  if(existsSync(`${output}/models`))for(const name of readdirSync(`${output}/models`))if(name.endsWith('.json'))verifyModel(read(`${output}/models/${name}`));
  const events=existsSync(`${output}/events.jsonl`)?readFileSync(`${output}/events.jsonl`,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
  const freeze=events.findIndex(e=>e.event==='all-splits-frozen'),firstLabel=events.findIndex(e=>e.event==='task-start'&&e.id?.startsWith('label-training-'));
  if(firstLabel>=0&&(freeze<0||freeze>=firstLabel))throw Error('Training labeling preceded joint reservation freeze');
  const assessmentQueries=(byRole.assessment?.queries??0)+files.filter(n=>n.startsWith('transfer-')&&n.includes('-d')).length;
  const confirmationPairs=existsSync(`${output}/confirmation`)?readdirSync(`${output}/confirmation`).filter(n=>/^\d+-\d+\.json$/.test(n)).length:0;
  return {passed:true,source:state.source,executionSource:state.executionSource??state.source,planningAmendmentHash:state.planningAmendmentHash,
    runIdentity:state.runIdentity,status:state.status,verifiedTaskReceipts:files.length,
    byType,byRole,reservations:counts,preferences,witnesses,reservationDigest:state.reservationDigest,canonicalReservedKeys:deep?seen.size:null,teacherQueries,evaluatedAlternatives,
    assessmentQueries,confirmationPairs,firstSessionLocked:assessmentQueries===0&&confirmationPairs===0,
    nativeCpuSeconds,nativeMaxRssBytes,nodeWorkerCpuSeconds,
    nodeCpuSeconds:((state.nodeCpuTotal?.user??state.nodeCpu?.user??0)+(state.nodeCpuTotal?.system??state.nodeCpu?.system??0))/1e6,
    historicalBuilderCpuSeconds:((state.historical?.builderCpu?.user??0)+(state.historical?.builderCpu?.system??0))/1e6,
    historicalBuilderMaxRssBytes:state.historical?.builderMaxRssBytes,
    nodeMaxRssBytes:state.nodeMaxRssBytes,elapsedMs:state.elapsedMs,
    cpuAccounting:'Node process total includes worker threads; worker thread CPU is diagnostic, never added again. Native child CPU is separate.',
    forbiddenFailures:existsSync(`${output}/failures`)?readdirSync(`${output}/failures`).length:0};
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(audit(process.argv[2],{deep:!process.argv.includes('--quick')}),null,2));
