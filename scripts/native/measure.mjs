// A single active four-hour measurement ledger. Pauses between stages are free;
// an interrupted stage is conservatively charged through the next invocation.
import { mkdirSync,existsSync,readFileSync,writeFileSync,renameSync,openSync,closeSync,fsyncSync,unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
export const output=resolve(process.env.NATIVE_RUN??'.local-research/native-engine-20261030');
export function read(path) {return JSON.parse(readFileSync(path,'utf8'));}
export function atomic(path,value) {const tmp=`${path}.tmp`;const fd=openSync(tmp,'w');try {writeFileSync(fd,JSON.stringify(value)+'\n');fsyncSync(fd);}finally{closeSync(fd);}renameSync(tmp,path);}
export function resources() {
 const run=(command,args)=>execFileSync(command,args,{encoding:'utf8',timeout:10000});
 if(process.platform==='darwin') {
  const vm=run('vm_stat',[]),page=Number(vm.match(/page size of (\d+)/)[1]),counts=Object.fromEntries([...vm.matchAll(/^([^:\n]+):\s+(\d+)/gm)].map(m=>[m[1],Number(m[2])]));
  const availableGiB=['Pages free','Pages inactive','Pages speculative'].reduce((n,k)=>n+(counts[k]??0),0)*page/2**30;
  return {at:new Date().toISOString(),platform:process.platform,availableGiB,swap:run('sysctl',['vm.swapusage']).trim(),swapins:counts.Swapins,swapouts:counts.Swapouts,processes:run('ps',['-axo','pid,ppid,%cpu,rss,comm']),disk:run('df',['-k','.']),load:run('sysctl',['vm.loadavg']).trim()};
 }
 return {at:new Date().toISOString(),platform:process.platform,memory:run('free',['-b']),processes:run('ps',['-axo','pid,ppid,%cpu,rss,comm']),disk:run('df',['-k','.'])};
}
export async function measure(stage,operation) {
 mkdirSync(output,{recursive:true});const path=resolve(output,'measurement-budget.json'),lock=resolve(output,'measurement.lock');
 if(existsSync(lock)) {const owner=read(lock);try{process.kill(owner.pid,0);throw Error(`Measurement already active: ${owner.pid}`);}catch(e){if(e.code!=='ESRCH')throw e;}unlinkSync(lock);}
 const fd=openSync(lock,'wx');writeFileSync(fd,JSON.stringify({pid:process.pid,stage}));closeSync(fd);
 const budget=existsSync(path)?read(path):{version:1,capMs:4*3600000,reportingReserveMs:20*60000,spentMs:0,stages:[]};
 if(budget.active){const charged=Math.max(0,Date.now()-budget.active.start);budget.spentMs+=charged;budget.stages.push({...budget.active,elapsedMs:charged,interrupted:true});delete budget.active;}
 if(budget.spentMs+budget.reportingReserveMs>=budget.capMs){unlinkSync(lock);throw Error('Measurement allowance exhausted');}
 const before=resources();atomic(resolve(output,`${stage}-resources-before.json`),before);
 if(before.availableGiB!==undefined&&before.availableGiB<3){unlinkSync(lock);throw Error('Less than 3 GiB physical headroom');}
 budget.active={stage,start:Date.now(),pid:process.pid};atomic(path,budget);const start=performance.now();
 const timer=setTimeout(()=>{console.error('Hard measurement allowance reached');process.exit(2);},budget.capMs-budget.spentMs-budget.reportingReserveMs);timer.unref();
 try{return await operation(budget);}finally {
  clearTimeout(timer);const elapsedMs=performance.now()-start;budget.spentMs+=elapsedMs;budget.stages.push({...budget.active,elapsedMs});delete budget.active;atomic(path,budget);
  atomic(resolve(output,`${stage}-resources-after.json`),resources());unlinkSync(lock);
 }
}
