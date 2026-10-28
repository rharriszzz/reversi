import { appendFileSync, readFileSync } from 'node:fs';
import { freemem, totalmem, loadavg } from 'node:os';
import { PerformanceObserver } from 'node:perf_hooks';
import { atomic } from '../research/io.mjs';

// threadCpuUsage excludes other workers on Node versions that expose it.
export const cpuClock=()=>typeof process.threadCpuUsage==='function'?process.threadCpuUsage():process.cpuUsage();
const cpuMs=(a,b)=>(b.user+b.system-a.user-a.system)/1000;
export class Profiler {
  constructor() {this.spans={};this.gc={count:0,wallMs:0};this.observer=new PerformanceObserver(list=>{for(const e of list.getEntries()){this.gc.count++;this.gc.wallMs+=e.duration;}});this.observer.observe({entryTypes:['gc']});}
  measure(name,fn) {const start=performance.now(),cpu=cpuClock(),heap=process.memoryUsage().heapUsed;const end=()=>{const s=this.spans[name]??={calls:0,wallMs:0,cpuMs:0,heapDeltaBytes:0};s.calls++;s.wallMs+=performance.now()-start;s.cpuMs+=cpuMs(cpu,cpuClock());s.heapDeltaBytes+=process.memoryUsage().heapUsed-heap;};try {const result=fn();if(result?.then)return result.finally(end);end();return result;}catch(e){end();throw e;}}
  snapshot() {for(const e of this.observer.takeRecords()){this.gc.count++;this.gc.wallMs+=e.duration;}return {clockWarnings:typeof process.threadCpuUsage==='function'?Object.entries(this.spans).filter(([,s])=>s.wallMs>1&&s.cpuMs>s.wallMs*1.2).map(([name])=>`${name}: CPU exceeds wall; short-span accounting/host clock anomaly`):[],spans:this.spans,gc:this.gc,memory:process.memoryUsage(),cpuScope:typeof process.threadCpuUsage==='function'?'thread':'process (overlaps when concurrent)'};}
  close(){this.observer.disconnect();}
}
export class Progress {
  constructor(output,{heartbeatMs=45000,write=console.log}={}) {this.output=output;this.write=write;this.started=performance.now();this.last=this.started;this.previousPositions=0;this.lastCpu=process.cpuUsage();this.operation={stage:'initialize',substage:'starting',task:'none'};this.timer=setInterval(()=>this.emit('heartbeat'),heartbeatMs);this.timer.unref();}
  set(operation) {this.operation={...this.operation,...operation,started:performance.now()};this.emit('stage');}
  update(fields){Object.assign(this.operation,fields);}
  emit(event,extra={}) {
    const now=performance.now(),memory=process.memoryUsage(),cpu=process.cpuUsage(),positions=this.operation.positions??0,seconds=(now-this.last)/1000;
    const row={at:new Date().toISOString(),event,...this.operation,operationMs:now-(this.operation.started??this.started),newPositions:positions-this.previousPositions,positionsPerSecond:(positions-this.previousPositions)/Math.max(.001,seconds),cpuCores:cpuMs(this.lastCpu,cpu)/Math.max(1,now-this.last),rssMiB:memory.rss/2**20,heapMiB:memory.heapUsed/2**20,availableMiB:freemem()/2**20,totalMiB:totalmem()/2**20,load:loadavg(),...extra};
    try{row.swap=readFileSync('/proc/meminfo','utf8').split('\n').filter(v=>/^Swap(Total|Free):/.test(v)).join('; ');}catch{}
    appendFileSync(`${this.output}/telemetry.jsonl`,JSON.stringify(row)+'\n');
    const eta=this.operation.eta??'unknown (insufficient completed work)',overall=this.operation.overallEta??'unknown (budget is a cap)';
    this.write(`${row.at} ${event} ${row.stage}/${row.substage}; ${row.task}; model=${row.model??'-'} batch=${row.batch??'-'} epoch=${row.epoch??'-'}; positions=${positions} processed=${row.processedPositions??'-'} new=${row.newPositions} (${row.positionsPerSecond.toFixed(1)}/s); age=${(row.operationMs/1000).toFixed(1)}s${row.operationMs>120000?' LONG TASK still active':''}; tasks=${row.completed??0}/${row.total??'?'} remaining=${row.total===undefined?'?':Math.max(0,row.total-(row.completed??0))}; CPU=${row.cpuCores.toFixed(2)} cores RSS=${row.rssMiB.toFixed(0)}MiB; ETA stage=${eta} overall=${overall}; checkpoint=${row.checkpoint??'none'}${row.note?'; '+row.note:''}`);
    this.last=now;this.lastCpu=cpu;this.previousPositions=positions;return row;
  }
  close(){clearInterval(this.timer);}
}
// Histories are immutable, auditable task receipts. The manifest holds bounded
// scalar summaries; reports do not recursively embed per-policy epoch detail.
export function compactEpoch(row) {const {byPolicy,byPhase,byBoundary,ranking,quality,...small}=row;const compact=r=>r?{depth:r.depth,exact:r.exact,search:r.search}:undefined;return {...small,ranking:compact(ranking),quality:compact(quality)};}
export function historyChunk(output,id,rows) {const path=`${output}/history/${id}.json`;atomic(path,{id,rows});return path;}
