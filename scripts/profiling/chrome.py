"""Bounded actual Chrome Wasm worker CPU profiles. Run AFTER native collection.

This is software stack sampling, independently configured through V8/CDP, not
Apple hardware instruction sampling. No native/Wasm speedup is inferred here.
"""
import os
import fcntl,hashlib,json,re,subprocess,sys,tempfile,time
from pathlib import Path
from playwright.sync_api import sync_playwright
import measure as measurement
ROOT=Path(__file__).resolve().parents[2];OUT=(ROOT/os.environ.get('REVERSI_PROFILE_RUN','.local-research/profiling-m4-20261030')).resolve();DEST=ROOT/'docs/data/profiling'
def write(p,d):p.write_text(json.dumps(d,separators=(',',':'))+'\n')
def wasm_build():
    source=(ROOT/'src/wasm/manifest.js').read_text().split('export default ',1)[1].strip().removesuffix(';')
    manifest=json.loads(source)
    return {k:manifest[k] for k in ['abi','fingerprint','version','flags','sourceHashes','modelHeaderSha256','models']}
def normalized(raw,ident,work,browser,interval,target):
    nodes={n['id']:n for n in raw['nodes']};parents={child:n['id'] for n in raw['nodes'] for child in n.get('children',[])};frames=[];ids={}
    for n in raw['nodes']:
        f=n['callFrame'];name=f.get('functionName') or '(anonymous)';url=f.get('url','');ids[n['id']]=len(frames);frames.append({'name':name,'symbol':name,'module':url.rsplit('/',1)[-1] if url else 'V8 runtime','address':None,'relativeAddress':None,'unresolved':name in ['(anonymous)','(unresolved function)','(program)'],'source':url,'line':f.get('lineNumber',-1)+1,'functionId':f.get('scriptId'),'wasmCodeOffset':f.get('columnNumber') if url.startswith('wasm:') else None})
    stacks=[];stackIds={};samples=[];timestamp=0;deltas=raw.get('timeDeltas',[]);assert len(deltas)==len(raw.get('samples',[]))
    for nid,delta in zip(raw.get('samples',[]),deltas):
        timestamp+=delta;path=[];seen=set();current=nid
        while current is not None:
            assert current not in seen,'Malformed CDP parent cycle';seen.add(current);path.append(ids[current]);current=parents.get(current)
        path.reverse();key=tuple(path)
        if key not in stackIds:stackIds[key]=len(stacks);stacks.append(path)
        samples.append([timestamp*1000,stackIds[key],1,'not reported',None,target['targetId']])
    unresolved=sum(1 for s in samples if not stacks[s[1]] or frames[stacks[s[1]][-1]]['unresolved'])
    return {'version':1,'id':ident,'kind':'stacks','workloadId':work['id'],'workloadFingerprint':hashlib.sha256(json.dumps(work,sort_keys=True).encode()).hexdigest(),'buildId':'after','method':'chrome-v8-software-stacks','event':{'name':'V8 CPU software samples','unit':'samples','trigger':'V8 periodic software sampler','requestedIntervalUs':interval,'weightSemantics':'One per actual sample; original timeDeltas retained in local cpuprofile. No CPU-cycle event requested.'},'configuration':{'browser':browser,'worker':target['url'],'targetId':target['targetId'],'requestedIntervalUs':interval,'coreAttribution':None},'timestamps':{'provenance':'CDP Profile.startTime plus cumulative actual timeDeltas (microseconds), converted to nanoseconds. Includes worker dispatch/idle in the profiler interval, not native signpost scope.','originTraceNs':raw['startTime']*1000,'endTraceNs':raw['endTime']*1000},'frames':frames,'stacks':stacks,'samples':samples,'accounting':{'samples':len(samples),'weight':len(samples),'unresolvedWeight':unresolved,'unresolvedSamples':unresolved,'lost':None,'discarded':0,'malformed':0},'capture':{'rawSha256':hashlib.sha256(json.dumps(raw,separators=(',',':')).encode()).hexdigest(),'wasmBuild':wasm_build(),'wasmManifestSha256':hashlib.sha256((ROOT/'src/wasm/manifest.js').read_bytes()).hexdigest(),'workerSourceSha256':hashlib.sha256((ROOT/'profiling/capture-worker.js').read_bytes()).hexdigest(),'productionWasmArtifacts':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in (ROOT/'src/wasm').iterdir() if f.suffix in ['.wasm','.mjs']},'nativeInstructionAddresses':False,'coreAttribution':None,'scope':'Actual production Wasm in a dedicated Chrome worker. Includes dispatch/idle. Unprofiled checks are supplementary single runs, not an overhead confidence interval.','sampleColumns':['timeNs','stackId','weight','core','rawCumulativeCounter','threadId']}}
