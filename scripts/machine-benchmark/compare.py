#!/usr/bin/env python3
"""Compare completed results only when their scientific work is identical."""
import argparse
import json
from pathlib import Path
import statistics
import hashlib

ROOT = Path(__file__).resolve().parents[2]
PC_SOURCE = '3d091dc672c7244327123a60d87647007e97fdbe03056d046d33be9c1fb7306c'
# Reviewed installation/comparison-only changes. Numerical modules, runner,
# fixtures, workload and upstream patched source must still be identical.
PORTABILITY_FILES = {'scripts/machine-benchmark/setup.py',
                     'scripts/machine-benchmark/darwin-allocation.h',
                     'scripts/machine-benchmark/compare.py', 'tests/test_machine_benchmark.py'}


def source_compatibility(left, right):
    if left == right:
        return dict(identical=True, changedFiles=[])
    if not isinstance(left, dict) or not isinstance(right, dict) or left.get('sha256') != PC_SOURCE:
        raise ValueError('Incompatible source; no reviewed portability exception')
    for inventory in [left, right]:
        digest = hashlib.sha256(json.dumps(inventory['files'], sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        if digest != inventory['sha256']:
            raise ValueError('Invalid source inventory digest')
    a, b = left['files'], right['files']
    changed = sorted(p for p in a.keys() | b.keys() if a.get(p) != b.get(p))
    if not set(changed) <= PORTABILITY_FILES:
        raise ValueError('Incompatible source: numerical or task source changed')
    for p in changed:
        if b.get(p) != hashlib.sha256((ROOT / p).read_bytes()).hexdigest():
            raise ValueError('Incompatible source: portability files differ from reviewed checkout')
    return dict(identical=False, changedFiles=changed, leftSha256=left['sha256'], rightSha256=right['sha256'],
                reason='Explicit Darwin allocation/build and comparison-only exception; numerical/task source unchanged')

KINDS = ['edax10', 'edax12', 'B', 'exact', 'linear', 'pattern']


def compare(left, right):
    compatibility = source_compatibility(left.get('source'), right.get('source'))
    for key in ['schema', 'mode', 'plan', 'fixtureSha256', 'fixtureIdentity', 'corpusHash', 'baselineModelSha256', 'engineeringLinearChecksum', 'evalSha256']:
        if left.get(key) != right.get(key):
            raise ValueError(f'Incompatible {key}; do not compare changed scientific work')
    if left['mode'] != 'full' or any(r['status'] not in ['complete', 'complete-with-skips'] or not r['validation']['passed'] for r in [left, right]):
        raise ValueError('Both must be completed full runs with successful correctness gates')
    for key in ['upstream', 'patchSha256', 'sourceTreeSha256']:
        if left['teacher'][key] != right['teacher'][key]:
            raise ValueError(f'Teacher numerical source differs: {key}')
    rows = []
    for kind in KINDS:
        def complete(result):
            groups = {}
            for trial in result['trials']:
                if trial['kind'] == kind:
                    groups.setdefault(trial['workers'], []).append(trial)
            return {w: sorted(g, key=lambda t: t['repetition']) for w, g in groups.items()
                    if sorted(t['repetition'] for t in g) == list(range(result['plan']['repetitions']))}
        a, b = complete(left), complete(right)
        if 1 not in a or 1 not in b:
            raise ValueError(f'Missing three single-worker trials for {kind}')
        for w in sorted(a.keys() & b.keys()):
            ratios = []
            for x, y in zip(a[w], b[w]):
                if x['tasks'] != y['tasks']:
                    raise ValueError('Task counts differ')
                if kind not in ['linear', 'pattern'] and x['numericalSequenceSha256'] != y['numericalSequenceSha256']:
                    raise ValueError(f'Search numerical work differs for {kind}')
                ratios.append(x['elapsedSeconds'] / y['elapsedSeconds'])
            rows.append(dict(kind=kind, workers=w, leftMedianSeconds=statistics.median(t['elapsedSeconds'] for t in a[w]),
                             rightMedianSeconds=statistics.median(t['elapsedSeconds'] for t in b[w]),
                             rightSpeedup=dict(median=statistics.median(ratios), minimum=min(ratios), maximum=max(ratios)),
                             leftTasksPerHour=statistics.median(t['usefulTasksPerHour'] for t in a[w]),
                             rightTasksPerHour=statistics.median(t['usefulTasksPerHour'] for t in b[w])))
    best = {}
    for side, result in [('left', left), ('right', right)]:
        best[side] = {}
        for kind in KINDS:
            eligible = [r for r in result['summary'] if r['kind'] == kind and r['elapsedSeconds']['n'] == result['plan']['repetitions']]
            best[side][kind] = max(eligible, key=lambda r: r['usefulTasksPerHour']['median'])
    winners = {kind: ('right' if best['right'][kind]['usefulTasksPerHour']['median'] > best['left'][kind]['usefulTasksPerHour']['median'] else 'left') for kind in KINDS}
    return dict(schema='reversi-machine-comparison-v1', sourceCompatibility=compatibility, rows=rows, best=best, pointEstimateWinner=winners,
                limitations='Three matched repetitions estimate run variability, not confidence in general hardware superiority. Best count must also have acceptable paging and operator responsiveness. Small cold fits do not model large-corpus memory pressure. Campaign choice depends on the fixed task mix; no synthetic aggregate CPU score.')


def markdown(report):
    lines = ['| Task | Workers | PC seconds | Mac seconds | Mac/PC useful throughput |', '| --- | ---: | ---: | ---: | ---: |']
    for row in report['rows']:
        ratio = row['rightSpeedup']
        lines.append(f'| {row["kind"]} | {row["workers"]} | {row["leftMedianSeconds"]:.2f} | {row["rightMedianSeconds"]:.2f} | {ratio["median"]:.2f}× ({ratio["minimum"]:.2f}–{ratio["maximum"]:.2f}) |')
    lines += ['', 'Ratios are paired elapsed-time ratios for identical work, median and observed range over three trials.', '']
    for role, kinds in [('Independent labeling', ['edax10', 'edax12']), ('Model fitting', ['linear', 'pattern']), ('Exact solving', ['exact'])]:
        descriptions = []
        for kind in kinds:
            side = report['pointEstimateWinner'][kind]
            r = report['best'][side][kind]
            descriptions.append(f'{kind}: {"Mac" if side == "right" else "PC"} at {r["workers"]} workers ({r["usefulTasksPerHour"]["median"]:.0f} tasks/hour)')
        lines.append(role + ' measured point estimates: ' + '; '.join(descriptions) + '.')
    lines += ['', 'For longer campaigns, choose using the measured cost of the planned labeling/solving/fitting mix and safe memory headroom. These fixtures do not establish full-corpus capacity or stronger play.', '', report['limitations']]
    return '\n'.join(lines)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('pc')
    p.add_argument('mac')
    p.add_argument('--output', required=True)
    p.add_argument('--report', help='Replace the comparison placeholder in MAC_PC_BENCHMARK.md')
    a = p.parse_args()
    report = compare(json.loads(Path(a.pc).read_text()), json.loads(Path(a.mac).read_text()))
    Path(a.output).write_text(json.dumps(report, separators=(',', ':')) + '\n')
    text = markdown(report)
    if a.report:
        path = Path(a.report)
        before, marker, _ = path.read_text().partition('<!-- MACHINE COMPARISON -->')
        if not marker:
            raise ValueError('Missing comparison marker; refusing to overwrite report')
        path.write_text(before + marker + '\n\n' + text + '\n')
    print(text)


if __name__ == '__main__':
    main()
