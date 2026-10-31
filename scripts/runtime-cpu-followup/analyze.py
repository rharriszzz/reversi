"""Compact complete-search receipts and descriptive paired timing intervals."""
import hashlib,json,math,os,statistics,collections
from pathlib import Path
OUT=Path(os.environ['REVERSI_DISPATCH_RUN']).resolve()
def sha(v):return hashlib.sha256(v).hexdigest()
def signature(r):return [{k:v for k,v in x.items() if k!='elapsedMs'} for x in r['roots']]
def effect(pairs):
    logs=[math.log(x/y) for x,y in pairs];n=len(logs)
    mean=statistics.mean(logs);se=statistics.stdev(logs)/math.sqrt(n)
    # Accepted campaign has nine paired trials: df=8, two-sided 95% t.
    critical=2.306004135204166
    assert n==9
    return {'percent':100*math.expm1(mean),'low95':100*math.expm1(mean-critical*se),'high95':100*math.expm1(mean+critical*se),'pairs':n,'logRatioSD':statistics.stdev(logs)}
def main():
    d=json.loads((OUT/'benchmarks.json').read_text());rows=[];references={};summaries={}
    for row in d['rows']:
        results={}
        for tag,r in row['results'].items():
            sig=signature(r);key=row['workload']
            one=len(next(w for w in d['workloads'] if w['id']==key)['positionIds'])
            references.setdefault(key,sig[:one])
            assert all(sig[i:i+one]==references[key] for i in range(0,len(sig),one)),(key,tag,'nonstationary fixed counters')
            results[tag]={k:v for k,v in r.items() if k!='roots'}
            results[tag]['signatureSha256']=sha(json.dumps(sig,sort_keys=True,separators=(',',':')).encode())
            results[tag]['meanRootElapsedMs']=[statistics.mean(r['roots'][i]['elapsedMs'] for i in range(j,len(sig),one)) for j in range(one)]
        assert len({v['signatureSha256'] for v in results.values()})==1
        rows.append({**{k:v for k,v in row.items() if k!='results'},'results':results})
    for w in d['workloads']:
        rs=[r for r in rows if r['workload']==w['id']];summaries[w['id']]={}
        for tag in d['tags']:
            timings=[r['results'][tag]['wallSeconds']/w['repeats'] for r in rs]
            cpus=[r['results'][tag]['workloadCpuSeconds']/w['repeats'] for r in rs]
            metrics=rs[0]['results'][tag]['metrics']
            summaries[w['id']][tag]={'meanMs':1000*statistics.mean(timings),'meanThreadCpuMs':1000*statistics.mean(cpus),'sdMs':1000*statistics.stdev(timings),'cvPercent':100*statistics.stdev(timings)/statistics.mean(timings),'minMs':1000*min(timings),'maxMs':1000*max(timings),'nodesPerBatch':metrics['nodes']/w['repeats'],'evaluationsPerBatch':metrics['evaluations']/w['repeats'],'mnps':metrics['nodes']/w['repeats']/statistics.mean(timings)/1e6}
        for a,b in [('B','A'),('C','A'),('D','A'),('D','B'),('B','C'),('D','C'),('A','N'),('B','N'),('C','N'),('D','N'),('BP','AP'),('CP','AP'),('DP','AP')]:
            summaries[w['id']][a+'/'+b]=effect([(r['results'][a]['wallSeconds'],r['results'][b]['wallSeconds']) for r in rs])
    timed=[]
    for row in d['timed']:
        # Timed roots intentionally retain their individual publication/counters.
        timed.append(row)
    compact={'workloads':d['workloads'],'tags':d['tags'],'method':d['method'],'seconds':d['seconds'],'rows':rows,'rootReferences':references,'timed':timed}
    (OUT/'compact-search.json').write_text(json.dumps(compact,separators=(',',':'))+'\n')
    (OUT/'summary.json').write_text(json.dumps(summaries,indent=2)+'\n')
    print('| Panel/model | A ms | B/A % [95%] | C/A % [95%] | D/A % [95%] | D/B % [95%] | B/N % [95%] |')
    print('| --- | ---: | ---: | ---: | ---: | ---: | ---: |')
    def fmt(v):return f"{v['percent']:+.2f} [{v['low95']:+.2f}, {v['high95']:+.2f}]"
    for w in d['workloads']:
        r=summaries[w['id']];print(f"| {w['id']} | {r['A']['meanMs']:.3f} | {fmt(r['B/A'])} | {fmt(r['C/A'])} | {fmt(r['D/A'])} | {fmt(r['D/B'])} | {fmt(r['B/N'])} |")
if __name__=='__main__':main()
