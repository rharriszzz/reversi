"""Offline export, symbolization and compact presentation records.

Run only after timed measurements finish. All raw exports remain ignored.
No target is launched. IP records never become caller chains; raw stacks use
captured PC/return addresses. Debug inline attribution is separate metadata.
"""
import os
import argparse,bisect,collections,hashlib,json,math,re,statistics,subprocess,time,resource
import xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=(ROOT/os.environ.get('REVERSI_PROFILE_RUN','.local-research/profiling-m4-20261030')).resolve();DEST=ROOT/'docs/data/profiling'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,value,pretty=False):
    p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(value,indent=2 if pretty else None,separators=None if pretty else (',',':'))+'\n')
POSTPROCESS=[]
def invoke(cmd):
    start=time.monotonic();before=resource.getrusage(resource.RUSAGE_CHILDREN);r=subprocess.run(cmd,capture_output=True,text=True);elapsed=time.monotonic()-start
    after=resource.getrusage(resource.RUSAGE_CHILDREN);POSTPROCESS.append({'tool':Path(cmd[0]).name if cmd[0]!='xcrun' else cmd[1],'wallSeconds':elapsed,'childrenCpuSeconds':after.ru_utime+after.ru_stime-before.ru_utime-before.ru_stime})
    if r.returncode:raise RuntimeError(r.stderr or r.stdout)
    return r.stdout,elapsed
class XML:
    def __init__(self,path):
        self.path=path;self.root=ET.parse(path).getroot();self.ids={};self.scopes={};self.ambiguous=set()
        for node in self.root.findall('node') or [self.root]:
            scope={}
            for e in node.iter():
                if e.get('id'):
                    key=e.get('id')
                    if key in scope:raise ValueError('Duplicate XML ID within one result node')
                    scope[key]=e
                    if key in self.ids:self.ambiguous.add(key)
                    self.ids[key]=e
            for e in node.iter():self.scopes[id(e)]=scope
    def resolve(self,e):
        if e is None:return None
        if e.get('ref'):
            key=e.get('ref');scope=self.scopes.get(id(e),{})
            if key in scope:return scope[key]
            if key not in self.ids or key in self.ambiguous:raise ValueError('Unresolved XML reference '+key)
            return self.ids[key]
        return e
    def text(self,e,default=''):
        e=self.resolve(e);return (e.text or default) if e is not None and e.tag!='sentinel' else default
    def integer(self,e):return int(self.text(e))
    def rows(self,schema):
        fallback=self.root.find('node/schema')
        for n in self.root.findall('node'):
            s=n.find('schema')
            if s is None:s=fallback
            if s is None or s.get('name')!=schema:continue
            columns=[c.findtext('mnemonic') for c in s.findall('col')]
            for row in n.findall('row'):
                if len(row)!=len(columns):raise ValueError('Malformed exported row width')
                yield dict(zip(columns,list(row)))
class MultiXML(XML):
    def __init__(self,documents):
        self.documents=documents;self.path=documents[0].path;self.root=ET.Element('trace-query-result');self.owners={}
        for document in documents:
            self.root.extend(document.root.findall('node'))
            for element in document.root.iter():self.owners[id(element)]=document
    def resolve(self,element):
        if element is None:return None
        return self.owners[id(element)].resolve(element)
    def rows(self,schema):
        for document in self.documents:yield from document.rows(schema)
def export(trace,schemas):
    # xctrace multi-schema queries omit subsequent schema headers. Export each
    # table schema separately, retaining its own reference-ID namespace.
    if len(schemas)>1:
        documents=[];cost=0
        for schema in schemas:
            document,elapsed=export(trace,[schema]);documents.append(document);cost+=elapsed
        return MultiXML(documents),cost
    target=OUT/'exports'/(trace.stem+'-'+('-'.join(schemas))+'.xml');target.parent.mkdir(exist_ok=True)
    cost=0
    if not target.exists():
        predicate=' or '.join(f'@schema="{s}"' for s in schemas)
        _,cost=invoke(['xcrun','xctrace','export','--input',str(trace),'--xpath',f'/trace-toc/run[@number="1"]/data/table[{predicate}]','--output',str(target)])
    result=XML(target)
    if schemas[0] in ['pmi-sample','cpu-profile','time-profile'] and len(result.root.findall('node'))!=1:raise ValueError('Multiple sample tables require explicit configuration selection')
    return result,cost
