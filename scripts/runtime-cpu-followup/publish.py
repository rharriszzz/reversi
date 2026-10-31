"""Publish compact evidence only after the independently checked campaign."""
import hashlib,json,os,re,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
RUN=Path(os.environ['REVERSI_DISPATCH_RUN']).resolve()
OUT=ROOT/'docs/data/runtime-cpu-followup'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(name):return json.loads((RUN/name).read_text())
def write(name,data):(OUT/name).write_text(json.dumps(data,separators=(',',':'))+'\n')
def main():
    assert not OUT.exists(),'Preserve previously published evidence'
    independent=read('qualification.json');assert independent['passed']
    for name in ['build-qualification.json','sanitizer-qualification.json']:
        assert all(v['passed'] for v in read(name).values())
    for name in ['mailbox-exact.json','timed-qualification.json','interruption-qualification.json','source-rebuild.json']:
        assert read(name)['passed']
    tests=[]
    for row in read('final-tests.json'):
        p=RUN/row['log'];s=p.read_text()
        n=int(re.search(r'ℹ tests (\d+)',s)[1]);passed=int(re.search(r'ℹ pass (\d+)',s)[1]);failed=int(re.search(r'ℹ fail (\d+)',s)[1]);skipped=int(re.search(r'ℹ skipped (\d+)',s)[1])
        assert passed==n and failed==skipped==0,row
        tests.append({**row,'tests':n,'passed':passed,'failed':failed,'skipped':skipped,'logSha256':sha(p)})
    OUT.mkdir()
    builds=read('builds.json')
    for tag,r in builds['records'].items():
        base=tag.removesuffix('P');directory=RUN/base
        r['generatedSourceHashes']={p.name:sha(p) for p in directory.glob('*.cpp')}
        r['testSourceHashes']={p:sha(ROOT/p) for p in ['scripts/fast-flips/driver.cpp','tests/native-internals.cpp','tests/runtime-cpu-state.cpp']}
        r['testResults']={'passed':True,'independent':'qualification.json#independent','completeSearch':'search.json','exact':'qualification.json#exact','timed':'qualification.json#timed','interruption':'qualification.json#interruptions','state':None if base=='N' else 'qualification.json#builds/'+base,'sanitizer':None if base=='N' else 'qualification.json#sanitizers/'+base}
    write('builds.json',builds)
    for source,dest in [('compact-search.json','search.json'),('summary.json','summary.json'),('micro.json','micro.json'),('assembly.json','assembly.json')]:write(dest,read(source))
    sanitizers=read('sanitizer-qualification.json')
    for tag,r in sanitizers.items():
        source=builds['records'][tag]
        r['buildReceipt']={'compiler':source['compiler'],'sourceHashes':source['sourceHashes'],'generatedSourceHashes':source['generatedSourceHashes'],'testSourceHashes':source['testSourceHashes'],'units':{name:flags+r['flags'] for name,flags in source['units'].items()},'driverFlags':source['driverFlags']+r['flags'],'isa':source['isa'],'binaryHashes':r['binaryHashes'],'testResults':r['checks']}
    write('qualification.json',{'tests':tests,'independent':independent,'builds':read('build-qualification.json'),'sanitizers':sanitizers,'exact':read('mailbox-exact.json'),'timed':read('timed-qualification.json'),'interruptions':read('interruption-qualification.json'),'sourceRebuild':read('source-rebuild.json'),'ordinaryPath':read('ordinary-path.json')})
    for name in ['generic-optimizers.txt','alderlake-optimizers.txt','generic-target.txt','alderlake-target.txt']:
        # Keep raw output locally; remove only trailing whitespace for Git.
        (OUT/name).write_text('\n'.join(line.rstrip() for line in (RUN/name).read_text().splitlines()).rstrip()+'\n')
    write('resources.json',{'budget':read('budget.json'),'samples':[json.loads(l) for l in (RUN/'integrated-resources.jsonl').read_text().splitlines()],'windowsSample':(RUN/'initial-windows-sampled.json').read_text()})
    sourcepaths=['native/engine.hpp','native/engine.cpp','native/engine-impl.inc','native/engine-tables.hpp','native/engine-enhanced.cpp','native/main.cpp','scripts/native/build.mjs']
    sourcepaths += [str(p.relative_to(ROOT)) for p in sorted((ROOT/'scripts/runtime-cpu-followup').iterdir()) if p.is_file()]
    write('manifest.json',{'version':1,'baseline':read('builds.json')['base'],'probe':read('builds.json')['probe'],'files':{p.name:sha(p) for p in sorted(OUT.iterdir()) if p.is_file()},'finalSourceHashes':{p:sha(ROOT/p) for p in sourcepaths},'positionFile':'docs/data/fast-flips-mac/positions.json','positionSha256':sha(ROOT/'docs/data/fast-flips-mac/positions.json'),'rawEvidence':str(RUN.relative_to(ROOT)),'method':'One serial nine-trial campaign. Separate two-trial pilot excluded from intervals; all performance time in shared 45-minute ledger. Full disassembly/maps/binaries remain local.'})
    print(json.dumps({'files':len(list(OUT.iterdir())),'bytes':sum(p.stat().st_size for p in OUT.iterdir()),'activeSeconds':read('budget.json')['activeSeconds']}))
if __name__=='__main__':main()
