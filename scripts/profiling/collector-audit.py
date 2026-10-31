"""Small separate collector-resource audit, serially after the main campaign.

Shared-daemon deltas are not task-exclusive. /usr/bin/time and child rusage
include startup/sealing and reaped descendants, not just in-flight sampling.
"""
import os
import fcntl,importlib.util,json,re,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=(ROOT/os.environ.get('REVERSI_PROFILE_RUN','.local-research/profiling-m4-20261030')).resolve()
spec=importlib.util.spec_from_file_location('measure',ROOT/'scripts/profiling/measure.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def seconds(value):
    fields=value.replace('-',':').split(':');return sum(float(x)*factor for x,factor in zip(reversed(fields),[1,60,3600,86400]))
def processes():
    rows=subprocess.check_output(['ps','-axo','pid=,ppid=,time=,rss=,comm='],text=True);result={}
    for line in rows.splitlines():
        parts=line.split(None,4)
        if len(parts)==5 and re.search(r'DTServiceHub|DTInstrumentsDaemon|symbolicationd|CoreSymbolication|xctrace|ktrace|fixed-work',parts[4],re.I):
            pid,ppid,cpu,rss,name=parts;result[pid]={'ppid':int(ppid),'cpuSeconds':seconds(cpu),'rssKiB':int(rss),'name':Path(name).name}
    return result

def main():
    with (OUT/'measurement.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);reg=json.loads((OUT/'registration.json').read_text());budget=json.loads((OUT/'budget.json').read_text());w=next(w for w in reg['workloads'] if w['id']=='evaluate-B');rows=[]
        for mode in ['plain','ip-1000000','stacks-1000000','cpu-normal','time-normal','time-high']:
            assert budget['activeMeasurementSeconds']<5250
            m.resources.check();stem='collector-audit-'+mode;cmd,trace=m.command(mode,[reg['builds']['after']['executable'],*m.args(w,w['repeats'])],stem);assert not trace or not trace.exists()
            before=processes();observed={};started=time.monotonic()
            proc=subprocess.Popen(['/usr/bin/time','-l',*cmd],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
            while proc.poll() is None:
                for pid,info in processes().items():
                    previous=observed.get(pid)
                    observed[pid]={**info,'maxObservedRssKiB':max(info['rssKiB'],previous['maxObservedRssKiB'] if previous else 0)}
                time.sleep(.2)
            stdout,stderr=proc.communicate();r=subprocess.CompletedProcess(cmd,proc.returncode,stdout,stderr)
            times=re.search(r'([0-9.]+)\s+real\s+([0-9.]+)\s+user\s+([0-9.]+)\s+sys',stderr)
            extra={'outerSeconds':time.monotonic()-started,'timedCommandRealSeconds':float(times[1]) if times else None,'timedCommandUserSeconds':float(times[2]) if times else None,'timedCommandSystemSeconds':float(times[3]) if times else None}
            budget['activeMeasurementSeconds']+=extra['outerSeconds'];m.save('budget.json',budget);(OUT/(stem+'.log')).write_text(r.stdout+r.stderr);assert r.returncode==0,r.stderr
            after=processes();output=(OUT/(stem+'.stdout')).read_text() if trace else r.stdout;target=json.loads(output.strip().splitlines()[-1]);memory=re.search(r'(\d+)\s+maximum resident set size',r.stderr)
            deltas={pid:{'name':x['name'],'cpuSeconds':x['cpuSeconds']-before[pid]['cpuSeconds'],'rssKiBBefore':before[pid]['rssKiB'],'rssKiBAfter':x['rssKiB']} for pid,x in after.items() if pid in before}
            rows.append({'mode':mode,'target':target,**extra,'timedFamilyMaxRssBytes':int(memory[1]) if memory else None,'sharedDaemonDeltas':deltas,'observedTransientProcesses':{pid:info for pid,info in observed.items() if pid not in before},'newDaemonPids':[pid for pid in after if pid not in before],'exitedDaemonPids':[pid for pid in before if pid not in after]});m.save('collector-resources.json',{'rows':rows,'scope':'One supplementary evaluator run per condition, with a 5 Hz ps observer used only here. Observed per-process CPU/RSS are lower bounds at the last live observation; transient PID/PPID relationships identify the target and collector. time command accounting includes whatever descendants the OS charges to it, plus launch/save. Shared-daemon deltas can include other clients. RSS is not unique physical allocation. Offline export is separate.'});print(mode,flush=True)
if __name__=='__main__':main()
