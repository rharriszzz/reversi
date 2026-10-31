"""Audit committed PC evidence without profiling tools or rerunning searches."""
import hashlib
import json
from pathlib import Path
from analyze import effect

ROOT = Path(__file__).resolve().parents[2]
D = ROOT/'docs/data/fast-flips-pc'


def load(name):
    return json.loads((D/name).read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    manifest = load('manifest.json')
    mac = json.loads((ROOT/'docs/data/fast-flips-mac/manifest.json').read_text())
    assert digest(ROOT/'native/engine.cpp') == mac['sourceHashes']['native/engine.cpp']
    for path, checksum in manifest['harnessSourceSha256'].items():
        assert digest(ROOT/path) == checksum, path
    assert digest(D/'positions.json') == mac['workloadSha256'] == manifest['workloadSha256']
    assert manifest['activeMeasurementSeconds'] < 5400
    tests = load('tests.json')
    assert tests['passed'] and len(tests['rows']) == 4
    assert [r['tests'] for r in tests['rows'][:3]] == [182, 16, 46]
    fixed = 0
    for config in ['portable', 'native']:
        builds = manifest['configurations'][config]['builds']
        assert builds['baseline'] == mac['baselineCommit']
        assert builds['builds']['original']['sourceHashes']['engine.cpp'] == mac['builds']['builds']['original']['sourceHashes']['engine.cpp']
        assert builds['builds']['refined']['sourceHashes']['engine.cpp'] == mac['sourceHashes']['native/engine.cpp']
        expected = mac['flags'] + (['-march=native'] if config == 'native' else [])
        assert builds['flags'] == expected
        micro = load(config+'-micro.json')
        search = load(config+'-search.json')
        summary = load(config+'-summary.json')
        qualification = load(config+'-qualification.json')
        assert micro['corpus'] == mac['microCorpus']
        assert len(micro['rows']) == 336 and micro['checkedCases'] == 1260090
        assert all(q['passed'] for q in qualification.values())
        assert qualification['timed-qualification']['publications'] == 324
        assert len(search['rows']) == 162
        other = load(('native' if config == 'portable' else 'portable')+'-search.json')
        assert search['rootReferences'] == other['rootReferences'], 'Compiler tuning changed fixed scores/trees'
        for row in search['rows']:
            baseline = row['results']['original']
            for tag, r in row['results'].items():
                assert r['metrics'] == baseline['metrics']
                assert r['fullRootSignatureSha256'] == baseline['fullRootSignatureSha256']
                assert r['wallSeconds'] > 0 and r['workloadCpuSeconds'] > 0
                fixed += 1
        for p in summary['panels']:
            ratios = [r['results'][p['tag']]['wallSeconds']/r['results']['original']['wallSeconds']
                      for r in search['rows'] if r['workload'] == p['workload']]
            e = effect(ratios)
            assert all(abs(e[k]-p['vsOriginal'][k]) < 1e-9 for k in ['percent', 'low', 'high'])
        for panel in qualification['mailbox-exact']['rows']:
            for model in ['B', 'L', 'P']:
                roots = search['rootReferences'][panel['panel']+'-'+model]
                assert [r['score'] for r in roots] == [r['score'] for r in panel['references']]
        for corpus in micro['corpus']:
            for rep in range(7):
                rows = [r for r in micro['rows'] if r['class'] == corpus['class'] and r['rep'] == rep]
                assert len(rows) == 6 and len({r['checksum'] for r in rows}) == 1
        for w in search['workloads']:
            assert w['sha256'] == next(x['sha256'] for x in other['workloads'] if x['id'] == w['id'])
    profiles = load('software-profiles.json')
    assert len(profiles['captures']) == 6
    for c in profiles['captures']:
        assert sum(c['symbolCounts'].values()) == c['samples'] > 1000
        assert sum(r['samples'] for r in c['flipInstructionSamples']) == c['symbolCounts']['reversi::flips']
        assert all(r['withinSymbol'] for r in c['flipInstructionSamples'])
        assert 'Software cpu-clock' in c['mechanism']
        assert c['binarySha256'] == manifest['configurations']['portable']['builds']['builds'][c['tag']]['fixedWorkExecutableSha256']
    probe = load('pmu-probe.json')
    assert all(r['errnoName'] == 'ENOENT' for r in probe['probes'] if r['type'] == 0)
    assert any(r['opened'] for r in probe['probes'] if r['type'] == 1)
    assert 'EAX=00000000' in probe['guestCpuid']
    assert load('windows-host.json')['wprExitCode'] == 0
    print(json.dumps({'passed': True, 'fixedBuildBlocks': fixed, 'microTrials': 672,
                      'actualTimedPublications': 648, 'softwareCaptures': 6,
                      'activeMeasurementSeconds': manifest['activeMeasurementSeconds']}))


if __name__ == '__main__':
    main()
