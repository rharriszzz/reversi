"""Serial intensive-stage launcher with a durable four-hour allowance ledger."""
import fcntl,json,os,signal,subprocess,sys,time
from pathlib import Path
from resources import check,snapshot
OUT=Path('.local-research/mac-modernization-20261030');OUT.mkdir(parents=True,exist_ok=True)

def save(path,value):
    pending=path.with_suffix(path.suffix+'.tmp');pending.write_text(json.dumps(value)+'\n');pending.replace(path)

def main():
    stage,*command=sys.argv[1:]
    assert command,'usage: python scripts/mac/run.py STAGE COMMAND [ARGS...]'
    with (OUT/'measurement.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        path=OUT/'measurement-budget.json'
        budget=json.loads(path.read_text()) if path.exists() else {'capSeconds':14400,'reportingReserveSeconds':1200,'spentSeconds':0,'stages':[]}
        if budget.get('active'):
            old=budget.pop('active');old['seconds']=max(0,time.time()-old['startUnix']);old['interrupted']=True
            budget['spentSeconds']+=old['seconds'];budget['stages'].append(old)
        remaining=budget['capSeconds']-budget['reportingReserveSeconds']-budget['spentSeconds']
        assert remaining>0,'Measurement allowance exhausted'
        before=check();start=time.monotonic();budget['active']={'stage':stage,'command':command,'startUnix':time.time(),'resourcesBefore':before};save(path,budget)
        child=subprocess.Popen(command,start_new_session=True)
        try:
            previous=before;swapping_samples=0
            with (OUT/'resources.jsonl').open('a') as history:
                while child.poll() is None:
                    if time.monotonic()-start>=remaining:raise TimeoutError('Measurement allowance reserve reached')
                    r=check();history.write(json.dumps({'stage':stage,**r})+'\n');history.flush()
                    swap_bytes=max(0,r['vmPages'].get('Swapouts',0)-previous['vmPages'].get('Swapouts',0))*r['pageBytes']
                    swapping_samples=swapping_samples+1 if swap_bytes>8*2**20 else 0
                    if swapping_samples>=2:raise RuntimeError('Sustained swap output; measurement stopped')
                    previous=r
                    try:child.wait(timeout=min(15,remaining-(time.monotonic()-start)))
                    except subprocess.TimeoutExpired:pass
            status=child.returncode
        finally:
            if child.poll() is None:
                os.killpg(child.pid,signal.SIGTERM)
                try:child.wait(timeout=5)
                except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);child.wait()
            row=budget.pop('active');row.update(seconds=time.monotonic()-start,status=child.returncode,resourcesAfter=snapshot())
            budget['spentSeconds']+=row['seconds'];budget['stages'].append(row);save(path,budget)
        sys.exit(status)
if __name__=='__main__':main()
