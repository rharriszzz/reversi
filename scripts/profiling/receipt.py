"""Publish compact audit evidence; never run a measurement or copy raw traces."""
import argparse,collections,hashlib,json,os,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=(ROOT/os.environ.get('REVERSI_PROFILE_RUN','.local-research/profiling-m4-20261030')).resolve()
DATA=ROOT/'docs/data/profiling'
def load(name):return json.loads((OUT/name).read_text())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def write(name,value):(DATA/name).write_text(json.dumps(value,separators=(',',':'))+'\n')
def node_check(file):
    value=(OUT/file).read_text();n=int(re.search(r'ℹ tests (\d+)',value)[1]);assert re.search(r'ℹ fail 0\b',value);return {'tests':n,'passed':n}
def python_check(file):
    value=(OUT/file).read_text();assert '\nOK' in value;return {'tests':int(re.search(r'Ran (\d+) tests?',value)[1]),'passed':True}
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--final',action='store_true');args=parser.parse_args()
    b=json.loads((DATA/'benchmarks.json').read_text());m=json.loads((DATA/'manifest.json').read_text());write('collector-resources.json',load('collector-resources.json'))
    post=load('postprocessing.json');tools={}
    for c in post['commands']:
        t=tools.setdefault(c['tool'],{'commands':0,'wallSeconds':0,'childrenCpuSeconds':0})
        t['commands']+=1
        for key in ['wallSeconds','childrenCpuSeconds']:t[key]+=c[key]
    resources={}
    for file in ['resources-before.json','measurement-resources-after.json','chrome-resources-before.json','chrome-resources-after.json']:
        value=load(file);value.pop('processes',None);resources[file]=value
    snapshots=[json.loads(line) for line in (OUT/'resources.jsonl').read_text().splitlines()]
    resourceSummary={'snapshots':len(snapshots),'pressureLevels':dict(collections.Counter(str(x['pressureLevel']) for x in snapshots)),
      'swapoutsFirst':snapshots[0]['vmPages']['Swapouts'],'swapoutsLast':snapshots[-1]['vmPages']['Swapouts'],
      'minimumDiskFreeBytes':min(x['diskFreeBytes'] for x in snapshots),
      'scope':'Snapshots precede trials, not continuous monitoring during timed work. Ordinary desktop/system activity remains a limitation.'}
    counts=collections.Counter()
    for c in b['captureStatistics']:counts.update(c['cores'])
    paths=list((ROOT/'scripts/profiling').glob('*'))+list((ROOT/'profiling').glob('*'))
    paths += [ROOT/p for p in ['tests/profiling.test.mjs','tests/test_profiling.py','README.md','docs/PERFORMANCE_OVERVIEW.md','docs/PROFILING_METHODS_AND_VIEWS.md','docs/VALIDATION.md','docs/ARCHITECTURE.md']]
    receipt={'version':1,'status':'completed acceptance' if args.final else 'qualified measurement pipeline and initial views',
      'recoveredFrom':{'headAndFetchedOriginMain':'1f0faa3b7fac3ca42f7ccd06aec1d8c27e38acbf',
        'originalUntrackedScripts':{p.name:sha(p) for p in (OUT/'recovery').glob('*') if p.name in ['build.mjs','driver.cpp','measure.py']},
        'priorWorkPreserved':'.local-research/profiling-views-20261030 and this run/recovery',
        'priorTaskProcessesFound':False,'discardedOrResetWork':False},
      'tools':load('tool-versions.json'),'pmu':load('pmu-event.json'),
      'budget':load('budget.json'),'resources':resources,'preTrialResourceSummary':resourceSummary,
      'shippedProfilerSettings':{mode:load(mode+'-settings.json') for mode in ['cpu-normal','cpu-high','time-normal','time-high']},
      'fixedWorkVerification':load('fixed-work-verified.json'),
      'harnessQualification':load('harness-qualification.json'),
      'nativeAcceptedSamples':sum(c['samples'] for c in b['captureStatistics']),
      'nativeCoreSampleCounts':dict(counts),
      'completePublishedProfiles':len(m['profiles']),
      'sourceHashes':{str(p.relative_to(ROOT)):sha(p) for p in paths if p.is_file()},
      'profileHashes':{p['file']:sha(DATA/p['file']) for p in m['profiles']},
      'dataHashes':{file:sha(DATA/file) for file in ['benchmarks.json','analysis.json','chrome-summary.json','collector-resources.json','evaluator-loop-review.json'] if (DATA/file).exists()},
      'postprocessing':{k:v for k,v in post.items() if k!='commands'}|{'tools':tools,
        'scope':'Successful final normalization pass only. Includes cached earlier exports without recounting their commands. Failed qualification passes and earlier cached export CPU/wall are not included in this subtotal; their logs remain local. Not application interference.'},
      'checks':{'fastBefore':node_check('fast-before.log'),'fastAfter':node_check('fast-after.log'),'model':node_check('profiling-node-tests.log'),'xmlImporter':python_check('xml-tests.log'),'launcher':python_check('launcher-tests.log'),
        'browser':load('browser-qualification.json') if (OUT/'browser-qualification.json').exists() else None},
      'platformScope':'New native profiling and Chrome acceptance ran on Apple M4 macOS only. No new WSL2/Windows/Intel Mac qualification.',
      'publication':{'intermediateCommit':'8791031a155b26533edca97d777d0af5e19e535a','intermediateRemoteVerification':'git ls-remote origin refs/heads/main matched the complete commit ID after git push origin main. Final commit verification is reported after publication.'},
      'engineModelAndWasmChanges':False,'securitySettingsChanged':False,
      'loss':'Unknown; exports do not expose a reliable lost-sample count.'}
    write('receipt.json',receipt)
    print('Published compact receipt and separately scoped collector audit.')
if __name__=='__main__':main()
