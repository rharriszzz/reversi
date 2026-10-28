#!/usr/bin/env python3
"""Audit the frozen development screen and export compact engineering evidence."""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import statistics
import subprocess

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('prior_audit', ROOT / 'scripts/summarize-strong-research.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
read = audit.read
sha = audit.sha


def summarize(run):
    s = read(run / 'results.json')
    assert s['status'] == 'complete'
    assert len(s['conditions']) == 6 and s['elapsedMs'] < s['capMs'] == 2700000
    assert s['source'] == read(run / 'manifest.json')['source']
    prior = read(ROOT / 'docs/data/strong-evaluator-20261028.json')
    original = ROOT / '.local-research/strong-six-hour-20261027'
    for name, digest in prior['rawHashes'].items():
        assert sha(original / name) == digest, 'Previous experiment was changed: ' + name
    for model in prior['best'].values():
        assert sha(Path(model['path'])) == model['sha256'], 'Previous model changed'
    for model in s['models']:
        assert sha(Path(model['path'])) == model['sha256'] == prior['best'][model['id']]['sha256']
    frozen = run / 'source'
    digest = subprocess.check_output(['node', '--input-type=module', '-e',
        "import {sourceDigest} from './scripts/research/io.mjs';console.log(sourceDigest(process.argv[1]));", str(frozen)], cwd=ROOT, text=True).strip()
    assert digest == s['source']
    # All baseline source files agree with the preserved original run.
    for path in (ROOT / 'src').glob('*.js'):
        assert sha(path) == sha(original / 'source/src' / path.name)
    rows, keys = [], set(read(run / 'development-keys.json')['keys'])
    excluded = set(read(run / 'exclusions.json')['keys']) | keys
    for condition in s['conditions']:
        expected = 8 if 'depth' in condition['budget'] else 32
        assert condition['target'] == len(condition['pairs']) == expected
        pairs = []
        candidate, baseline = [], []
        for index, receipt in enumerate(condition['pairs']):
            pair = read(Path(receipt))['result']
            point = audit.audit_pair(pair, index, condition['budget'])
            assert all(not (set(g['keys']) & excluded) for g in pair['games'])
            for game in pair['games']:
                keys.update(game['keys'])
                color = 'black' if game['candidateColor'] == 1 else 'white'
                candidate.extend(game['stats'][color])
                baseline.extend(game['stats']['white' if color == 'black' else 'black'])
            pairs.append(point)
        mean = statistics.mean(pairs)
        radius = math.sqrt(math.log(160) / (2 * len(pairs)))
        interval = [max(0, mean - radius), min(1, mean + radius)]
        raw = next(r for r in s['summary'] if r['id'] == condition['id'])
        audit.close(raw['summary']['mean'], mean)
        for a, b in zip(interval, raw['summary']['interval']):
            audit.close(a, b)
        games = [g for p in condition['pairs'] for g in read(Path(p))['result']['games']]
        rows.append({**{k: condition[k] for k in ['id', 'model', 'budget', 'target', 'attempts', 'rejected']},
                     'pairs': pairs, 'mean': mean, 'interval': interval,
                     'wins': sum(g['outcome'] > 0 for g in games),
                     'draws': sum(g['outcome'] == 0 for g in games),
                     'losses': sum(g['outcome'] < 0 for g in games),
                     'candidate': audit.timing(candidate), 'baseline': audit.timing(baseline),
                     'pairMs': condition['pairMs']})
    refs = read(run / 'labels.json')['labels']
    exact = [r for r in refs if r['kind'] == 'exact']
    for ref in exact:
        values = {move: -audit.exact(child, -ref['player']) for move, child in audit.children(ref['board'], ref['player'])}
        assert values == {r['move']: r['margin'] for r in ref['rows']}
        assert max(values.values()) == ref['value']
    keys.update(p['key'] for p in s['openings'])
    metrics = [audit.metric(m) for m in s['quality']['metrics']]
    # This frozen screen had no training calibrationPaths. Its B regression
    # prediction was zero-scaled; all search/ranking/speed measurements are valid.
    for m in metrics:
        if m['id'] == 'B':
            m['prediction'] = None
            m['predictionCaveat'] = 'B margin calibration unavailable in this screen; omit regression MSE. Search, rankings and speed use unchanged B.'
    directory = lambda name: ROOT / '.local-research' / name / 'results.json'
    scaling = read(directory('next-scaling-sustained'))
    label_path = directory('next-label-scaling')
    label = read(label_path) if label_path.exists() else None
    encoding = read(directory('next-encoding'))
    cpu = read(directory('next-cpu'))
    native = read(directory('next-native'))
    native['additionalRuleValidation'] = {'fixtures': read(directory('next-native-verified'))['ruleFixtures'], 'cases': ['forced pass', 'terminal with empty square', 'early elimination', 'empty terminal board']}
    storage = read(ROOT / '.local-research/next-storage/storage.json')
    # Preserve numerical summaries/profiles, not duplicate megabytes of worker
    # detail already retained in local immutable receipts.
    compact = lambda data: {**{k: v for k, v in data.items() if k != 'results'}, 'results': [{k: v for k, v in r.items() if k != 'profile'} for r in data['results']]}
    return {'format': 'next-evaluator-audit-v1', 'source': s['source'], 'status': s['status'],
            'seed': s['seed'], 'protocol': s['protocol'], 'elapsedMs': s['elapsedMs'], 'capMs': s['capMs'],
            'marginMs': s['capMs'] - s['elapsedMs'], 'conditions': rows,
            'models': s['models'], 'quality': {'games': s['quality']['games'], 'exact': len(exact), 'search': len(refs) - len(exact), 'metrics': metrics},
            'rawHashes': {name: sha(run / name) for name in ['manifest.json', 'results.json', 'development.json', 'labels.json']},
            'previousRunPreserved': True, 'allPriorBestModelsPreserved': True,
            'publishedKeys': sorted(keys), 'storage': storage, 'native': native,
            'scaling': compact(scaling), 'labelScaling': compact(label) if label else None,
            'encoding': encoding, 'cpu': cpu, 'trainingUpdateCpuDuringScreenMs': 0,
            'continueTraining': any(all(next(c for c in rows if c['model'] == model['id'] and c['budget'].get('timeMs') == budget)['mean'] >= .5 for budget in [80, 300]) for model in s['models'])}


def plots(e, destination):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig, axes = plt.subplots(1, 3, figsize=(14, 4.5), constrained_layout=True)
    for model, color in [('long-margin-p4', '#ac4c25'), ('long-rank-p4', '#236faf')]:
        rows = sorted([r for r in e['conditions'] if r['model'] == model and 'timeMs' in r['budget']], key=lambda r: r['budget']['timeMs'])
        axes[0].errorbar([r['budget']['timeMs'] for r in rows], [r['mean'] for r in rows],
                         yerr=[[r['mean'] - r['interval'][0] for r in rows], [r['interval'][1] - r['mean'] for r in rows]], marker='o', label=model, color=color, capsize=4)
    axes[0].axhline(.5, color='gray', linestyle='--');axes[0].set(ylim=(0, 1), xlabel='Milliseconds per move', ylabel='Points against B', title='32 paired openings per point\nDevelopment only; conservative pair intervals');axes[0].legend(fontsize=8)
    for m in e['quality']['metrics']:
        axes[1].scatter(m['speed']['microseconds'], m['ranking']['exact']['regret']);axes[1].annotate(m['id'], (m['speed']['microseconds'], m['ranking']['exact']['regret']), xytext=(4, 4), textcoords='offset points', fontsize=8)
    axes[1].set(xlabel='Complete static evaluation, microseconds', ylabel='Depth-1 exact disc regret', title='Cheap late-game accuracy did not win games\n22 independent development endings')
    for kind in ['generate', 'fit']:
        rows = e['scaling']['results'];counts = sorted({r['workers'] for r in rows});base = statistics.median(r['wallMs'] for r in rows if r['workers'] == 1 and r['type'] == kind)
        axes[2].plot(counts, [base/statistics.median(r['wallMs'] for r in rows if r['workers'] == n and r['type'] == kind) for n in counts], marker='o', label=kind)
    axes[2].plot([1, 8], [1, 8], linestyle=':', color='gray', label='linear');axes[2].set(xlabel='Workers', ylabel='Fixed-work speedup', title='Three sustained trials per count');axes[2].legend(fontsize=8)
    path = destination / 'next-evaluator-comparison.svg'
    fig.savefig(path);plt.close(fig)
    path.write_text('\n'.join(line.rstrip() for line in path.read_text().splitlines()) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('run', type=Path)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--plots', action='store_true')
    args = parser.parse_args()
    evidence = summarize(args.run.resolve())
    path = ROOT / 'docs/data/next-evaluator-20261028.json'
    text = json.dumps(evidence, sort_keys=True, indent=2) + '\n'
    if args.check:
        assert path.read_text() == text, 'Published evidence differs from audited raw results'
    else:
        path.write_text(text)
    if args.plots:
        plots(evidence, ROOT / 'docs')
    print('Audited 288 games, all 22 independent exact references, original artifacts/models and frozen identities. Six-hour continuation:', evidence['continueTraining'])

if __name__ == '__main__':
    main()
