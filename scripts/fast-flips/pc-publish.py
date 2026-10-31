"""Compact PC evidence, kept separate from the immutable Mac experiment.

Usage: python scripts/fast-flips/pc-publish.py PORTABLE_RUN NATIVE_RUN
Requires both complete qualifications; no measurement/build is started here.
"""
import hashlib
import importlib.util
import json
import platform
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT/'docs/data/fast-flips-pc'


def load(path):
    return json.loads(path.read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(name, value):
    (DEST/name).write_text(json.dumps(value, separators=(',', ':'))+'\n')


def main():
    assert platform.system() == 'Linux' and platform.machine() == 'x86_64'
    directories = dict(zip(['portable', 'native'], [Path(p).resolve() for p in sys.argv[1:]]))
    assert len(directories) == 2
    spec = importlib.util.spec_from_file_location('mac_publish', Path(__file__).with_name('publish.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    DEST.mkdir(parents=True, exist_ok=True)
    mac = load(ROOT/'docs/data/fast-flips-mac/manifest.json')
    all_checks = load(directories['portable']/'pc-test-receipt.json')
    assert all_checks['passed'] and len(all_checks['rows']) == 4
    configs = {}
    resources = {}
    seconds = 0
    for name, out in directories.items():
        builds = load(out/'builds.json')
        micro = load(out/'micro.json')
        assert micro['corpus'] == mac['microCorpus']
        assert builds['workloadSha256'] == mac['workloadSha256'] == digest(out/'positions.json')
        assert builds['modelHeaderSha256'] == mac['modelHeaderSha256']
        assert builds['builds']['refined']['sourceHashes']['engine.cpp'] == mac['sourceHashes']['native/engine.cpp']
        assert digest(ROOT/'native/engine.cpp') == mac['sourceHashes']['native/engine.cpp']
        qualification = {f: load(out/(f+'.json')) for f in [
            'qualification', 'sanitize', 'timed-qualification', 'mailbox-exact']}
        assert all(q['passed'] for q in qualification.values())
        assert load(out/'diagnostic.json') == load(out/'diagnostic-refined.json')
        assert digest(out/'search-cases.txt') == digest(out/'search-cases-refined.txt') == mac['searchCasesSha256']
        search = module.compact(load(out/'integrated-final.json'))
        summary = load(out/'summary-final.json')
        assembly = load(out/'assembly.json')
        directions = load(out/'directions.json')
        for tag in search['tags']:
            assert builds['builds'][tag]['fixedWorkExecutableSha256'] == digest(out/tag/'fixed-work')
        for file, value in [('search', search), ('micro', micro), ('summary', summary),
                             ('qualification', qualification), ('assembly', assembly), ('directions', directions)]:
            save(name+'-'+file+'.json', value)
        configs[name] = {'builds': builds, 'microCorpus': micro['corpus'],
                         'diagnostic': load(out/'diagnostic.json'),
                         'microBinarySha256': digest(out/'micro-refined'),
                         'microCheckedCases': micro['checkedCases'],
                         'baselineSourceRevision': builds['baseline'],
                         'selectedSourceRevision': '9357d4b3510d7931b3ea4b8739b7c8e693414f33',
                         'publishedMacHead': '1b83a2b2c158078962afd48a48479346f854c813'}
        budget = load(out/'budget.json')
        assert all(r['binariesUnchanged'] for r in budget['runs'])
        seconds += budget['activeSeconds']
        resources[name] = {'budget': budget, 'periodic': [json.loads(line) for line in
                           (out/'integrated-resources.jsonl').read_text().splitlines()]}
    assert seconds < 5400, 'Combined machine measurement budget exceeded'
    portable = directories['portable']
    save('pmu-probe.json', load(portable/'pmu-probe.json'))
    save('windows-host.json', load(portable/'windows-host.json'))
    save('software-profiles.json', load(portable/'software-profiles.json'))
    save('tests.json', all_checks)
    save('resources.json', {'activeSecondsAcrossConfigurations': seconds, 'configurations': resources})
    shutil.copy2(portable/'positions.json', DEST/'positions.json')
    manifest = {'platform': platform.platform(), 'python': sys.version,
                'node': subprocess.check_output(['node', '--version'], text=True).strip(),
                'cpu': subprocess.check_output(['lscpu'], text=True),
                'configurations': configs,
                'workloadSha256': digest(DEST/'positions.json'),
                'searchCasesSha256': mac['searchCasesSha256'],
                'harnessSourceSha256': {str(p.relative_to(ROOT)): digest(p)
                    for p in (ROOT/'scripts/fast-flips').glob('pc-*') if p.is_file()},
                'sharedEngineChangedDuringPCPhase': False,
                'distributedWasmChangedDuringPCPhase': False,
                'activeMeasurementSeconds': seconds}
    save('manifest.json', manifest)
    print(json.dumps({'published': str(DEST), 'activeSeconds': seconds,
                      'bytes': sum(p.stat().st_size for p in DEST.iterdir() if p.is_file())}))


if __name__ == '__main__':
    main()
