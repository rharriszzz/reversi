"""Publish compact immutable evidence after all qualification gates pass."""
import hashlib,json,os,re,subprocess,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
RUN=ROOT/os.environ.get('REVERSI_DISPATCH_RUN','.local-research/runtime-cpu-final-20261031')
OUT=ROOT/'docs/data/runtime-cpu-dispatch'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(name):return json.loads((RUN/name).read_text())
def write(name,data):
    (OUT/name).write_text(json.dumps(data,separators=(',',':'))+'\n')
def main():
    OUT.mkdir(exist_ok=True)
    tests=[]
    for log,command,kind in [
      ('dispatch-final-node-tests.log','NATIVE_CPU=dispatch node --test --test-concurrency=1 tests/*.test.mjs','node'),
      ('dispatch-final-portable-tests.log','REVERSI_CPU_BACKEND=portable NATIVE_CPU=dispatch node --test --test-concurrency=1 tests/native-search.test.mjs tests/native-v2.test.mjs tests/mac-endgame.test.mjs','node'),
      ('dispatch-final-sanitize-auto.log','NATIVE_CPU=dispatch NATIVE_SANITIZE=1 node --test --test-concurrency=1 tests/native-search.test.mjs tests/native-v2.test.mjs tests/mac-endgame.test.mjs tests/runtime-cpu-dispatch.test.mjs','node'),
      ('dispatch-final-sanitize-portable.log','REVERSI_CPU_BACKEND=portable NATIVE_CPU=dispatch NATIVE_SANITIZE=1 node --test --test-concurrency=1 tests/native-search.test.mjs tests/native-v2.test.mjs tests/mac-endgame.test.mjs','node'),
      ('dispatch-final-python-tests.log',".venv/bin/python -m unittest discover -s tests -p 'test_*.py'",'python')]:
        p=ROOT/'.local-research'/log;s=p.read_text()
        if kind=='node':
            n=int(re.search(r'ℹ tests (\d+)',s)[1]);passed=int(re.search(r'ℹ pass (\d+)',s)[1]);failed=int(re.search(r'ℹ fail (\d+)',s)[1]);skipped=int(re.search(r'ℹ skipped (\d+)',s)[1]);assert failed==0 and passed==n and skipped==0
        else:
            n=int(re.search(r'Ran (\d+) tests?',s)[1]);assert re.search(r'^OK$',s,re.M);passed=n;failed=0;skipped=0
        tests.append({'command':command,'tests':n,'passed':passed,'failed':failed,'skipped':skipped,'logSha256':sha(p)})
    write('qualification.json',{'tests':tests,'independent':read('qualification.json'),'exact':read('mailbox-exact.json'),'timed':read('timed-qualification.json'),'sourceRebuild':read('source-rebuild.json'),'ordinaryPath':read('ordinary-path.json'),'cpu':read('cpu.json'),'rejectedExploratoryRun':read('budget.json')['inheritedExploratoryRun']})
    for source,dest in [('builds.json','builds.json'),('compact-search.json','search.json'),('summary.json','summary.json'),('micro.json','micro.json'),('assembly.json','assembly.json')]:write(dest,read(source))
    sourcepaths=['native/engine.hpp','native/engine.cpp','native/engine-impl.inc','native/engine-tables.hpp','native/engine-enhanced.cpp','native/main.cpp','scripts/native/build.mjs','scripts/wasm/build.mjs','tests/runtime-cpu-dispatch.test.mjs','tests/runtime-cpu-state.cpp']
    sourcepaths += [str(p.relative_to(ROOT)) for p in sorted((ROOT/'scripts/runtime-cpu').glob('*')) if p.suffix in ('.py','.mjs')]
    files={p.name:sha(p) for p in sorted(OUT.iterdir()) if p.is_file() and p.name!='manifest.json'}
    budget=read('budget.json')
    benchmark=ROOT/'scripts/runtime-cpu/benchmark.py'
    lines=benchmark.read_text().splitlines(keepends=True)
    removed=''.join(l for l in lines if l.startswith("    hello=json.loads") or l.startswith("    assert hello['cpuBackend']"))
    executed=''.join(l for l in lines if not (l.startswith("    hello=json.loads") or l.startswith("    assert hello['cpuBackend']")))
    harness={'finalSha256':sha(benchmark),'executedSha256':hashlib.sha256(executed.encode()).hexdigest(),'addedPreflight':removed,'note':'A CPU preflight was added before workload generation after the accepted benchmark process had loaded its script; no measured loop or workload changed. Removing these exact two lines reconstructs the executed runner.'}
    write('manifest.json',{'version':1,'productionBase':'e7b79b9510278b815606c47b667ddeff396e289b','stage1Main':'6b480ed1bc6ddcdde2fdb37872c0ca8d0a804425','checkpoint':'1028930db922bc89a65f9cae751a01c91755464e','files':files,'finalSourceHashes':{p:sha(ROOT/p) for p in sourcepaths},'positionFile':'docs/data/fast-flips-mac/positions.json','positionSha256':sha(ROOT/'docs/data/fast-flips-mac/positions.json'),'budget':budget,'benchmarkHarness':harness,'rawEvidence':str(RUN.relative_to(ROOT)),'method':'One final serial campaign; compact full counters/CPU clocks/result hashes and timed publications. Exploratory flags-error run is superseded but its time remains charged.'})
    print(json.dumps({'files':len(files),'bytes':sum(p.stat().st_size for p in OUT.iterdir()),'activeSeconds':budget['activeSeconds']}))
if __name__=='__main__':main()
