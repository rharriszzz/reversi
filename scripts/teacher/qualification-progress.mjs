// Qualification-specific human log; detailed samples stay in telemetry.jsonl.
import {appendFileSync} from 'node:fs';
import {freemem,cpus} from 'node:os';
export class QualificationProgress {
 constructor(output){this.output=output;this.operation={stage:'initialize'};this.last=performance.now();this.cpu=process.cpuUsage();this.native=0;this.stageStart=this.last;this.lastEmission=this.last;this.timer=setInterval(()=>this.emit('progress'),15000);this.timer.unref();}
 set(fields){this.operation={...this.operation,...fields,positions:0,completed:0,eta:undefined};this.stageStart=performance.now();this.emit('stage');}
 update(fields){Object.assign(this.operation,fields);}
 emit(event,extra={}){const now=performance.now(),c=process.cpuUsage(),o=this.operation,seconds=Math.max(.001,(now-this.last)/1000),nodeCores=(c.user+c.system-this.cpu.user-this.cpu.system)/1e6/seconds,nativeSeconds=o.nativeCpuSeconds??0,nativeCores=(nativeSeconds-this.native)/seconds,done=o.completed??0,total=o.total,stageSeconds=(now-this.stageStart)/1000,throughput=done/stageSeconds,eta=total&&done?`${((total-done)/throughput).toFixed(0)}s`:'unknown',rssMiB=process.memoryUsage().rss/2**20;
 const row={at:new Date().toISOString(),event,...o,...extra,stageSeconds,throughput,nodeCores,nativeCompletedCores:nativeCores,rssMiB,availableMiB:freemem()/2**20};appendFileSync(`${this.output}/telemetry.jsonl`,JSON.stringify(row)+'\n');
 const active=(o.activeQueries??[]).map(q=>`${q.id} D${q.depth} ${q.elapsedSeconds.toFixed(1)}s${q.elapsedSeconds>=30?' SLOW':''}`).join(', ');
 console.log(`${row.at} ${event} ${o.stage}/${o.substage??'-'}: ${o.task??'-'}; completed=${done}/${total??'?'} remaining=${total===undefined?'?':Math.max(0,total-done)} throughput=${throughput.toFixed(2)}/s; durations=${o.durations??'pending'}; active=${active||'none'}; CPU Node=${nodeCores.toFixed(2)} native-completed=${nativeCores.toFixed(2)} cores/${cpus().length} host=${o.hostCpu??'pending'}; RSS=${rssMiB.toFixed(0)}MiB native-peak=${(o.nativeMaxRssMiB??0).toFixed(1)}MiB available=${(freemem()/2**30).toFixed(2)}GiB; ETA=${o.eta??eta} overall=${o.overallEta??'pending forecast'}; checkpoint=${o.checkpoint??'none'}${extra.status?`; status=${extra.status}`:''}`);
 this.last=now;this.cpu=c;this.native=nativeSeconds;this.lastEmission=now;return row;}
 close(){clearInterval(this.timer);}
}
