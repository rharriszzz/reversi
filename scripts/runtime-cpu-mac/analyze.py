"""Descriptive paired intervals on fixed panels, not playing-strength evidence."""
import json,math,os,statistics
from pathlib import Path
OUT=Path(os.environ['REVERSI_FLIP_RUN']).resolve()
def stats(values):
    mean=statistics.mean(values)
    return dict(values=values,mean=mean,median=statistics.median(values),sd=statistics.stdev(values),cvPercent=100*statistics.stdev(values)/mean,min=min(values),max=max(values))
def effect(ratios):
    logs=[math.log(x) for x in ratios];mean=statistics.mean(logs)
    assert len(logs)==7,'Seven accepted pairs required'
    radius=2.446912*statistics.stdev(logs)/math.sqrt(7)
    return dict(percent=100*math.expm1(mean),low=100*math.expm1(mean-radius),high=100*math.expm1(mean+radius),pairs=7)
def native(data):
    rows=[]
    for w in data['workloads']:
        blocks=[r for r in data['rows'] if r['workload']==w['id']];row=dict(workload=w['id'])
        for tag in ['original','selected']:
            row[tag]={k:stats([r['results'][tag][k]*1000/w['repeats'] for r in blocks]) for k in ['wallSeconds','workloadCpuSeconds','processCpuSeconds']}
            row[tag]['metricsPerBatch']={k:v/w['repeats'] for k,v in blocks[0]['results'][tag]['metrics'].items()}
        row['effect']=effect([r['results']['selected']['wallSeconds']/r['results']['original']['wallSeconds'] for r in blocks]);rows.append(row)
    return rows
def browser(data):
    rows=[]
    for panel,model in dict.fromkeys((r['panel'],r['model']) for r in data['rows']):
        blocks=[r for r in data['rows'] if (r['panel'],r['model'])==(panel,model)];row=dict(workload=panel+'-'+model)
        for tag in ['original','selected']:row[tag]=stats([r['results'][tag]['wallMs']/r['results'][tag]['repeats'] for r in blocks])
        row['effect']=effect([r['results']['selected']['wallMs']/r['results']['original']['wallMs'] for r in blocks]);rows.append(row)
    return rows
def main():
    result={'method':'Seven alternating/rotated matched pairs, geometric mean paired elapsed ratio and two-sided Student-t 95% interval on log ratios (df=6); fixed panels, ordinary desktop variability, no multiplicity correction or population/strength interpretation. Times per complete batch in ms.',
            'native':native(json.loads((OUT/'integrated-final.json').read_text()))}
    for name,file in [('chrome','browser-qualification.json'),('safari','safari-browser-qualification.json')]:
        if (OUT/file).exists():result[name]=browser(json.loads((OUT/file).read_text()))
    (OUT/'summary.json').write_text(json.dumps(result,indent=2)+'\n')
    for name,rows in result.items():
        if name=='method':continue
        print(name)
        for row in rows:
            a,b=(row[t]['wallSeconds']['mean'] if name=='native' else row[t]['mean'] for t in ['original','selected']);e=row['effect']
            print(f"| {row['workload']} | {a:.3f} → {b:.3f} | {e['percent']:+.2f}% [{e['low']:+.2f}, {e['high']:+.2f}] |")
if __name__=='__main__':main()
