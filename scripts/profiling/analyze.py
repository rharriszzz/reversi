"""Analyze completed evidence only. Does not launch a workload or profiler."""
import os
import collections,importlib.util,json,math,statistics
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];DATA=ROOT/'docs/data/profiling';OUT=(ROOT/os.environ.get('REVERSI_PROFILE_RUN','.local-research/profiling-m4-20261030')).resolve()
spec=importlib.util.spec_from_file_location('normalize',ROOT/'scripts/profiling/normalize.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
def distribution(captures,work,tag,mode):
    values=collections.Counter()
    for c in captures:
        if (c['workloadId'],c['buildId'],c['mode'])==(work,tag,mode):values.update(c['functionWeights'])
    total=sum(values.values());return {k:v/total for k,v in values.items()} if total else {}
def compare(a,b):
    keys=set(a)|set(b);return {'totalVariationPercent':50*sum(abs(a.get(k,0)-b.get(k,0)) for k in keys),'top5A':sorted(a,key=a.get,reverse=True)[:5],'top5B':sorted(b,key=b.get,reverse=True)[:5],'sharesA':dict(sorted(a.items(),key=lambda x:-x[1])),'sharesB':dict(sorted(b.items(),key=lambda x:-x[1]))}
def main():
    bench=json.loads((DATA/'benchmarks.json').read_text());rows=bench['trials'];caps=bench['captureStatistics'];lookup={(r['workload'],r['tag'],r['mode'],r['rep']):r for r in rows};reg=bench['registration'];increments=[];rates=[];hotspots=[];noise=[]
    for work in reg['workloads']:
        wid=work['id']
        for tag in reg['builds']:
            plain=[r['result']['wallSeconds'] for r in rows if (r['workload'],r['tag'],r['mode'])==(wid,tag,'plain')];noise.append({'workload':wid,'build':tag,'coefficientOfVariationPercent':100*statistics.stdev(plain)/statistics.mean(plain),'rangePercentOfMean':100*(max(plain)-min(plain))/statistics.mean(plain)})
            for period in [1000000,10000000]:
                effects={}
                for field,label in [('wallSeconds','wall'),('workloadCpuSeconds','cpu')]:effects[label]=n.effect([lookup[(wid,tag,'stacks-'+str(period),i)]['result'][field]/lookup[(wid,tag,'ip-'+str(period),i)]['result'][field] for i in range(5)])
                increments.append({'workload':wid,'build':tag,'period':period,**effects})
            for high,low in [('ip-1000000','ip-10000000'),('stacks-1000000','stacks-10000000'),('cpu-high','cpu-normal'),('time-high','time-normal')]:
                rates.append({'workload':wid,'build':tag,'high':high,'low':low,'wall':n.effect([lookup[(wid,tag,high,i)]['result']['wallSeconds']/lookup[(wid,tag,low,i)]['result']['wallSeconds'] for i in range(5)])})
            for mode in ['stacks-1000000','cpu-normal','time-normal']:
                hotspots.append({'workload':wid,'build':tag,'a':'ip-1000000','b':mode,**compare(distribution(caps,wid,tag,'ip-1000000'),distribution(caps,wid,tag,mode))})
    # TOC requirements expose the shipped CPU Profiler's underlying PMI event.
    for capture in caps:
        if capture['mode'].startswith('cpu-'):
            evidence=next(c for c in caps if c['mode']==capture['mode'] and c.get('collectionRequests'))
            requests=[r for r in evidence['collectionRequests'] if r['schema']=='kdebug-counters-with-pmi-sample']
            assert len(requests)==1 and requests[0]['pmi-event'].strip('\"')=='CORE_ACTIVE_CYCLE'
            capture['event']['hardwareEvent']='CORE_ACTIVE_CYCLE'
            capture['event']['period']=int(requests[0]['pmi-threshold'])
            capture['event']['periodProvenance']='Qualified same-mode TOC '+evidence['id']+' kdebug-counters-with-pmi-sample requirement. Identical template settings for the mode; individual exported cycle weights retained.'
    manifest=json.loads((DATA/'manifest.json').read_text());paths={};quality=[]
    for meta in manifest['profiles']:
        p=json.loads((DATA/meta['file']).read_text())
        if meta['mode'].startswith('cpu-'):
            capture=next(c for c in caps if c['id']==meta['id']);p['event']=dict(capture['event']);meta['event']=dict(capture['event'])
        toc=OUT/'exports'/(meta['id']+'-toc.xml')
        if toc.exists():
            import xml.etree.ElementTree as ET
            mode=ET.parse(toc).findtext('.//recording-mode');p['configuration']['recordingMode']=mode;p['capture']['recordingMode']=mode;meta['recordingMode']=mode
            for capture in caps:
                if capture['id']==meta['id']:capture['recordingMode']=mode
            (DATA/meta['file']).write_text(json.dumps(p,separators=(',',':'))+'\n')
        if p['method']=='hardware-raw-stacks':
            xml=n.XML(OUT/'exports'/(p['id']+'-pmi-sample.xml'));registers={}
            for row in xml.rows('pmi-sample'):
                thread=xml.resolve(row['thread']);key=(xml.integer(row['time'])-p['timestamps']['originTraceNs'],xml.text(thread.find('tid')),str(xml.integer(row['pmi-count'])))
                bt=xml.resolve(row['cp-user-callstack']);registers[key]=[hex(xml.integer(value)) for value in bt.findall('register-content')]
            for sample in p['samples']:
                values=registers[(sample[0],sample[5],str(sample[4]))]
                if len(sample)==7:sample.append(values)
                else:sample[7]=values
            p['capture']['sampleColumns']=['timeNs','stackId','weight','core','rawCumulativeCounter','threadId','hardwareProgramCounter','rawUnwindFixupRegisters']
            p['configuration']['stackRepresentation']='Captured PC plus return-address fragment; raw ARM64 LR fixup values retained separately, not inserted as guessed caller frames.'
            p['configuration']['unwindFixupsApplied']=False
        if p['kind']=='stacks':
            unresolvedContext=[s for s in p['samples'] if not p['stacks'][s[1]] or any(p['frames'][i]['unresolved'] for i in p['stacks'][s[1]])]
            p['accounting']['unresolvedContextWeight']=sum(s[2] for s in unresolvedContext);p['accounting']['unresolvedContextSamples']=len(unresolvedContext)
            (DATA/meta['file']).write_text(json.dumps(p,separators=(',',':'))+'\n')
        unique=len({p['frames'][s[1]]['address'] for s in p['samples']}) if p['kind']=='ip' else None
        quality.append({'id':p['id'],'samples':p['accounting']['samples'],'uniqueLeafPCs':unique,'unresolvedPercent':100*p['accounting']['unresolvedWeight']/p['accounting']['weight'],'unresolvedContextPercent':100*p['accounting'].get('unresolvedContextWeight',0)/p['accounting']['weight'] if p['kind']=='stacks' else None,'inlinedFrameDefinitions':sum(f.get('inlined',False) for f in p['frames']),'depth':p.get('capture',{}).get('depth')})
        if p['workloadId']=='exact-P' and p['method'] in ['hardware-raw-stacks','cpu-profiler-stacks']:
            callers=collections.Counter();withMain=0;tailWeight=0
            for sample in p['samples']:
                names=[p['frames'][i]['name'] for i in p['stacks'][sample[1]]]
                if 'main' in names:withMain+=sample[2]
                at=next((i for i,name in enumerate(names) if 'lastEmpties' in name),None)
                if at is not None:
                    tailWeight+=sample[2];callers[' → '.join(names[max(0,at-2):at+1])]+=sample[2]
            paths[p['id']]={'helperInclusivePercent':100*tailWeight/p['accounting']['weight'],'withMainPercent':100*withMain/p['accounting']['weight'],'actualCallerPaths':dict(callers)}
    instructionComparisons=[]
    def regions(p,size):
        counts=collections.Counter()
        for sample in p['samples']:
            fid=sample[1] if p['kind']=='ip' else p['stacks'][sample[1]][-1] if p['stacks'][sample[1]] else None
            frame=p['frames'][fid] if fid is not None else None
            key=hex(int(frame['relativeAddress'],16)//size*size) if frame and frame.get('relativeAddress') else '(unresolved leaf)'
            counts[key]+=sample[2]
        total=sum(counts.values());return {k:v/total for k,v in counts.items()}
    for work in reg['workloads']:
        wid=work['id'];ip=next((m for m in manifest['profiles'] if (m['workloadId'],m['buildId'],m['mode'])==(wid,'after','ip-1000000')),None);stack=next((m for m in manifest['profiles'] if (m['workloadId'],m['buildId'],m['mode'])==(wid,'after','stacks-1000000')),None)
        if not ip or not stack:continue
        a=json.loads((DATA/ip['file']).read_text());b=json.loads((DATA/stack['file']).read_text())
        for size in [4,64]:instructionComparisons.append({'workload':wid,'regionBytes':size,'scope':'Two complete rep-0 captures, same binary/event/period. Fine-grained differences include sparse-sample variation.',**compare(regions(a,size),regions(b,size))})
    analysis={'version':1,'trialCount':len(rows),'captureCount':len(caps),'additionalStackInterference':increments,'higherSamplingDensityEffect':rates,'hotspotComparisons':hotspots,'instructionRegionComparisons':instructionComparisons,'unprofiledVariability':noise,'exampleCaptureQuality':quality,'finalEmptyCallerEvidence':paths,'notes':['TV is the sum of absolute share differences divided by two, expressed in percentage points. Physical symbol containment aligns native PMI IP and raw-stack leaves.','CPU Profiler may export debug inline frames; Time Profiler weights periodic time, whereas PMIs weight cycle periods. Small rank differences do not establish contradictions.','All intervals are paired block log-ratio t intervals. Five repetitions give limited precision; desktop drift and correlated noise remain possible.']}
    (DATA/'benchmarks.json').write_text(json.dumps(bench,separators=(',',':'))+'\n');(DATA/'manifest.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
    (DATA/'analysis.json').write_text(json.dumps(analysis,separators=(',',':'))+'\n')
    print('CURRENT ENGINE: baseline variability / overhead / incremental stacks')
    for work in reg['workloads']:
        wid=work['id'];print('\n',wid)
        for g in bench['groups']:
            if g['workloadId']==wid and g['buildId']=='after':print(g['mode'],round(g['wall']['median'],4),{k:round(g['wallEffect'][k],3) for k in ['percent','low','high']} if 'wallEffect' in g else 'plain')
        print('stack increment',[(x['period'],{k:round(x['wall'][k],3) for k in ['percent','low','high']}) for x in increments if x['workload']==wid and x['build']=='after'])
    print('runtime comparisons',bench['comparisons']);print('caller evidence',paths)
if __name__=='__main__':main()
