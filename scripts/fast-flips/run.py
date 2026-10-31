"""Serial measurement boundary, resource check, durable 90-minute ledger."""
import importlib.util,json,os,platform,shutil,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=(ROOT/os.environ.get('REVERSI_FLIP_RUN','.local-research/fast-flips-m4-20261031')).resolve()
def snapshot():
    if platform.system()=='Darwin':
        spec=importlib.util.spec_from_file_location('resources',ROOT/'scripts/mac/resources.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
        return m.check()
    return {'platform':platform.platform(),'memory':Path('/proc/meminfo').read_text(),'load':os.getloadavg(),'diskFreeBytes':shutil.disk_usage(ROOT).free,'processes':subprocess.check_output(['ps','-eo','pid,pcpu,pmem,comm','--sort=-pcpu'],text=True).splitlines()[:20]}
def main():
    import fcntl
    OUT.mkdir(parents=True,exist_ok=True)
    with (OUT/'measurement.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        name=sys.argv[1];path=OUT/(name+'.json');assert not path.exists(),f'Preserve {path}'
        ledger=OUT/'budget.json';budget=json.loads(ledger.read_text()) if ledger.exists() else {'activeSeconds':0,'runs':[]}
        assert budget['activeSeconds']<5100,'90-minute measurement cap'
        before=snapshot();start=time.monotonic()
        try:
            with path.open('w') as output, (OUT/(name+'.stderr')).open('w') as error:
                result=subprocess.run(sys.argv[2:],stdout=output,stderr=error,timeout=max(1,5300-budget['activeSeconds']))
        finally:
            elapsed=time.monotonic()-start;after=snapshot();budget['activeSeconds']+=elapsed
            budget['runs'].append({'name':name,'command':sys.argv[2:],'seconds':elapsed,'before':before,'after':after})
            ledger.write_text(json.dumps(budget,indent=2)+'\n')
        result.check_returncode();print(json.dumps({'name':name,'seconds':elapsed,'activeSeconds':budget['activeSeconds']}))
if __name__=='__main__':main()
