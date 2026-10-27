#!/usr/bin/env python3
"""Audit completed local research artifacts and publish compact evidence, not models.

No games, fitting, inference, or external services are run. Use the experiment's
original framework commit for computational replication; timings can differ.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
from html import escape
import json
import math
from pathlib import Path


def load(path):
    return json.loads(Path(path).read_text())


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def canonical(board, player):
    keys = []
    for mirror in range(2):
        for turns in range(4):
            values = [0] * 64
            for i, value in enumerate(board):
                row, col = divmod(i, 8)
                if mirror:
                    col = 7 - col
                for _ in range(turns):
                    row, col = col, 7 - row
                values[row * 8 + col] = str(value * player + 1)
            keys.append(''.join(values))
    return min(keys)


def near(a, b):
    assert math.isclose(a, b, rel_tol=1e-10, abs_tol=1e-6), (a, b)


def snapshot(run):
    state, results = load(run / 'manifest.json'), load(run / 'results.json')
    assert state['status'] == results['status'] == 'complete'
    assert state['source'] == results['source'] and state['config'] == results['config']
    assert len(state['conditions']) == len(results['conditions'])
    evidence = {k: results[k] for k in ['version', 'source', 'git', 'platform', 'config', 'elapsedMs', 'cpuMs', 'allocation', 'progress', 'splitAudit', 'stoppingReason', 'failures', 'limitations']}
    evidence['format'] = 'local-research-publication-v1'
    evidence['protocol'] = state['protocol']
    evidence['sessions'] = state['sessions']
    evidence['finalCheckpointUtc'] = datetime.fromtimestamp((run / 'manifest.json').stat().st_mtime, timezone.utc).isoformat()
    evidence['freeze'] = {k: v for k, v in state['freeze'].items() if k != 'modelPath'}
    evidence['freeze']['modelSha256'] = sha(state['freeze']['modelPath'])
    evidence['rawHashes'] = {name: sha(run / name) for name in ['manifest.json', 'results.json', 'selection-freeze.json', 'ablations.json', 'diagnostics.json']}
    evidence['calibration'] = state['calibration']
    evidence['conditions'], published = [], set()
    task_hashes = []
    for condition, recorded in zip(state['conditions'], results['conditions']):
        assert condition['id'] == recorded['id']
        summary = recorded['summary']
        pairs, points, outcomes, margins = [], [], [], []
        nodes, evaluations, depths = Counter(), Counter(), {'candidate': Counter(), 'opponent': Counter()}
        walls, cpus, overruns, fallbacks = Counter(), Counter(), {'candidate': [], 'opponent': []}, Counter()
        for index, task_id in enumerate(condition['tasks']):
            task = state['tasks'][task_id]
            assert task['status'] == 'complete'
            pair = load(task['path'])
            assert pair['index'] == index and len(pair['games']) == 2
            assert pair['candidate'] == condition['candidate'] and pair['opponent'] == condition['opponent']
            assert pair['budget'] == condition['budget']
            assert [g['candidateColor'] for g in pair['games']] == ([-1, 1] if index % 2 else [1, -1])
            assert pair['opening']['key'] == canonical(pair['opening']['board'], pair['opening']['player'])
            published.add(pair['opening']['key'])
            game_outcomes, game_margins = [], []
            for game in pair['games']:
                assert game['winner'] == (game['margin'] > 0) - (game['margin'] < 0)
                assert game['outcome'] == game['winner'] * game['candidateColor']
                game_outcomes.append(game['outcome']); game_margins.append(game['margin'])
                outcomes.append(game['outcome']); margins.append(game['margin'] * game['candidateColor'])
                for color, rows in game['stats'].items():
                    side = 'candidate' if (1 if color == 'black' else -1) == game['candidateColor'] else 'opponent'
                    for row in rows:
                        nodes[side] += row['nodes']; evaluations[side] += row['evaluations']
                        depths[side][str(row['depth'])] += 1; walls[side] += row['wallMs']; cpus[side] += row['cpuMs']
                        overruns[side].append(row['overrunMs']); fallbacks[side] += row['fallback']
            point = sum(1 if x > 0 else 0.5 if x == 0 else 0 for x in game_outcomes) / 2
            near(point, pair['point']); points.append(point)
            pairs.append([index, *game_outcomes, *game_margins])
            task_hashes.append([task_id, sha(task['path'])])
        n = len(points)
        assert n == summary['pairs'] and 2 * n == summary['games']
        assert [outcomes.count(x) for x in [1, 0, -1]] == [summary[k] for k in ['wins', 'draws', 'losses']]
        if n:
            mean = sum(points) / n
            radius = math.sqrt(math.log(2 * state['protocol']['comparisons'] * state['protocol']['maxPairs'] / 0.05) / (2 * n))
            near(mean, summary['mean']); near(max(0, mean - radius), summary['interval'][0]); near(min(1, mean + radius), summary['interval'][1])
            near(sum(margins) / len(margins), summary['meanCandidateMargin'])
        for side, stats in summary['metrics'].items():
            assert stats['nodes'] == nodes[side] and stats['evaluations'] == evaluations[side]
            assert stats['depths'] == dict(depths[side]) and stats['fallbacks'] == fallbacks[side]
            near(stats['wallMs'], walls[side]); near(stats['cpuMs'], cpus[side])
            if overruns[side]:
                assert stats['moves'] == len(overruns[side])
                ordered_depths = sorted(int(depth) for depth, count in depths[side].items() for _ in range(count))
                assert stats['medianDepth'] == ordered_depths[(len(ordered_depths)-1)//2]
                near(stats['meanMoveMs'], walls[side]/len(overruns[side]))
                near(stats['evaluationsPerSecond'], evaluations[side]*1000/walls[side])
                ordered = sorted(overruns[side]); near(stats['p95OverrunMs'], ordered[math.floor((len(ordered)-1)*0.95)]); near(stats['maxOverrunMs'], ordered[-1])
        entry = {k: condition[k] for k in ['id', 'stage', 'candidate', 'opponent', 'budget', 'target', 'originalTarget']}
        if 'opponentDepth' in condition:
            entry['opponentDepth'] = condition['opponentDepth']
        evidence['conditions'].append({**entry, 'complete': n >= condition['target'], 'summary': summary, 'pairs': pairs})
    evidence['pairRowSchema'] = ['opening_index', 'first_game_candidate_outcome', 'second_game_candidate_outcome', 'first_game_black_margin', 'second_game_black_margin']
    evidence['pairTaskHashRoot'] = hashlib.sha256(json.dumps(task_hashes, separators=(',', ':')).encode()).hexdigest()
    evidence['data'], evidence['references'] = {}, {}
    for split, files in state['data'].items():
        seeds, samples = [], 0
        for file in files:
            for game in load(file)['games']:
                assert game['split'] == split
                seeds.append([game['index'], game['seed']]); samples += len(game['states'])
                for prefix in game['prefixes']:
                    published.add(canonical(prefix['board'], prefix['player']))
        assert len(seeds) == state['progress']['accepted'][split]
        evidence['data'][split] = {'games': len(seeds), 'retainedPositions': samples, 'acceptedIndexSeedPairs': seeds}
    for split, files in state['references'].items():
        entries = []
        for file in files:
            record = load(file); refs = record['references']
            entries.append({'artifact': Path(file).name, 'sha256': sha(file), 'empties': record['empties'], 'exactPositions': record['exactN'], 'exactMs': record['exactMs'], 'labelKinds': dict(Counter(r['kind'] for r in refs))})
            for ref in refs:
                published.add(canonical(ref['board'], ref['player']))
        evidence['references'][split] = entries
    evidence['models'] = {}
    for model_id, file in state['models'].items():
        model = load(file)
        evidence['models'][model_id] = {k: v for k, v in model.items() if k not in ['weights', 'predictionGains']}
        evidence['models'][model_id].update(parameterSlots=len(model['weights']), sha256=sha(file))
    evidence['training'] = {'rounds': state['training']['round'], 'perModelTaskWallMs': state['training']['trainingMs'], 'history': state['training']['history']}
    for section in ['assessments', 'confirmation']:
        evidence[section] = []
        for metric in results[section]:
            for quality in [*metric['exact'], metric['approximate']]:
                rows = quality['records']
                assert quality['positions'] == len(rows)
                assert quality['optimal'] == sum(row['regret'] == 0 for row in rows)
                if rows:
                    near(quality['meanRegret'], sum(row['regret'] for row in rows)/len(rows))
                correlations = [row['spearman'] for row in rows if row['spearman'] is not None]
                if correlations:
                    near(quality['meanSpearman'], sum(correlations)/len(correlations))
            clean = {k: v for k, v in metric.items() if k not in ['exact', 'approximate']}
            clean['exact'] = [{k: v for k, v in q.items() if k != 'records'} for q in metric['exact']]
            clean['approximate'] = {k: v for k, v in metric['approximate'].items() if k != 'records'}
            evidence[section].append(clean)
    evidence['ablations'] = load(run / 'ablations.json')
    evidence['diagnostics'] = load(run / 'diagnostics.json')
    evidence['publishedKeys'] = sorted(published)
    evidence['publicationNotes'] = ['Weights, complete game trajectories, logs and checkpoints remain local.', 'Accepted game index/seed pairs allow regeneration with generateGame() at the original framework commit.', 'Pair outcomes permit independent recomputation of W/D/L, scores, margins and the predefined intervals.', 'Published roots/reference boards must be added to exclusions before any future fresh-confirmation study; v1 does not automatically read this new report.', 'Task-wall totals overlap during parallel work; they are not independent process CPU totals.']
    assert all(t['startedMs'] >= state['freeze']['elapsedMs'] for name, t in state['tasks'].items() if 'confirmation' in name and t['status'] == 'complete')
    return evidence


def write_svg(e):
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="470" viewBox="0 0 1120 470">', '<rect width="1120" height="470" fill="white"/><style>text{font:14px sans-serif;fill:#222}.small{font-size:12px}.title{font-size:18px;font-weight:bold}</style>', '<text x="25" y="28" class="title">Independent late-game quality and paired timed confirmation</text>', '<text x="70" y="62">Exact disc regret at depth 3 (64 ten-empty positions)</text>', '<path d="M70 80 V355 H490" fill="none" stroke="#444"/>']
    for y in range(2, 6):
        py = 355 - (y-1.5)/4*250
        parts += [f'<path d="M65 {py} H490" stroke="#ddd"/><text x="42" y="{py+5}">{y}</text>']
    for x in [2, 3, 4]:
        px = 70 + (x-1.5)/3*400
        parts.append(f'<text x="{px}" y="378">{x}</text>')
    for m, color in zip(e['confirmation'], ['#1764ad', '#777777', '#b85018']):
        x = 70 + (m['cost']['microseconds']-1.5)/3*400
        y = 355 - (m['exact'][1]['meanRegret']-1.5)/4*250
        parts.append(f'<circle cx="{x}" cy="{y}" r="6" fill="{color}"/><text x="{x+10}" y="{y-8}">{escape(m["id"])}</text>')
    parts += ['<text x="100" y="406">Evaluation cost, microseconds (lower is cheaper)</text>', '<text x="70" y="431" class="small">Vertical: mean exact final-disc regret; lower is better.</text>', '<text x="620" y="62">Frozen add-stable vs B: opening-pair points</text>']
    xmap = lambda value: 620 + (value-0.2)/0.6*450
    parts += [f'<path d="M{xmap(.5)} 85 V335" stroke="#555" stroke-dasharray="5 5"/>', '<path d="M620 355 H1070" stroke="#444"/>']
    for x in [.2, .3, .4, .5, .6, .7, .8]:
        parts.append(f'<text x="{xmap(x)-12}" y="378">{x:.1f}</text>')
    for c, y in zip([c for c in e['conditions'] if c['stage']=='confirmation' and c['budget'].get('timeMs') in [80, 300]], [150, 270]):
        s = c['summary']; lo, hi = s['interval']; center = xmap(s['mean'])
        parts += [f'<text x="620" y="{y-32}">{c["budget"]["timeMs"]} ms; {s["pairs"]} opening pairs; {100*s["mean"]:.1f}%</text>', f'<path d="M{xmap(lo)} {y} H{xmap(hi)} M{xmap(lo)} {y-7} V{y+7} M{xmap(hi)} {y-7} V{y+7}" stroke="#b85018" stroke-width="2"/><circle cx="{center}" cy="{y}" r="6" fill="#b85018"/>']
    parts += ['<text x="620" y="406">Conservative simultaneous 95% intervals</text>', '<text x="620" y="431" class="small">512 possible conditions × all prefixes through 1,024 pairs.</text>', '<text x="25" y="458" class="small">Prediction and playing strength answer different questions. B remains the production evaluator.</text></svg>']
    return '\n'.join(parts) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('run', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1]/'docs/data/local-research-20261027.json')
    parser.add_argument('--figure', type=Path, default=Path(__file__).resolve().parents[1]/'docs/local-research-20261027.svg')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    e = snapshot(args.run)
    artifacts = {args.output: json.dumps(e, separators=(',', ':'), allow_nan=False)+'\n', args.figure: write_svg(e)}
    for path, text in artifacts.items():
        if args.check:
            assert path.read_text() == text, f'Published artifact differs: {path}'
        else:
            path.parent.mkdir(parents=True, exist_ok=True); path.write_text(text)
    print(('Verified' if args.check else 'Published'), sum(c['summary']['pairs'] for c in e['conditions']), 'opening pairs;', sum(c['summary']['games'] for c in e['conditions']), 'games; all W/D/L, interval, time, work, depth and deadline aggregates audited.')


if __name__ == '__main__':
    main()
