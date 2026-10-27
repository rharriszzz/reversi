#!/usr/bin/env python3
"""Audit completed pair aggregates and publish compact local research evidence."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[2]


def read(path):
    return json.loads(Path(path).read_text())


def publish(directory, destination):
    state, results = read(directory / 'manifest.json'), read(directory / 'results.json')
    if state['status'] != 'complete':
        raise ValueError('Only a completed campaign/pilot can be published')
    receipts = {t['path']: t for t in state['tasks'].values()}
    for condition, summary in zip(state['conditions'], results['conditions']):
        points = []
        for path in condition['tasks']:
            pair = read(path)
            if len(pair['games']) != 2 or {g['candidateColor'] for g in pair['games']} != {-1, 1}:
                raise ValueError('Invalid color pairing')
            point = sum(1 if g['outcome'] > 0 else .5 if g['outcome'] == 0 else 0 for g in pair['games']) / 2
            if point != pair['point']:
                raise ValueError('Invalid opening-pair aggregate')
            points.append(point)
            if condition['stage'] == 'confirmation':
                receipt, freeze = receipts[path], state['freeze']
                if 'elapsedMs' in freeze and receipt['startedMs'] < freeze['elapsedMs']:
                    raise ValueError('Confirmation before selection freeze')
                if 'elapsedMs' not in freeze and receipt['startedAt'] < freeze['at']:
                    raise ValueError('Legacy calibration confirmation before selection freeze')
        n = len(points)
        mean = sum(points) / n
        radius = math.sqrt(math.log(80 if condition['stage'] == 'confirmation' else 40) / (2 * n))
        expected = [max(0, mean - radius), min(1, mean + radius)]
        if abs(summary['summary']['mean'] - mean) > 1e-12 or any(abs(a - b) > 1e-12 for a, b in zip(expected, summary['summary']['interval'])):
            raise ValueError('Published summary differs from raw pair evidence')

    def metric(m):
        return {'id': m['id'], 'prediction': {k: v for k, v in m['prediction'].items() if k != 'byPolicy'},
                'ranking': {k: v for k, v in m['ranking'].items() if k != 'records'},
                'depth3': None if not m.get('depth3') else {k: v for k, v in m['depth3'].items() if k != 'records'},
                'speed': m['speed']}

    compact = {k: results[k] for k in ['version', 'status', 'source', 'config', 'elapsedMs', 'cpuMs', 'counts', 'allocation', 'freeze', 'conditions', 'failures', 'exclusions', 'primaryComplete', 'evidenceForImprovement']}
    compact['latest'] = [metric(m) for m in results['latest']]
    compact['confirmation'] = [metric(m) for m in results['confirmation']['metrics']]
    compact['history'] = [{k: r[k] for k in ['id', 'epoch', 'fitMs', 'positions', 'preferencePairs', 'mse', 'totalPositions', 'totalCpuMs'] if k in r} for r in state['history']]
    compact['pilot'] = state['pilot']
    compact['diagnostics'] = read(directory / 'diagnostics.json')
    compact['publishedKeys'] = sorted({p['key'] for roots in state['openings'].values() for p in roots} | {p['key'] for p in compact['diagnostics']['positions']})
    compact['artifactSha256'] = {name: hashlib.sha256((directory / name).read_bytes()).hexdigest() for name in ['manifest.json', 'selection-freeze.json', 'results.json', 'confirmation-assessment.json', 'diagnostics.json']}
    compact['modelsSha256'] = {k: hashlib.sha256(Path(v['path']).read_bytes()).hexdigest() for k, v in state['best'].items()}
    destination.mkdir(parents=True, exist_ok=True)
    (destination / 'data').mkdir(exist_ok=True)
    path = destination / 'data/strong-evaluator-pilot.json'
    path.write_text(json.dumps(compact, indent=2) + '\n')
    for name in ['positions', 'ranking', 'computation', 'strength', 'cost', 'phases', 'families']:
        shutil.copy2(directory / (name + '.svg'), destination / ('strong-pilot-' + name + '.svg'))
    print('Audited and published:', path)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--destination', type=Path, default=ROOT / 'docs')
    args = parser.parse_args()
    publish(args.directory.resolve(), args.destination.resolve())
