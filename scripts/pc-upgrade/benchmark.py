"""Bounded GCC 15 comparison on the previously disclosed PC/M4 panel."""
import contextlib
import importlib.util
import json
import os
from pathlib import Path
import statistics
import sys
import time

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'.local-research/pc-upgrade-20261030'
sys.path.insert(0,str(ROOT/'scripts/windows-pc'))
from qualify import client,args
from resources import linux,windows

def snapshot():return {'linux':linux(),'windows':windows()}
def main():
    positions=json.loads((OUT/'fixtures.json').read_text())['positions']
    rows=[];start=time.monotonic();before=snapshot()
    assert before['linux']['availableBytes']>3*2**30 and before['windows']['availableBytes']>3*2**30,before
    names=['portable','native','popcnt']
    paths=['native','native-host','native-popcnt']
    receipts={k:ROOT/'.local-research'/p/'build.json' for k,p in zip(names,paths)}
    def depth(p):return 7 if p['occupied']<28 else 6 if p['occupied']<52 else max(1,min(9,64-p['occupied']))
    def run(engine,model,repeats,static=False):
        values=[];details=[];wall=time.monotonic()
        keys=['elapsedMs','cpuMs','nodes','evaluations']
        for p in positions:details.append({'id':p['id'],'depth':depth(p),'score':None,**{k:0 for k in keys}})
        for _ in range(repeats):
            for p,detail in zip(positions,details):
                a=args(p['board'],p['player'],model)
                r=engine.request(f'search {a} {depth(p)} 0 1 0 0 0')
                if detail['score'] is None:detail['score']=r['score']
                assert detail['score']==r['score']
                for k in keys:detail[k]+=r[k]
        wall_ms=(time.monotonic()-wall)*1000
        for p,detail in zip(positions,details):
            values.append(detail['score'])
            if static:detail['static']=engine.request(f"evalbench {args(p['board'],p['player'],model)} 200000")
        return {'positions':details,'values':values,'wallMs':wall_ms,**{k:sum(p[k] for p in details) for k in keys}}
    with contextlib.ExitStack() as stack:
        engines={k:stack.enter_context(client.NativeEngine(p)) for k,p in receipts.items()}
        for model in ['B','P']:
            for name in names:run(engines[name],model,2)
        for rep in range(7):
            order=names[rep%3:]+names[:rep%3]
            if rep%2:order=order[::-1]
            for model in (['B','P'] if rep%2==0 else ['P','B']):
                results={k:run(engines[k],model,10,True) for k in order}
                expected=results['portable']
                for result in results.values():
                    for k in ['values','nodes','evaluations']:assert result[k]==expected[k],k
                    for p,q in zip(result['positions'],expected['positions']):assert p['static']['checksum']==q['static']['checksum']
                rows.append({'rep':rep,'model':model,'order':order,'repeats':10,'results':results})
                print(json.dumps({'rep':rep,'model':model,'batchMs':{k:v['elapsedMs']/10 for k,v in results.items()}}),flush=True)
    summary=[]
    for model in ['B','P']:
        selected=[r for r in rows if r['model']==model]
        for name in names:
            rs=[r['results'][name] for r in selected];times=[r['elapsedMs']/10 for r in rs];cpus=[r['cpuMs']/10 for r in rs]
            ns=[p['static']['elapsedMs']*1e6/p['static']['evaluations'] for r in rs for p in r['positions']]
            summary.append({'model':model,'build':name,'batchMs':times,'medianBatchMs':statistics.median(times),'rangeBatchMs':[min(times),max(times)],'medianCpuMs':statistics.median(cpus),'nodes':rs[0]['nodes']//10,'evaluations':rs[0]['evaluations']//10,'millionNodesPerSecond':rs[0]['nodes']/10/statistics.median(times)/1000,'medianStaticNs':statistics.median(ns),'staticMillionPerSecond':1000/statistics.median(ns)})
    result={'passed':True,'fixtures':positions,'rows':rows,'summary':summary,'receipts':{k:json.loads(p.read_text()) for k,p in receipts.items()},'resourcesBefore':before,'resourcesAfter':snapshot(),'wallSeconds':time.monotonic()-start,'policy':'7 serial repeated blocks, 10 searches per root, 2 warmups; rotating/reversing builds; no CPU profiler; historical GCC11 only per user steering'}
    (OUT/'native-benchmarks.json').write_text(json.dumps(result)+'\n')
    print(json.dumps(summary,indent=2))
if __name__=='__main__':main()
