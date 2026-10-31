"""Small M4 campaign using the already-qualified hardware PMI collector.

Run through run.py, serially after unprofiled measurements. No export or
symbolization overlaps target work. All raw traces remain ignored.
"""
import importlib.util,json,math,os,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=(ROOT/os.environ.get('REVERSI_FLIP_RUN','.local-research/fast-flips-m4-20261031')).resolve()
os.environ['REVERSI_PROFILE_RUN']=str(OUT)
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def main():
    assert sys.platform=='darwin','M4 profiling only; PC must probe perf independently'
    manifest=json.loads((OUT/'builds.json').read_text());workloads=json.loads((OUT/'workloads.json').read_text());rows=[];plain=[]
    tags=os.environ.get('FLIP_PROFILE_TAGS','original,ray-table').split(',')
    # Build the existing package into this fresh run, without changing settings.
    subprocess.run([sys.executable,'scripts/profiling/package.py'],check=True,stdout=sys.stderr)
    measure=module('measure','scripts/profiling/measure.py')
    for name in ['profile-root-P','opening-B','middle-P']:
        w=next(w for w in workloads if w['id']==name)
        calibrations={tag:json.loads(subprocess.check_output([str(OUT/tag/'fixed-work'),w['mode'],w['file'],'2','2','0'],text=True)) for tag in tags}
        repeats=math.ceil(2.5/min(r['wallSeconds']/2 for r in calibrations.values()))
        modes=['plain','ip-10000000','ip-1000000','stacks-1000000','cpu-normal'] if name=='profile-root-P' else ['plain','ip-10000000']
        for mode in modes:
            for tag in tags:
                stem=f'{name}-{tag}-{mode}';cmd=[str(OUT/tag/'fixed-work'),w['mode'],w['file'],str(repeats),'2','0']
                command,trace=measure.command(mode,cmd,stem);assert not trace or not trace.exists(),'Preserve previous trace'
                start=time.monotonic();r=subprocess.run(command,capture_output=True,text=True,timeout=60)
                (OUT/(stem+'.log')).write_text(r.stdout+r.stderr);r.check_returncode()
                stdout=(OUT/(stem+'.stdout')).read_text() if trace else r.stdout
                result=json.loads(stdout.strip().splitlines()[-1]);assert result['wallSeconds']<25
                row={'id':stem,'mode':mode,'workload':name,'tag':tag,'rep':0,'raw':str(trace) if trace else None,'result':result,'command':command,'outerSeconds':time.monotonic()-start,'repeats':repeats}
                rows.append(row);print(stem,file=sys.stderr,flush=True)
                (OUT/'profile-checkpoint.json').write_text(json.dumps(rows)+'\n')
    print(json.dumps(rows))
if __name__=='__main__':main()