class Symbols:
    def __init__(self,build):
        self.build=build;self.exe=Path(build['executable']);self.directory=self.exe.parent
        raw,_=invoke(['nm','-n',str(self.exe)]);entries=[];header=None
        for line in raw.splitlines():
            m=re.match(r'^([0-9a-fA-F]+)\s+([A-Za-z])\s+(.*)$',line)
            if not m:continue
            a,t,n=m.groups();a=int(a,16)
            if n=='__mh_execute_header':header=a
            if t in 'Tt':entries.append((a,n[1:] if n.startswith('_') else n))
        assert header is not None,'Missing Mach-O header symbol';self.header=header
        # The final function ends at the real __text section boundary.
        load,_=invoke(['otool','-l',str(self.exe)]);m=re.search(r'sectname __text\s+segname __TEXT\s+addr (0x[0-9a-f]+)\s+size (0x[0-9a-f]+)',load);assert m
        self.textStart=int(m[1],16);self.textEnd=self.textStart+int(m[2],16)
        entries=sorted(dict(entries).items());entries=[(a,n) for a,n in entries if self.textStart<=a<self.textEnd]
        names=subprocess.run(['c++filt','-n'],input='\n'.join(n for _,n in entries)+'\n',text=True,capture_output=True,check=True).stdout.splitlines();assert len(names)==len(entries)
        self.symbols=[(a,(entries[i+1][0] if i+1<len(entries) else self.textEnd),names[i]) for i,(a,_) in enumerate(entries)];self.starts=[x[0] for x in self.symbols]
        disasm,_=invoke(['otool','-tvV',str(self.exe)]);self.assembly={int(m[1],16):m[2] for line in disasm.splitlines() if (m:=re.match(r'^([0-9a-fA-F]{16})\s+(.*)$',line))}
        self.sources={'engine.cpp':(self.directory/'engine.cpp').read_text().splitlines(),'driver.cpp':(ROOT/'scripts/profiling/driver.cpp').read_text().splitlines()}
    def frame(self,pc,load,name=None,inlined=False):
        static=pc-load+self.header;i=bisect.bisect_right(self.starts,static)-1
        f={'name':name or hex(pc),'module':'Unresolved outside main image','address':hex(pc),'relativeAddress':None,'unresolved':True,'inlined':inlined}
        if i>=0 and self.symbols[i][0]<=static<self.symbols[i][1]:
            start,end,symbol=self.symbols[i]
            knownName=name if name and not name.startswith(('0x','<')) else symbol
            if name and name!=knownName:f['exportedName']=name
            f.update(name=knownName,symbol=knownName,module='fixed-work',relativeAddress=hex(pc-load),start=hex(start-self.header),end=hex(end-self.header),containingSymbol=symbol,unresolved=False)
            if static in self.assembly:f['assembly']=hex(static-self.header)+'  '+self.assembly[static]
        return f
    def enrich(self,frames,load):
        selected=[(i,f) for i,f in enumerate(frames) if not f['unresolved'] and f['module']=='fixed-work' and f.get('relativeAddress')]
        if not selected:return 0
        ips=OUT/'atos-input.txt';ips.write_text(''.join(f['address']+'\n' for _,f in selected))
        text,cost=invoke(['atos','-arch','arm64','-o',str(self.exe),'-l',hex(load),'-f',str(ips)])
        lines=text.splitlines();assert len(lines)==len(selected),'Unexpected atos output shape'
        for (_,f),line in zip(selected,lines):
            m=re.search(r'\((engine\.cpp|driver\.cpp):(\d+)\)',line)
            if m and int(m[2])>0:
                file,lineno=m[1],int(m[2]);f['source']='native/engine.cpp' if file=='engine.cpp' else 'scripts/profiling/driver.cpp';f['line']=lineno;f['debugAttribution']=line.split(' (in ')[0]
                if lineno<=len(self.sources[file]):f['sourceText']=self.sources[file][lineno-1]
        return cost

