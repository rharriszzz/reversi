"""Interleaved fixed-work complete search panels; timed work is supplementary.

Invoke through run.py. Does not build or modify sources. Saves each completed
block atomically, checks full result/counter identity for fixed work.
"""
import hashlib,json,math,os,statistics,subprocess,sys,time
from pathlib import Path
OUT=Path(os.environ.get('REVERSI_FLIP_RUN','.local-research/fast-flips-m4-20261031')).resolve()
TAGS=os.environ.get('FLIP_TAGS','original,doubling,ray-table').split(',')
def bits(board,v):return format(sum(1<<q for q,x in enumerate(board) if x==v),'x')
def line(p,depth,model):return f'{bits(p["board"],1)} {bits(p["board"],-1)} {p["player"]} {depth} {"BLP".index(model)}\n'
def run(tag,mode,file,repeats,warmups=2,budget=0):
    r=subprocess.run([str(OUT/tag/'fixed-work'),mode,str(file),str(repeats),str(warmups),str(budget)],text=True,capture_output=True,check=True,timeout=60)
    return json.loads(r.stdout)
def signature(r):return [{k:v for k,v in x.items() if k!='elapsedMs'} for x in r['roots']]
def main():
    positions=json.loads((OUT/'positions.json').read_text());workloads=[]
    depth=lambda p:64-p['occupied'] if p.get('exactRoot') else 8 if p['occupied']<28 else 7 if p['occupied']<52 else max(1,min(10,64-p['occupied']))
    for model in ['B','L','P']:
        panels={'mixed48':positions,'exact12':[p for p in positions if p.get('exactRoot')],
                'profile-root':[p for p in positions if p['id']=='native-engineering-10'],
                'opening':[p for p in positions[:4]],'middle':positions[4:10],
                'coaching':[positions[1],positions[5]]}
        for panel,roots in panels.items():
            file=OUT/(panel+'-'+model+'.txt');mode='coach' if panel=='coaching' else 'play'
            file.write_text(''.join(line(p,6 if mode=='coach' else 12 if panel=='profile-root' else depth(p),model) for p in roots))
            pilot=run('original',mode,file,1,1);repeat=max(1,math.ceil(.35/max(.001,pilot['wallSeconds'])))
            repeat=min(2000,repeat)
            workloads.append({'id':panel+'-'+model,'panel':panel,'model':model,'positionIds':[p['id'] for p in roots],'file':str(file),'mode':mode,'repeats':repeat,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
    (OUT/'workloads.json').write_text(json.dumps(workloads,indent=2)+'\n')
    rows=[];start=time.monotonic();reps=int(os.environ.get('FLIP_REPS','9'))
    for rep in range(reps):
        order=TAGS[rep%len(TAGS):]+TAGS[:rep%len(TAGS)]
        if rep%2:order.reverse()
        for w in workloads[rep%len(workloads):]+workloads[:rep%len(workloads)]:
            results={tag:run(tag,w['mode'],Path(w['file']),w['repeats']) for tag in order}
            first=results[TAGS[0]]
            assert all(signature(r)==signature(first) for r in results.values()),'Score/tree/counter mismatch '+w['id']
            rows.append({'rep':rep,'workload':w['id'],'order':order,'results':results})
        (OUT/'integrated-checkpoint.json').write_text(json.dumps({'workloads':workloads,'rows':rows})+'\n')
        print(f'fixed rep {rep+1}/{reps}',file=sys.stderr,flush=True)
    timed=[]
    for rep in range(3):
        order=TAGS if rep%2==0 else TAGS[::-1]
        for model in ['B','L','P']:
            roots=[positions[i] for i in [0,2,4,5,7,9]];file=OUT/('timed-'+model+'.txt');file.write_text(''.join(line(p,0,model) for p in roots))
            for budget in [80,300]:
                results={tag:run(tag,'play',file,1,1,budget) for tag in order}
                assert all(x['hasScore'] and x['depth']>0 and x['elapsedMs']<budget+20 for r in results.values() for x in r['roots'])
                timed.append({'rep':rep,'model':model,'budgetMs':budget,'positionIds':[p['id'] for p in roots],'order':order,'results':results})
    print(json.dumps({'workloads':workloads,'rows':rows,'timed':timed,'seconds':time.monotonic()-start,'tags':TAGS,'method':'Production engine objects, identical driver object; fresh process per complete work block; 2 full warmup batches; rotated/reversed tag and workload order; same full counters for every fixed-work call.'}))
if __name__=='__main__':main()
