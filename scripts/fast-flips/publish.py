"""Publish compact, auditable derivatives; never copy binaries/raw traces."""
import collections,hashlib,json,math,os,shutil,statistics,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=(ROOT/os.environ.get('REVERSI_FLIP_RUN','.local-research/fast-flips-m4-20261031')).resolve();DEST=ROOT/'docs/data/fast-flips-mac'
def load(name):return json.loads((OUT/name).read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(name,value):
    DEST.mkdir(parents=True,exist_ok=True);(DEST/name).write_text(json.dumps(value,separators=(',',':'))+'\n')
def signature(roots):return [{k:v for k,v in r.items() if k!='elapsedMs'} for r in roots]
def compact(data):
    roots={};rows=[]
    for row in data['rows']:
        w=next(w for w in data['workloads'] if w['id']==row['workload']);n=len(w['positionIds']);results={}
        for tag,r in row['results'].items():
            sig=signature(r['roots']);assert sig==signature(row['results']['original']['roots'])
            if w['id'] not in roots:roots[w['id']]=sig[:n]
            results[tag]={k:v for k,v in r.items() if k!='roots'}
            results[tag]['fullRootSignatureSha256']=hashlib.sha256(json.dumps(sig,sort_keys=True,separators=(',',':')).encode()).hexdigest()
            results[tag]['meanPerRootElapsedMs']=[statistics.mean(r['roots'][i]['elapsedMs'] for i in range(j,len(r['roots']),n)) for j in range(n)]
        rows.append({**{k:v for k,v in row.items() if k!='results'},'results':results})
    return {**{k:v for k,v in data.items() if k not in ['rows']},'rootReferences':roots,'rows':rows,'compaction':'Every fixed score/counter signature compared before compaction; one reference batch per workload plus complete batch clocks/counters, mean API elapsed per root and full signature hashes. Timed roots retained.'}
def profile_data(names):
    captures=[]
    for name in names:
        d=load(name)
        for c in d['captures']:
            p=load(c['id']+'.normalized.json');ips=collections.Counter();contexts=collections.Counter()
            for s in p['samples']:
                stack=[s[1]] if p['kind']=='ip' else p['stacks'][s[1]]
                if not stack:continue
                f=p['frames'][stack[-1]]
                if 'flips(' not in f.get('containingSymbol',''):continue
                ips[stack[-1]]+=s[2]
                if p['kind']=='stacks':contexts[tuple((p['frames'][i].get('name') or p['frames'][i].get('containingSymbol','unresolved')) for i in stack)]+=s[2]
            lines={};instructions=[];symbol=None
            for k,v in ips.most_common():
                f=p['frames'][k];key=f"{f.get('source','unknown')}:{f.get('line',0)}"
                if f.get('sourceText'):lines[key]=f['sourceText']
                symbol={key:f.get(key) for key in ['module','start','end','containingSymbol']}
                instructions.append({'relativeAddress':f.get('relativeAddress'),'assembly':f.get('assembly'),'sourceLine':key,'weight':v})
            stats={k:v for k,v in c.items() if k!='topFlipInstructions'}
            captures.append({**stats,'sourceCommit':p['capture']['sourceCommit'],'buildFingerprint':p['capture']['buildFingerprint'],'event':p['event'],'configuration':p['configuration'],'accounting':p['accounting'],'flipSymbol':symbol,'sourceLines':lines,'sampledFlipInstructions':instructions,'genuineFlipCallerContexts':[{'frames':list(k),'weight':v} for k,v in contexts.most_common()],'contextMeaning':'Actual decoded raw stacks or CPU Profiler export stacks. Missing ancestors are not guessed. IP captures have no caller contexts.'})
    return {'captures':captures,'limitations':['Configured CORE_ACTIVE_CYCLE PMI weights, not precise instruction latencies or wall-time weights.','Skid, finite samples and hybrid-core scheduling limit fine address attribution.','Lost counts unavailable, retained as null. No branch-misprediction/cache-miss event sampled.','Single captures per condition describe locations; repeated unprofiled complete work determines speed.']}
def main():
    assert os.uname().sysname=='Darwin' and os.uname().machine=='arm64','This publisher is Mac phase only'
    initial=load('integrated.json');final=load('integrated-final.json');micro=load('micro-refined.json');summary=load('summary-final.json');builds=load('builds.json')
    assert summary['qualification']['passed'];assert load('refined-sanitize.json')['passed'];assert load('wasm-qualification.json')['passed'];assert load('browser-qualification.json')['passed']
    code=ROOT/'native/engine.cpp';assert sha(code)==builds['builds']['refined']['sourceHashes']['engine.cpp']
    save('initial-search.json',compact(initial));save('final-search.json',compact(final));save('micro.json',micro);save('summary.json',summary)
    save('initial-summary.json',load('initial-summary.json'));save('profiles.json',profile_data(['profile-analysis.json','profile-analysis-final.json']))
    tests=load('test-receipt.json');tests['rows']=[{k:v for k,v in r.items() if k!='summary'} for r in tests['rows']]
    save('qualification.json',{'initial':load('initial-qualification.json'),'cleanup':json.loads((OUT/'selected-qualify.log').read_text()),'final':load('qualification.json'),'initialSanitizers':load('initial-sanitize.json'),'finalSanitizers':load('refined-sanitize.json'),'wasm':load('wasm-qualification.json'),'timedPublications':load('timed-qualification.json'),'tests':tests})
    browser=load('browser-qualification.json');batches={}
    for row in browser['rows']:
        for result in row['results'].values():
            roots=result.pop('roots');key=hashlib.sha256(json.dumps(roots,sort_keys=True,separators=(',',':')).encode()).hexdigest();batches[key]=roots;result['rootBatchSha256']=key
    browser['rootBatches']=batches;browser['compaction']='Identical complete root/PV/counter batches are deduplicated by canonical SHA-256; every elapsed block retained.';save('browser.json',browser)
    save('diagnostic.json',{'baseline':load('diagnostic.json'),'cleanup':load('diagnostic-selected.json'),'final':load('diagnostic-refined.json'),'mechanism':'Separate call counters and one-in-97 input sampling by empty count, no per-call timers; never used for performance.'})
    assert load('diagnostic.json')==load('diagnostic-refined.json')
    shutil.copy2(OUT/'positions.json',DEST/'positions.json');shutil.copy2(OUT/'search-cases.txt',DEST/'search-cases.txt')
    manifest={'baselineCommit':builds['baseline'],'kernelSourceCommit':builds['experimentCommit'],'finalNativeSourceCommit':builds['builds']['refined']['commit'],'sourceHashes':{f:sha(ROOT/f) for f in ['native/engine.cpp','native/engine.hpp','native/main.cpp','native/browser.cpp']},'models':builds['builds']['refined']['models'],'modelHeaderSha256':builds['modelHeaderSha256'],'compiler':builds['compiler'],'flags':builds['flags'],'platform':subprocess.check_output(['uname','-a'],text=True).strip(),'software':{'python':subprocess.check_output([os.sys.executable,'--version'],text=True).strip(),'node':subprocess.check_output(['node','--version'],text=True).strip(),'xctrace':subprocess.check_output(['xcrun','xctrace','version'],text=True).strip()},'workloadSha256':sha(DEST/'positions.json'),'searchCasesSha256':sha(DEST/'search-cases.txt'),'microCorpus':micro['corpus'],'harnessSourceSha256':{str(p.relative_to(ROOT)):sha(p) for p in (ROOT/'scripts/fast-flips').glob('*') if p.is_file()},'measuredBinaries':{str(p.relative_to(OUT)):sha(p) for p in OUT.glob('*/fixed-work')},'measuredMicroBinarySha256':sha(OUT/'micro-refined'),'wasm':load('wasm-selected/manifest.json'),'builds':builds,'productionWasmAssets':'Unchanged. Experimental Wasm compiled/qualified in ignored storage only.'}
    manifest['collectorSourceSha256']={f:sha(ROOT/f) for f in ['scripts/profiling/hardware.instrpkg','scripts/profiling/package.py','scripts/profiling/measure.py','scripts/profiling/normalize.py']}
    manifest['software']['macOS']=subprocess.check_output(['sw_vers'],text=True).strip()
    manifest['reconstructionSmoke']=load('reconstruction-receipt.json')
    save('manifest.json',manifest);save('resources.json',{'budget':load('budget.json'),'initial':load('resources-before.json'),'final':load('resources-after.json'),'periodic':[json.loads(x) for x in (OUT/'integrated-resources.jsonl').read_text().splitlines()]})
    print(json.dumps({'published':str(DEST),'bytes':sum(p.stat().st_size for p in DEST.iterdir() if p.is_file()),'sourceCommit':manifest['finalNativeSourceCommit'],'activeMeasurementSeconds':load('budget.json')['activeSeconds']}))
if __name__=='__main__':main()