def marker_range(xml):
    markers=[]
    for r in xml.rows('os-signpost'):
        if xml.text(r['name'])=='FixedWork':markers.append((xml.text(r['event-type']),xml.integer(r['time'])))
    # Shipped templates request overlapping os-signpost tables. The same
    # boundary event can be returned twice; deduplicate exact type/time only.
    markers=set(markers)
    begins=[t for k,t in markers if k=='Begin'];ends=[t for k,t in markers if k=='End']
    if len(begins)!=1 or len(ends)!=1 or ends[0]<=begins[0]:raise ValueError('Missing/ambiguous fixed-work signposts')
    return begins[0],ends[0]

def parse_capture(row,reg,symbols=None,publish=False):
    mode=row['mode'];raw=mode.startswith(('ip-','stacks-'));schema='pmi-sample' if raw else 'cpu-profile' if mode.startswith('cpu-') else 'time-profile'
    trace=Path(row['raw']);rawBytes=sum(p.stat().st_size for p in trace.rglob('*') if p.is_file());xml,cost=export(trace,[schema,'os-signpost',*(['dyld-library-load'] if publish else [])]);start,end=marker_range(xml)
    assert abs((end-start)/1e9-row['result']['wallSeconds'])<.02,'Marker and fixed-work clock disagreement'
    modules=[]
    for module in xml.rows('dyld-library-load'):
        modules.append({'path':xml.text(module['path']) or xml.resolve(module['path']).get('fmt',''),'uuid':xml.text(module['uuid']) or xml.resolve(module['uuid']).get('fmt',''),'loadAddressRaw':xml.text(module['load-address']),'loadAddressFormatted':xml.resolve(module['load-address']).get('fmt'),'type':xml.text(module['type'])})
    weightType=None
    if not raw:
        schemaNode=next(node.find('schema') for node in xml.root.findall('node') if node.find('schema') is not None and node.find('schema').get('name')==schema)
        weightType=next(c.findtext('engineering-type') for c in schemaNode.findall('col') if c.findtext('mnemonic')=='weight')
        assert weightType==('cycle-weight' if mode.startswith('cpu-') else 'weight'),'Collector weight schema changed; requalify units before publication'
    period=int(mode.rsplit('-',1)[-1]) if raw else None
    frames=[];frameIds={};stacks=[];stackIds={};samples=[];outside=0;kernel=0;empty=0;zeroFrames=0;depths=[];flags=collections.Counter();hardwarePcMismatches=0;cores=collections.Counter();events=collections.Counter();allCount=0;load=int(row['result']['loadAddress'],16)
    def frame(pc,name=None,inlined=False,module=None,source=None):
        key=(pc,name,inlined,module)
        if key not in frameIds:
            if symbols:
                f=symbols.frame(pc,load,name,inlined)
                if module and module!='fixed-work':f.update(module=module,name=name or hex(pc),unresolved=not name or name.startswith(('0x','<')))
                if source:f.update(source)
            else:f={'name':name or hex(pc),'symbol':name,'module':module or ('fixed-work' if load<=pc<load+16*2**20 else 'Unresolved'),'address':hex(pc),'unresolved':False}
            frameIds[key]=len(frames);frames.append(f)
        return frameIds[key]
    def stack(ids):
        key=tuple(ids)
        if key not in stackIds:stackIds[key]=len(stacks);stacks.append(ids)
        return stackIds[key]
    for r in xml.rows(schema):
        allCount+=1;t=xml.integer(r['time'])
        if raw and mode.startswith('ip-'):
            # Qualification checks all rows, including startup and warmup.
            assert xml.resolve(r['cp-user-callstack']).tag=='sentinel','IP capture contains collected user stacks'
            assert xml.resolve(r['cp-kernel-callstack']).tag=='sentinel','IP capture contains collected kernel stacks'
        if not start<=t<=end:outside+=1;continue
        state=xml.resolve(r.get('thread-state'))
        if state is not None and state.get('fmt') not in [None,'Running']:kernel+=1;continue
        core=xml.resolve(r.get('core-index',r.get('core')));coreName=core.get('fmt','Unknown') if core is not None else 'Unknown';cores[coreName]+=1
        thread=xml.resolve(r['thread']);tid=xml.text(thread.find('tid')) if thread is not None else 'Unknown'
        cumulative=None;rawRegisters=None
        if raw:
            pc=xml.integer(r['program-counter']);cumulative=xml.integer(r['pmi-count']);events[xml.text(r['sampled-counter'])]+=1;weight=period
            if mode.startswith('ip-'):location=frame(pc)
            else:
                bt=xml.resolve(r['cp-user-callstack']);ids=[]
                if bt.tag!='sentinel':
                    rawRegisters=[hex(xml.integer(value)) for value in bt.findall('register-content')]
                    pcElement=bt.find('text-address');addresses=bt.find('text-addresses');values=[int(x) for x in xml.text(addresses).split()]
                    if pcElement is not None:
                        stackPc=xml.integer(pcElement);hardwarePcMismatches+=stackPc!=pc;ids.append(frame(stackPc))
                    for index,addr in enumerate(values):
                        if addr:ids.append(frame(addr))
                        else:
                            if any(values[index+1:]):raise ValueError('Nonterminal zero in raw unwind requires review; do not fabricate a caller link across it')
                            zeroFrames+=len(values)-index;break
                    b=bt.find('boolean');flags[xml.text(b,'unreported')]+=1
                # Input leaf-first; normalized stacks are root-first.
                ids.reverse();location=stack(ids);depths.append(len(ids));empty+=not ids
        else:
            weight=xml.integer(r['weight']);bt=xml.resolve(r['stack']);ids=[]
            if bt.tag!='sentinel':
                for elem in bt.findall('frame'):
                    f=xml.resolve(elem);pc=int(f.get('addr'),16);binary=xml.resolve(f.find('binary'));module=binary.get('name') if binary is not None else None
                    source=xml.resolve(f.find('source'));extra={}
                    if source is not None:
                        line=int(source.get('line','0'));path=xml.text(source.find('path'));extra={'source':('native/engine.cpp' if path.endswith('engine.cpp') else path.rsplit('/',1)[-1]),'line':line}
                    ids.append(frame(pc,f.get('name'),f.get('inlined')=='true',module,extra))
            ids.reverse();location=stack(ids);depths.append(len(ids));empty+=not ids
        samples.append([t-start,location,weight,coreName,str(cumulative) if cumulative is not None else None,tid,hex(xml.integer(r['program-counter'])) if raw else None,rawRegisters])
    samples.sort(key=lambda s:s[0]);kind='ip' if mode.startswith('ip-') else 'stacks'
    cycle=raw or mode.startswith('cpu-');event={'name':'CORE_ACTIVE_CYCLE' if raw else 'CPU Profiler cycles' if cycle else 'Periodic running-thread time','unit':'cycles' if cycle else 'nanoseconds','trigger':'PMU overflow' if cycle else 'periodic timer','period':period,'frequencySetting':None if raw else 'High' if mode.endswith('high') else 'Normal','exportedWeightType':weightType,'weightSemantics':'Configured cycles per PMI; cumulative raw counter values retained separately, never summed as sample weights.' if raw else 'Exported Instruments weight, retained per record.'}
    deltas=[];lastByThread={}
    for sample in samples:
        if sample[5] in lastByThread:deltas.append(sample[0]-lastByThread[sample[5]])
        lastByThread[sample[5]]=sample[0]
    functionWeights=collections.Counter();unresolved=0;unresolvedCount=0
    for sample in samples:
        fid=sample[1] if kind=='ip' else stacks[sample[1]][-1] if stacks[sample[1]] else None
        f=frames[fid] if fid is not None else None
        key=(f.get('containingSymbol') or f.get('symbol') or f['name']) if f and not f['unresolved'] else '(unresolved leaf)'
        functionWeights[key]+=sample[2]
        if not f or f['unresolved']:unresolved+=sample[2];unresolvedCount+=1
    summary={'id':row['id'],'workloadId':row['workload'],'buildId':row['tag'],'mode':mode,'kind':kind,'event':event,'totalCapturedRows':allCount,'weightStatistics':{'min':min((s[2] for s in samples),default=0),'median':statistics.median([s[2] for s in samples]) if samples else 0,'max':max((s[2] for s in samples),default=0)},'interSampleNs':{'median':statistics.median(deltas) if deltas else None,'mean':statistics.mean(deltas) if deltas else None,'max':max(deltas,default=None)},'samples':len(samples),'weight':sum(s[2] for s in samples),'outsideWorkInterval':outside,'discardedNonRunning':kernel,'lost':None,'lostStatus':'Not exposed by this export; absence of warnings does not establish zero loss.','cores':dict(cores),'counterIds':dict(events),'hardwarePcVsStackPcMismatches':hardwarePcMismatches,'rawBytes':rawBytes,'functionWeights':dict(functionWeights),'unresolvedWeight':unresolved,'unresolvedSamples':unresolvedCount,'exportSeconds':cost,'xmlSha256':digest(xml.path),'exportXmlHashes':{d.path.name:digest(d.path) for d in (xml.documents if isinstance(xml,MultiXML) else [xml])},'depth':{'min':min(depths,default=0),'median':statistics.median(depths) if depths else 0,'max':max(depths,default=0),'empty':empty,'zeroTerminatorFrames':zeroFrames,'rawBooleanFlags':dict(flags)} if kind=='stacks' else None}
    if not publish:return summary,None
    toc=OUT/'exports'/(trace.stem+'-toc.xml')
    if not toc.exists():invoke(['xcrun','xctrace','export','--input',str(trace),'--toc','--output',str(toc)])
    requests=[dict(t.attrib) for t in ET.parse(toc).findall('.//table') if 'swift-table' not in t.attrib]
    if mode.startswith('ip-'):
        assert not any(t.get('callstack','').strip() for t in requests),'Hidden stack collection disqualifies IP mode'
        pmis=[t for t in requests if t.get('schema')=='pmi-sample'];assert len(pmis)==1
        assert pmis[0].get('pmi-event')=='\"CORE_ACTIVE_CYCLE\"' and pmis[0].get('pmi-threshold')==str(period)
        config=[t for t in requests if t.get('schema')=='kdebug-counters-with-time-sample'];assert any('CORE_ACTIVE_CYCLE' in t.get('pmc-events','') for t in config)
    if mode.startswith('time-'):
        intervals={int(t['sample-rate-micro-seconds']) for t in requests if t.get('schema')=='time-sample' and t.get('sample-rate-micro-seconds')}
        if len(intervals)==1:event['period']=next(iter(intervals))*1000;event['periodProvenance']='Exported time-sample table requirement, nanoseconds'
    summary['collectionRequests']=requests
    summary['tocSha256']=digest(toc)
    assert symbols is not None;cost=symbols.enrich(frames,load)
    unresolved=0;unresolvedCount=0
    for s in samples:
        fid=s[1] if kind=='ip' else stacks[s[1]][-1] if stacks[s[1]] else None
        if fid is None or frames[fid]['unresolved']:unresolved+=s[2];unresolvedCount+=1
    workload=next(w for w in reg['workloads'] if w['id']==row['workload']);wf=hashlib.sha256(json.dumps({k:workload[k] for k in ['mode','position','depth','model','repeats']},sort_keys=True).encode()).hexdigest()
    profile={'version':1,'id':row['id'],'kind':kind,'workloadId':row['workload'],'workloadFingerprint':wf,'buildId':row['tag'],'method':'hardware-ip' if kind=='ip' else 'hardware-raw-stacks' if raw else 'cpu-profiler-stacks' if cycle else 'time-profiler-stacks','event':event,'configuration':{'mode':mode,'noPerCallInstrumentation':True,'counterReadIntervalUs':10000 if raw else None,'stackRequirement':[] if kind=='ip' else ['user'],'optionalSoftwareSamplerIntervalUs':0,'loadAddress':hex(load)},'timestamps':{'provenance':'Instruments sample-time nanoseconds relative to captured FixedWork Begin signpost. Markers bracket complete work; no interpolated durations.','originTraceNs':start,'endTraceNs':end},'accounting':{'samples':len(samples),'weight':sum(s[2] for s in samples),'unresolvedWeight':unresolved,'unresolvedSamples':unresolvedCount,'lost':None,'discarded':outside+kernel,'outsideWorkInterval':outside,'discardedNonRunning':kernel,'malformed':0},'modules':modules,'frames':frames,'samples':samples,'capture':{**summary,'symbolizationSeconds':cost,'sourceCommit':reg['builds'][row['tag']]['commit'],'buildFingerprint':reg['builds'][row['tag']]['fingerprint'],'rawPreservedUnder':str(OUT)+'/','sampleColumns':['timeNs','frameId' if kind=='ip' else 'stackId','weight','core','rawCumulativeCounter','threadId','hardwareProgramCounter','rawUnwindFixupRegisters']}}
    if kind=='stacks':profile['stacks']=stacks
    summary['unresolvedWeight']=unresolved;summary['unresolvedSamples']=unresolvedCount
    return summary,profile

