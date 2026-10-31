"""Best-effort diagnostic Instruments capture; never change profiling settings."""
import json,subprocess,time
from pathlib import Path
OUT=Path('.local-research/mac-modernization-20261030')
def main():
    f=json.loads((OUT/'fixtures.json').read_text());p=f['positions'][4]
    b=sum(1<<q for q,v in enumerate(p['board']) if v==1);w=sum(1<<q for q,v in enumerate(p['board']) if v==-1)
    rows=[]
    for template in ['Time Profiler','Allocations']:
        name=template.lower().replace(' ','-');trace=OUT/f'final-{name}.trace'
        command=['xcrun','xctrace','record','--template',template,'--output',str(trace),'--time-limit','4s','--launch','--',str((OUT/'profile-candidate').resolve()),'play',f'{b:x}',f'{w:x}',str(p['player']),'12','5','2']
        start=time.monotonic()
        try:
            run=subprocess.run(command,text=True,capture_output=True,timeout=35);row={'template':template,'command':command,'status':run.returncode,'stdout':run.stdout,'stderr':run.stderr,'wallSeconds':time.monotonic()-start}
            if run.returncode==0:
                toc=subprocess.run(['xcrun','xctrace','export','--input',str(trace),'--toc'],text=True,capture_output=True,timeout=20)
                (OUT/f'final-{name}-toc.xml').write_text(toc.stdout);row['tocStatus']=toc.returncode;row['toc']=toc.stdout
        except subprocess.TimeoutExpired as e:row={'template':template,'error':'Timed out; no system settings changed','wallSeconds':time.monotonic()-start}
        rows.append(row);print(json.dumps({'template':template,'status':row.get('status'),'error':row.get('error')}),flush=True)
    (OUT/'instruments.json').write_text(json.dumps({'rows':rows,'scope':'Separate diagnostic recordings. No unsupported cache-miss, frequency or allocation-rate inference.'})+'\n')
if __name__=='__main__':main()