def main():
    with (OUT/'measurement.lock').open('a') as lock:
        assert not list(OUT.glob('wasm-*-after-cdp-*.cpuprofile')),'Existing Chrome captures require review; use a fresh run directory instead of overwriting evidence.'
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);start=time.monotonic();write(OUT/'chrome-resources-before.json',measurement.resources.check());reg=json.loads((OUT/'registration.json').read_text());budget=json.loads((OUT/'budget.json').read_text());assert budget['activeMeasurementSeconds']<5250
        cases=[]
        for source,op in [('evaluate-P','static'),('exact-P','search')]:
            w=next(w for w in reg['workloads'] if w['id']==source);cases.append({**w,'id':'wasm-'+source,'op':op,'n':10000000,'repeats':w['repeats'] if 'repeats' in w else 1})
        results=[];profiles=[]
        with tempfile.TemporaryDirectory() as temp:
            server=subprocess.Popen([sys.executable,str(ROOT/'launch.py'),'--no-browser','--port','0','--http-log',str(Path(temp)/'http.log')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
            try:
                url=re.search(r'http://127\.0\.0\.1:\d+/',server.stdout.readline()).group()
                with sync_playwright() as pw:
                    browser=pw.chromium.launch(channel='chrome');page=browser.new_page();page.goto(url+'profiling/capture-worker.html');page.wait_for_function('()=>typeof measure==="function"');measure=lambda op,**a:page.evaluate('([op,a])=>measure(op,a)',[op,a]);measure('init')
                    cdp=browser.new_browser_cdp_session();target=next(t for t in cdp.send('Target.getTargets')['targetInfos'] if t['type']=='worker' and t['url'].endswith('capture-worker.js'));sid=cdp.send('Target.attachToTarget',{'targetId':target['targetId'],'flatten':False})['sessionId'];replies={};seq=0
                    def receive(e):
                        if e['sessionId']==sid:
                            msg=json.loads(e['message'])
                            if 'id' in msg:replies[msg['id']]=msg
                    cdp.on('Target.receivedMessageFromTarget',receive)
                    def rpc(method,params=None):
                        nonlocal seq
                        seq+=1;call=seq;cdp.send('Target.sendMessageToTarget',{'sessionId':sid,'message':json.dumps({'id':call,'method':method,'params':params or {}})});deadline=time.monotonic()+10
                        while call not in replies:
                            assert time.monotonic()<deadline;page.wait_for_timeout(10)
                        msg=replies.pop(call);assert 'error' not in msg,msg;return msg.get('result',{})
                    rpc('Profiler.enable')
                    for work in cases:
                        args={'p':work['position'],'depth':work['depth'],'model':work['model'],'repeats':work['repeats'],'n':work['n']}
                        measure(work['op'],**{**args,'repeats':3,'n':10000});control=measure(work['op'],**args)
                        for interval in [1000,100]:
                            assert time.monotonic()-start<100,'Bounded Chrome capture'
                            rpc('Profiler.setSamplingInterval',{'interval':interval});rpc('Profiler.start');result=measure(work['op'],**args);raw=rpc('Profiler.stop')['profile'];ident=f'{work["id"]}-after-cdp-{interval}';write(OUT/(ident+'.cpuprofile'),raw);p=normalized(raw,ident,work,browser.version,interval,target);write(DEST/(ident+'.json'),p);profiles.append({'id':ident,'file':ident+'.json','workloadId':work['id'],'buildId':'after','kind':'stacks','mode':'cdp-'+str(interval),'method':p['method'],'event':p['event'],'samples':len(p['samples']),'label':f'Chrome V8 {interval} µs · {len(p["samples"])} samples'});results.append({'workload':work,'intervalUs':interval,'unprofiledBefore':control,'profiled':result,'actualSamples':len(p['samples']),'browser':browser.version});print(ident,len(p['samples']),flush=True)
                        after=measure(work['op'],**args)
                        for row in results:
                            if row['workload']['id']==work['id']:row['unprofiledAfter']=after;assert row['profiled']['checksum']==control['checksum']==after['checksum']
                    browser.close()
            finally:server.terminate();server.communicate(timeout=5)
        write(OUT/'chrome-resources-after.json',measurement.resources.snapshot());elapsed=time.monotonic()-start;budget['activeMeasurementSeconds']+=elapsed;write(OUT/'budget.json',budget);write(DEST/'chrome-summary.json',{'results':results,'activeSeconds':elapsed,'note':'Separate software stack sampling. No paired statistical overhead claim from these single captures.'});manifest=json.loads((DEST/'manifest.json').read_text());manifest['profiles']+=profiles;manifest['workloads']+=cases;write(DEST/'manifest.json',manifest)
if __name__=='__main__':main()