def stats(values):
    return {'n':len(values),'mean':statistics.mean(values),'median':statistics.median(values),'min':min(values),'max':max(values),'sd':statistics.stdev(values) if len(values)>1 else 0,'values':values}
def effect(ratios):
    logs=[math.log(x) for x in ratios];m=statistics.mean(logs);t={4:2.776445,6:2.446912}.get(len(logs)-1,2.776445);radius=t*statistics.stdev(logs)/math.sqrt(len(logs)) if len(logs)>1 else math.inf
    return {'percent':100*math.expm1(m),'low':100*math.expm1(m-radius),'high':100*math.expm1(m+radius),'n':len(logs),'method':'Paired block log-ratio mean with Student t interval (95%, descriptive; small sample and drift remain limitations).'}
def benchmark_summary(rows,reg,captures):
    groups=[];lookup={(r['workload'],r['tag'],r['mode'],r['rep']):r for r in rows};cap={c['id']:c for c in captures}
    for w in reg['workloads']:
      for tag in reg['builds']:
        for mode in reg['modes']:
            a=[r for r in rows if (r['workload'],r['tag'],r['mode'])==(w['id'],tag,mode)]
            if not a:continue
            g={'workloadId':w['id'],'buildId':tag,'mode':mode,'wall':stats([r['result']['wallSeconds'] for r in a]),'cpu':stats([r['result']['workloadCpuSeconds'] for r in a]),'processCpu':stats([r['result']['processCpuSeconds'] for r in a]),'outer':stats([r['outerSeconds'] for r in a]),'launcherChildrenCpu':stats([r['launcherChildrenCpuSeconds'] for r in a]),'metrics':a[0]['result']['metrics'],'repeats':w['repeats'],'checksum':a[0]['result']['checksum']}
            g['nodesPerSecond']=g['metrics']['nodes']/g['wall']['median'];g['evaluationsPerSecond']=g['metrics']['evaluations']/g['wall']['median']
            if mode!='plain':
                for field,name in [('wallSeconds','wallEffect'),('workloadCpuSeconds','cpuEffect')]:g[name]=effect([r['result'][field]/lookup[(w['id'],tag,'plain',r['rep'])]['result'][field] for r in a])
                g['traceBytes']=stats([cap[r['id']]['rawBytes'] for r in a]);g['sampleCount']=stats([cap[r['id']]['samples'] for r in a])
            groups.append(g)
    paired=[]
    for w in reg['workloads']:
        paired.append({'workloadId':w['id'],'currentVsPrevious':effect([lookup[(w['id'],'after','plain',i)]['result']['wallSeconds']/lookup[(w['id'],'before','plain',i)]['result']['wallSeconds'] for i in range(7)])})
    return {'version':1,'groups':groups,'comparisons':paired,'trials':rows,'captureStatistics':captures,'registration':reg,'activeBudget':json.loads((OUT/'budget.json').read_text()),'driverIpFields':'Driver ipAttempts/ipSamples/ipFailures refer only to the disabled in-process software sampler. Hardware counts are in captureStatistics.','limitations':['Five profiled trials per mode and seven plain controls. Interleaved blocks reduce drift but do not remove it. Confidence intervals are descriptive.','CPU Profiler and Time Profiler use their shipped templates; their overhead includes those templates’ auxiliary facilities. Minimal PMI packages isolate explicit stack requests.','Launcher child CPU includes the target and reaped descendants plus startup/save work; it excludes persistent system collector daemons. Subtraction is not total collector CPU.','Lost sample counts are unavailable in these exports, not assumed zero.']}

