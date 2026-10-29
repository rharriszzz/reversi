// Read-only reporting of the safe resource cap versus the configured pool.
import { existsSync, readFileSync } from 'node:fs';
import { read } from '../research/io.mjs';
const lines=path=>existsSync(path)?readFileSync(path,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
export function workerHistory(output) {
  const state=read(`${output}/manifest.json`),events=lines(`${output}/events.jsonl`),resources=lines(`${output}/resource-history.jsonl`);
  const timeline=[];
  for(const session of state.sessions) {
    const launchPath=`${output}/launch-${session.pid}.json`;if(!existsSync(launchPath))continue;
    const launch=read(launchPath),before=events.filter(e=>e.event==='scaling-measured'&&Date.parse(e.at)<Date.parse(session.started));
    const calibrated=before.length?Math.min(...before.map(e=>e.selectedWorkers??Infinity)):Infinity;
    timeline.push({at:session.started,event:'session-start',mode:session.mode,
      launchWorkerCap:launch.workers,actualPool:Math.min(launch.workers,calibrated),
      reason:'Pool initialization takes the smaller of launch cap and the saved measured-worker limit'});
  }
  for(const event of events.filter(e=>e.event==='workers-adjusted')) {
    const sample=resources.filter(r=>Date.parse(r.at)<=Date.parse(event.at)).at(-1);
    if(!sample)throw Error('Worker adjustment lacks a preceding resource receipt');
    timeline.push({at:event.at,event:'pool-adjustment',actualPool:event.workers,
      safeCap:sample.workers,limitingAvailableGiB:sample.limitingAvailableGiB,
      windowsAvailableGiB:sample.windows?.availableKiB/2**20,wslAvailableGiB:sample.availableGiB,
      windowsCpuPercent:sample.windows?.cpuPercent,wslCpuBusy:sample.cpuBusy,
      swapPagesInOutPerSecond:sample.swapPagesInOutPerSecond,resourceReceiptAt:sample.at});
  }
  timeline.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));let actualPool=null;
  for(const row of timeline) {
    const previous=actualPool;actualPool=row.actualPool;
    if(row.event!=='pool-adjustment')continue;
    row.previousPool=previous;row.requiredFreeHeadroomGiB=1.5+.6*previous;
    row.reason=row.limitingAvailableGiB<row.requiredFreeHeadroomGiB?
      'Available physical memory fell below the free-headroom reserve for the previous pool':
      Math.max(row.wslCpuBusy??0,(row.windowsCpuPercent??0)/100)>=.35?
      'Background CPU exceeded the preflight concurrency threshold':'Fresh preflight concurrency cap decreased';
  }
  return {timeline,latestSafeCap:resources.at(-1)?.workers,lastConfiguredPool:actualPool,
    latestActualPool:state.status==='running'?actualPool:0,
    interpretation:'A safe cap is an upper bound, not a count of running workers. Resource checks reduce the pool immediately; a later higher cap does not automatically increase it. A checkpoint/resume can restore the previously benchmarked count. Active tasks can be fewer than pool slots.',
    fieldCaution:'Progress.availableGiB is WSL available memory. Decisions use resource-history.limitingAvailableGiB, the minimum of Windows and WSL availability. The free-headroom threshold is a reserve, not measured worker consumption.'};
}
