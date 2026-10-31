"""Compact evidence/statistics. No searches or profiler collection."""
import collections,hashlib,json,math,os,re,statistics
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=(ROOT/os.environ.get('REVERSI_FLIP_RUN','.local-research/fast-flips-m4-20261031')).resolve()
def stats(a):
    mean=statistics.mean(a)
    return {'values':a,'median':statistics.median(a),'mean':mean,'min':min(a),'max':max(a),'cvPercent':100*statistics.stdev(a)/mean if len(a)>1 and mean else 0}
def effect(ratios):
    logs=[math.log(x) for x in ratios];mean=statistics.mean(logs);t={7:2.446912,9:2.306004,3:4.302653}.get(len(logs),2.776445)
    radius=t*statistics.stdev(logs)/math.sqrt(len(logs))
    return {'percent':100*math.expm1(mean),'low':100*math.expm1(mean-radius),'high':100*math.expm1(mean+radius),'pairs':len(logs),'method':'95% descriptive paired Student-t interval on log ratios; no multiplicity/drift correction.'}
def main():
    micro=json.loads((OUT/'micro.json').read_text());data=json.loads((OUT/(os.environ.get('FLIP_DATA','integrated')+'.json')).read_text());builds=json.loads((OUT/'builds.json').read_text())
    ms=[]
    for group in dict.fromkeys(r['class'] for r in micro['rows']):
        base=[r for r in micro['rows'] if r['class']==group and r['algorithm']=='original']
        for tag in dict.fromkeys(r['algorithm'] for r in micro['rows']):
            rows=[r for r in micro['rows'] if r['class']==group and r['algorithm']==tag]
            assert [r['checksum'] for r in rows]==[r['checksum'] for r in base]
            ns=[r['wallSeconds']*1e9/r['calls'] for r in rows];baseNs=[r['wallSeconds']*1e9/r['calls'] for r in base]
            ms.append({'class':group,'tag':tag,'cases':rows[0]['cases'],'ns':stats(ns),'callsPerSecond':1e9/statistics.median(ns),'vsOriginal':effect([x/y for x,y in zip(ns,baseNs)])})
    weighted=[]
    for tag in dict.fromkeys(x['tag'] for x in ms):
        # Disjoint legal-play phase classes only; no duplicate edge subset or controlled stress.
        s=[x for x in ms if x['tag']==tag and x['class'] in ['opening','middle','late','last-two','last-one']]
        weighted.append({'tag':tag,'cases':sum(x['cases'] for x in s),'ns':sum(x['cases']*x['ns']['median'] for x in s)/sum(x['cases'] for x in s)})
    panels=[]
    for w in data['workloads']:
        rs=[r for r in data['rows'] if r['workload']==w['id']]
        for tag in data['tags']:
            values=[r['results'][tag]['wallSeconds']/w['repeats'] for r in rs]
            cpu=[r['results'][tag]['workloadCpuSeconds']/w['repeats'] for r in rs]
            panels.append({'workload':w['id'],'tag':tag,'roots':len(w['positionIds']),'repeats':w['repeats'],'batchSeconds':stats(values),'batchCpuSeconds':stats(cpu),'metricsPerBatch':{k:v/w['repeats'] for k,v in rs[0]['results'][tag]['metrics'].items()},'millionNodesPerSecond':rs[0]['results'][tag]['metrics']['nodes']/w['repeats']/statistics.median(values)/1e6,'vsOriginal':effect([r['results'][tag]['wallSeconds']/r['results']['original']['wallSeconds'] for r in rs])})
    timed=[]
    for model in ['B','L','P']:
        for budget in [80,300]:
            for tag in data['tags']:
                rs=[x for r in data['timed'] if r['model']==model and r['budgetMs']==budget for x in r['results'][tag]['roots']]
                timed.append({'model':model,'budgetMs':budget,'tag':tag,'searches':len(rs),'depth':stats([r['depth'] for r in rs]),'meanNodes':statistics.mean(r['metrics']['nodes'] for r in rs),'meanElapsedMs':statistics.mean(r['elapsedMs'] for r in rs),'maxOverrunMs':max(r['elapsedMs']-budget for r in rs),'depthZero':sum(not r['depth'] for r in rs)})
    assembly=[]
    for tag in builds['builds']:
        text=(OUT/tag/'assembly.txt').read_text();match=re.search(r'__ZN7reversi5flipsE\w+:\n(.*?)(?=^[_A-Za-z].*:\n)',text,re.M|re.S)
        if not match:continue
        instructions=[line for line in match[1].splitlines() if re.match('[0-9a-f]{16}\\s',line)]
        assembly.append({'tag':tag,'flipInstructions':len(instructions),'flipBytes':4*len(instructions),'conditionalBranches':sum(bool(re.search(r'\tb\.(?:eq|ne|lt|gt|le|ge)\s|\t(?:cbz|cbnz|tbz|tbnz)\s',x)) for x in instructions),'loads':sum(bool(re.search(r'\t(?:ldr|ldp)\s',x)) for x in instructions),'tableBytes':4096 if tag in ['ray-table','late-ray'] else 0,'instructions':instructions})
    result={'micro':ms,'legalPhaseWeightedMicro':weighted,'panels':panels,'timed':timed,'assembly':assembly,'qualification':json.loads((OUT/'qualification.json').read_text()),'sanitize':json.loads((OUT/'sanitize.json').read_text()),'diagnostic':json.loads((OUT/'diagnostic.json').read_text()),'builds':builds,'microCheckedCases':micro['checkedCases']}
    (OUT/(os.environ.get('FLIP_SUMMARY','summary')+'.json')).write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'weightedMicro':weighted,'candidatePanels':[x for x in panels if x['tag']=='ray-table'],'assembly':[{k:v for k,v in x.items() if k!='instructions'} for x in assembly]},indent=2))
if __name__=='__main__':main()