def selected(row):
    # Complete records for a compact, declared subset. All captures get statistics.
    if row['rep']!=0:return False
    if row['tag']=='before':return row['workload']=='exact-P' and row['mode'] in ['ip-1000000','stacks-1000000','cpu-normal']
    return row['mode'] in ['ip-1000000','stacks-1000000'] or (row['workload'] in ['evaluate-B','exact-P'] and row['mode'] in ['ip-10000000','stacks-10000000','cpu-normal','cpu-high','time-normal','time-high'])
def main():
    # Lock shared with measurements: symbolization must never overlap timing.
    import fcntl
    started=time.monotonic();cpuStarted=time.process_time();childrenStarted=resource.getrusage(resource.RUSAGE_CHILDREN)
    with (OUT/'measurement.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        assert json.loads((OUT/'fixed-work-verified.json').read_text())['passed'],'Complete fixed-work verification is required before export'
        reg=json.loads((OUT/'registration.json').read_text());rows=json.loads((OUT/'trials.json').read_text());symbols={t:Symbols(b) for t,b in reg['builds'].items()};captures=[];profiles=[]
        cached=OUT/'capture-statistics.json';cache={x['id']:x for x in json.loads(cached.read_text())} if cached.exists() else {}
        for row in rows:
            if row['mode']=='plain':continue
            publish=selected(row)
            if row['id'] in cache and (not publish or (DEST/(row['id']+'.json')).exists()):
                c=cache[row['id']];p=json.loads((DEST/(row['id']+'.json')).read_text()) if publish else None
            else:
                c,p=parse_capture(row,reg,symbols[row['tag']],publish)
                cache[row['id']]=c;write(cached,list(cache.values()))
                if p:write(DEST/(p['id']+'.json'),p)
            captures.append(c)
            if p:profiles.append({'id':p['id'],'file':p['id']+'.json','workloadId':p['workloadId'],'buildId':p['buildId'],'kind':p['kind'],'mode':row['mode'],'method':p['method'],'event':p['event'],'samples':p['accounting']['samples'],'label':row['mode']+' · '+str(p['accounting']['samples'])+' samples'})
            print(json.dumps({'exported':row['id'],'samples':c['samples'],'published':publish}),flush=True)
        summary=benchmark_summary(rows,reg,captures);write(DEST/'benchmarks.json',summary)
        write(OUT/'postprocessing.json',{'commands':POSTPROCESS,'wallSeconds':time.monotonic()-started,'pythonCpuSeconds':time.process_time()-cpuStarted,'allChildrenCpuSeconds':resource.getrusage(resource.RUSAGE_CHILDREN).ru_utime+resource.getrusage(resource.RUSAGE_CHILDREN).ru_stime-childrenStarted.ru_utime-childrenStarted.ru_stime,'note':'Offline export, symbolization and normalization after collection. Cached commands are not counted again.'},True)
        write(DEST/'manifest.json',{'version':1,'builds':reg['builds'],'workloads':reg['workloads'],'profiles':profiles,'benchmarkFile':'benchmarks.json','scope':'M4 fixed-work captures. Committed profiles retain every accepted sample in selected complete captures. Raw traces and all exports remain local; all captures have compact statistics.'},True)
if __name__=='__main__':main()
