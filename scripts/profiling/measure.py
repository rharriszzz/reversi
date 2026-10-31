"""Serial, resumable, bounded fixed-work profiler interference experiment.

All timing comes from the target's complete work interval, never trace duration.
Run --pilot, review registration.json, then run without --pilot. Existing trial
IDs are skipped; elapsed active measurement time is durable across resumption.
"""
import os
import argparse,fcntl,importlib.util,json,math,resource,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=(ROOT/os.environ.get('REVERSI_PROFILE_RUN','.local-research/profiling-m4-20261030')).resolve()
spec=importlib.util.spec_from_file_location('mac_resources',ROOT/'scripts/mac/resources.py');resources=importlib.util.module_from_spec(spec);spec.loader.exec_module(resources)
def save(name,value):
    p=OUT/name;tmp=p.with_suffix(p.suffix+'.tmp');tmp.write_text(json.dumps(value,indent=2)+'\n');tmp.replace(p)
def args(w,repeats):
    p=w['position'];bits=lambda v:format(sum(1<<i for i,x in enumerate(p['board']) if x==v),'x')
    return [w['mode'],bits(1),bits(-1),str(p['player']),str(w['depth']),str('BLP'.index(w['model'])),str(repeats),'3','0','unused']
def run(cmd,timeout=60):
    start=time.monotonic();before=resource.getrusage(resource.RUSAGE_CHILDREN)
    r=subprocess.run(cmd,capture_output=True,text=True,timeout=timeout);after=resource.getrusage(resource.RUSAGE_CHILDREN)
    return r,{'outerSeconds':time.monotonic()-start,'launcherChildrenCpuSeconds':after.ru_utime+after.ru_stime-before.ru_utime-before.ru_stime}
MODES=['plain','ip-1000000','ip-10000000','stacks-1000000','stacks-10000000','cpu-normal','cpu-high','time-normal','time-high']
def command(mode,cmd,stem):
    if mode=='plain':return cmd,None
    trace=OUT/(stem+'.trace');stdout=OUT/(stem+'.stdout')
    options=['--package',str(OUT/'hardware.instrdst'),'--instrument',f'Reversi Cycles {"IP" if mode.startswith("ip-") else "Stacks"} {mode.split("-")[-1]}']
    if mode.startswith(('cpu-','time-')):
        cpu=mode.startswith('cpu-');template='CPU Profiler' if cpu else 'Time Profiler'
        settings={template:({'highFrequency':mode.endswith('high'),'recordKernelCallstacks':False} if cpu else {'highFrequencySampling':mode.endswith('high'),'recordKernelStacks':False,'recordWaitingThreads':False,'contextSwitchSampling':False})}
        optionfile=OUT/(mode+'-settings.json');optionfile.write_text(json.dumps(settings));options=['--template',template,'--recording-options',str(optionfile)]
    return ['xcrun','xctrace','record','--no-prompt',*options,'--time-limit','30s','--output',str(trace),'--target-stdout',str(stdout),'--launch','--',*cmd],trace
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--pilot',action='store_true');o=ap.parse_args()
    with (OUT/'measurement.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        if not (OUT/'registration.json').exists():
            resources.check();config=json.loads((OUT/'builds.json').read_text());cal=[]
            for w in config['workloads']:
                for tag,b in config['builds'].items():
                    r,extra=run([b['executable'],*args(w,10)]);assert r.returncode==0,r.stderr;cal.append({'workload':w['id'],'tag':tag,**json.loads(r.stdout),**extra})
                fastest=min(x['wallSeconds']/10 for x in cal[-2:]);w['repeats']=max(1,math.ceil(2.5/fastest))
            # Conservative: max old/new calibrated work + 6 s per profiler launch.
            forecast=sum(max(x['wallSeconds']/10*w['repeats'] for x in cal if x['workload']==w['id'])*2*(7+8*5) for w in config['workloads'])+6*2*8*5*6+180
            assert forecast<5100,forecast
            save('registration.json',{**config,'calibration':cal,'modes':MODES,'plainTrials':7,'profiledTrials':5,'forecastSeconds':forecast,'capActiveSeconds':5400,'priorProbeAllowanceSeconds':120,'order':'Rotate mode/workload order by trial; alternate engine order. Fixed repetitions across builds/modes. No per-call profiling or timed searches.'})
        reg=json.loads((OUT/'registration.json').read_text());print(json.dumps({'forecastSeconds':reg['forecastSeconds'],'workloads':[(w['id'],w['repeats']) for w in reg['workloads']]}),flush=True)
        if o.pilot:return
        rows=json.loads((OUT/'trials.json').read_text()) if (OUT/'trials.json').exists() else []
        existing={x['id'] for x in rows};previous=resources.check();budget=json.loads((OUT/'budget.json').read_text()) if (OUT/'budget.json').exists() else {'activeMeasurementSeconds':120}
        for rep in range(7):
            order=MODES[rep%len(MODES):]+MODES[:rep%len(MODES)] if rep<5 else MODES[:1]
            for wi in range(len(reg['workloads'])):
                w=reg['workloads'][(wi+rep)%len(reg['workloads'])]
                for mode in order:
                    for tag in (['before','after'] if rep%2==0 else ['after','before']):
                        stem=f'{w["id"]}-{tag}-{mode}-{rep}'
                        if stem in existing:continue
                        assert budget['activeMeasurementSeconds']<5100,'Stop before 90 minute cap'
                        snap=resources.check();assert (snap['vmPages']['Swapouts']-previous['vmPages']['Swapouts'])*snap['pageBytes']<8*2**20,'Swap gate';previous=snap
                        with (OUT/'resources.jsonl').open('a') as f:f.write(json.dumps({'id':stem,**snap})+'\n')
                        cmd,trace=command(mode,[reg['builds'][tag]['executable'],*args(w,w['repeats'])],stem)
                        # Never overwrite failed traces; their ID must be examined first.
                        assert not trace or not trace.exists(),f'Unrecorded trace requires review: {trace}'
                        r,extra=run(cmd);budget['activeMeasurementSeconds']+=extra['outerSeconds'];save('budget.json',budget);(OUT/(stem+'.log')).write_text(r.stdout+r.stderr)
                        assert r.returncode==0,r.stderr
                        stdout=(OUT/(stem+'.stdout')).read_text() if trace else r.stdout
                        result=json.loads(stdout.strip().splitlines()[-1]);assert result['wallSeconds']<28,'Incomplete capture risk'
                        row={'id':stem,'rep':rep,'workload':w['id'],'mode':mode,'tag':tag,'result':result,'command':cmd,'raw':str(trace) if trace else None,**extra}
                        rows.append(row);save('trials.json',rows);print(json.dumps({'id':stem,'wall':result['wallSeconds'],'activeSeconds':budget['activeMeasurementSeconds']}),flush=True)
        for w in reg['workloads']:
            group=[r for r in rows if r['workload']==w['id']];assert len({r['result']['checksum'] for r in group})==1
            for tag in reg['builds']:
                same=[r['result'] for r in group if r['tag']==tag];assert all(r['metrics']==same[0]['metrics'] and r['exact']==same[0]['exact'] and r['depth']==same[0]['depth'] for r in same)
        save('measurement-resources-after.json',resources.snapshot());save('fixed-work-verified.json',{'passed':True,'trials':len(rows)});print('FIXED WORK VERIFIED',flush=True)
if __name__=='__main__':main()
