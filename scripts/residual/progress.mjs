import { appendFileSync } from 'node:fs';
import { freemem } from 'node:os';
export class Progress {
  constructor(output,state,pool=()=>null){this.output=output;this.state=state;this.pool=pool;this.last=performance.now();this.cpu=process.cpuUsage();this.completed=0;this.started=this.last;this.timer=setInterval(()=>this.emit('heartbeat'),45000);this.timer.unref();}
  emit(event,detail={}) {
    const now=performance.now(),cpu=process.cpuUsage(),seconds=(now-this.last)/1000;
    const active=[...(this.pool()?.active?.values()??[])].map(x=>({id:x.id,type:x.type,depth:x.depth,ageSeconds:(now-x.start)/1000}));
    const row={at:new Date().toISOString(),event,stage:this.state.stage,status:this.state.status,...detail,
      active,progress:this.state.stageProgress,counts:this.state.counts,nodeCores:(cpu.user+cpu.system-this.cpu.user-this.cpu.system)/1e6/Math.max(seconds,.001),
      rssMiB:process.memoryUsage().rss/2**20,availableGiB:freemem()/2**30,
      activeMinutes:this.state.elapsedMs/60000,checkpoint:this.state.updated};
    appendFileSync(`${this.output}/events.jsonl`,JSON.stringify(row)+'\n');
    if(event==='task-complete')this.completed++;
    if(!event.startsWith('task-')||this.completed%12===0) console.log(`${row.at} ${event} stage=${row.stage} status=${row.status}; ${JSON.stringify(detail)}; active=${active.map(x=>`${x.id} ${x.ageSeconds.toFixed(1)}s`).join(',')||'none'}; completed tasks=${this.completed}; progress=${JSON.stringify(row.progress??{})}; Node=${row.nodeCores.toFixed(2)} cores RSS=${row.rssMiB.toFixed(0)}MiB available=${row.availableGiB.toFixed(2)}GiB; checkpoint=${row.checkpoint??'pending'}`);
    this.last=now;this.cpu=cpu;
  }
  close(){clearInterval(this.timer);}
}
