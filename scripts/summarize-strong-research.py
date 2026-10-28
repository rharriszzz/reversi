#!/usr/bin/env python3
"""Audit completed v2 evidence and publish a compact report; never run research.

Standard-library auditing; optional --plots uses matplotlib only for exported
figures. Raw checkpoints, data and weights are read-only and stay local.
"""
import argparse
from collections import Counter
from datetime import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import statistics

ROOT = Path(__file__).resolve().parents[1]
STEM = 'strong-evaluator-20261028'
EXPECTED = {20: 16, 80: 256, 300: 128}


def read(path):
    return json.loads(Path(path).read_bytes())


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def close(a, b):
    assert math.isclose(a, b, rel_tol=1e-10, abs_tol=1e-8), (a, b)


def children(board, player):
    """Independent Python rules, deliberately importing no production engine."""
    result = []
    for move, value in enumerate(board):
        if value:
            continue
        row, col = divmod(move, 8)
        flips = []
        for dr, dc in [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]:
            r, c = row + dr, col + dc
            line = []
            while 0 <= r < 8 and 0 <= c < 8 and board[r * 8 + c] == -player:
                line.append(r * 8 + c)
                r, c = r + dr, c + dc
            if line and 0 <= r < 8 and 0 <= c < 8 and board[r * 8 + c] == player:
                flips.extend(line)
        if flips:
            after = list(board)
            after[move] = player
            for square in flips:
                after[square] = player
            result.append((move, after))
    return result


def replay(opening, game):
    board, player, passes, moves = list(opening['board']), opening['player'], 0, Counter()
    for step in game['moves']:
        assert passes < 2 and step['player'] == player
        legal = dict(children(board, player))
        if step['move'] is None:
            assert not legal, 'Illegal pass'
            passes += 1
        else:
            assert step['move'] in legal, 'Illegal move'
            board, passes = legal[step['move']], 0
            moves['black' if player == 1 else 'white'] += 1
        player = -player
    assert passes == 2 and not children(board, 1) and not children(board, -1)
    margin = sum(board)
    assert game['margin'] == margin
    assert game['winner'] == (margin > 0) - (margin < 0)
    assert game['outcome'] == game['winner'] * game['candidateColor']
    for color in ['black', 'white']:
        assert len(game['stats'][color]) == moves[color]
    return board


def audit_pair(pair, index, budget):
    assert pair['index'] == index and pair['budget'] == budget
    assert [g['candidateColor'] for g in pair['games']] == ([1, -1] if index % 2 == 0 else [-1, 1])
    for game in pair['games']:
        replay(pair['opening'], game)
        for rows in game['stats'].values():
            for row in rows:
                assert 0 <= row['depth'] <= 14 and row['nodes'] >= row['evaluations'] >= 0
                assert row['wallMs'] >= 0 and row['overrunMs'] >= 0
                assert row['fallback'] == (row['depth'] == 0)
    point = sum(1 if g['outcome'] > 0 else .5 if g['outcome'] == 0 else 0 for g in pair['games']) / 2
    close(point, pair['point'])
    return point


def validate_complete(state):
    assert state['status'] == 'complete' and state['stage'] == 'done'
    assert not state['config']['smoke'] and not state['config']['pilot'] and not state['failures']
    final = [c for c in state['conditions'] if c['stage'] == 'confirmation']
    assert len(final) == 3 and {c['budget']['timeMs'] for c in final} == set(EXPECTED)
    for c in final:
        target = EXPECTED[c['budget']['timeMs']]
        assert c['candidateId'] == state['freeze']['id'] and c['candidate'] == state['freeze']['path']
        assert c['target'] == target == len(c['tasks']) == len(set(c['tasks']))
        assert state['freeze']['targets'][str(c['budget']['timeMs'])] == target


def timing(rows):
    depth = Counter(r['depth'] for r in rows)
    wall = sum(r['wallMs'] for r in rows)
    overruns = sorted(r['overrunMs'] for r in rows)
    return {'moves': len(rows), 'depthHistogram': dict(sorted(depth.items())),
            'medianDepth': statistics.median(r['depth'] for r in rows) if rows else None,
            'nodes': sum(r['nodes'] for r in rows), 'evaluations': sum(r['evaluations'] for r in rows),
            'wallMs': wall, 'evaluationsPerSecond': sum(r['evaluations'] for r in rows) / (wall / 1000) if wall else None,
            'p95OverrunMs': overruns[int(.95 * (len(overruns) - 1))] if rows else None,
            'maxOverrunMs': max(overruns) if rows else None, 'fallbacks': sum(r['fallback'] for r in rows)}


def metric(m):
    return {**{k: m[k] for k in ['id', 'speed']},
            'prediction': {k: v for k, v in m['prediction'].items() if k != 'byPolicy'},
            'outcomePrediction': m.get('outcomePrediction'),
            'ranking': {k: v for k, v in m['ranking'].items() if k != 'records'},
            'depth3': {k: v for k, v in m['depth3'].items() if k != 'records'} if m.get('depth3') else None}


def verify_extension(run, state):
    events = state.get('budgetExtensions', [])
    for event in events:
        backup = Path(event['backup'])
        assert sha(backup) == event['priorManifestSha256']
        old = read(backup)
        assert old['status'] == 'stopped' and old['stage'] == 'confirmation'
        assert old['elapsedMs'] >= event['oldBudgetMs']
        assert state['config']['budgetMs'] == event['newBudgetMs']
        assert event['newBudgetMs'] - event['oldBudgetMs'] == event['addedMinutes'] * 60000
        for key in ['source', 'freeze', 'data', 'labels', 'models', 'best', 'openings', 'protocol', 'counts']:
            assert state[key] == old[key], key
        for c in old['conditions']:
            current = next(n for n in state['conditions'] if n['id'] == c['id'])
            assert current['target'] == c['target'] and current['candidate'] == c['candidate']
            assert current['tasks'][:len(c['tasks'])] == c['tasks']
        assert sha(run / 'selection-freeze.json') == event['selectionFreezeSha256']
        assert sha(state['freeze']['path']) == event['modelSha256']


def exact(board, player, alpha=-65, beta=65):
    moves = children(board, player)
    if not moves:
        return -exact(board, -player, -beta, -alpha) if children(board, -player) else sum(board) * player
    value = -65
    for _, after in moves:
        value = max(value, -exact(after, -player, -beta, -alpha))
        alpha = max(alpha, value)
        if alpha >= beta:
            break
    return value


def verify_diagnostics(diagnostics):
    for ref in diagnostics['positions']:
        assert sum(v == 0 for v in ref['board']) <= 8
        values = {move: -exact(after, -ref['player']) for move, after in children(ref['board'], ref['player'])}
        assert values == {r['move']: r['margin'] for r in ref['rows']}
        for name in ['baseline', 'candidate']:
            c, board, player, used_first = ref[name], list(ref['board']), ref['player'], False
            for step in c['line']:
                legal = dict(children(board, player))
                if step == 'pass':
                    assert not legal and children(board, -player)
                else:
                    move = (int(step[1]) - 1) * 8 + ord(step[0]) - ord('A')
                    if not used_first:
                        assert move == c['move']
                        used_first = True
                    board = legal[move]
                player = -player
            assert not children(board, 1) and not children(board, -1)
            assert board == c['terminal'] and sum(board) * ref['player'] == c['margin'] == values[c['move']]


def canonical(board, player):
    variants = []
    for mirror in [False, True]:
        for turns in range(4):
            cells = [''] * 64
            for i, v in enumerate(board):
                r, c = divmod(i, 8)
                if mirror:
                    c = 7 - c
                for _ in range(turns):
                    r, c = c, 7 - r
                cells[r * 8 + c] = str(v * player + 1)
            variants.append(''.join(cells))
    return min(variants)


def sample_history(history, limit=160):
    compact = []
    for model in sorted({r['id'] for r in history}):
        rows = [r for r in history if r['id'] == model]
        selected = {round(i * (len(rows) - 1) / max(1, limit - 1)) for i in range(min(limit, len(rows)))}
        selected.add(min(range(len(rows)), key=lambda i: rows[i]['mse']))
        selected.update(i for i, r in enumerate(rows) if 'ranking' in r)
        for i in sorted(selected):
            r = rows[i]
            out = {k: r[k] for k in ['id', 'epoch', 'mse', 'totalPositions', 'generatedPositions', 'totalCpuMs']}
            if 'ranking' in r:
                out['ranking'] = {k: v for k, v in r['ranking'].items() if k != 'records'}
            compact.append(out)
    return compact


def snapshot(run):
    state, results = read(run / 'manifest.json'), read(run / 'results.json')
    validate_complete(state)
    assert results['status'] == state['status'] and results['source'] == state['source']
    assert results['config'] == state['config'] and len(results['conditions']) == len(state['conditions'])
    verify_extension(run, state)
    receipts = {v['path']: v for v in state['tasks'].values()}
    evidence = {k: state[k] for k in ['version', 'source', 'git', 'config', 'elapsedMs', 'cpuMs', 'updated', 'counts', 'allocation', 'sessions', 'budgetExtensions', 'protocol', 'exclusionAudit']}
    evidence['format'] = 'strong-research-publication-v1'
    evidence['conditions'], published = [], {p['key'] for roots in state['openings'].values() for p in roots}
    for c, recorded in zip(state['conditions'], results['conditions']):
        assert c['id'] == recorded['id'] and c['attempts'] == len(c['tasks']) + c['rejected']
        points, outcomes, margins, pairs = [], Counter(), [], []
        rows = {'candidate': [], 'B': []}
        for index, path in enumerate(c['tasks']):
            pair = read(path)
            points.append(audit_pair(pair, index, c['budget']))
            if c['stage'] == 'confirmation':
                assert receipts[path]['startedMs'] >= state['freeze']['elapsedMs']
            pair_outcomes = []
            for game in pair['games']:
                outcome = game['outcome']
                outcomes['wins' if outcome > 0 else 'losses' if outcome < 0 else 'draws'] += 1
                pair_outcomes.append(outcome)
                margins.append(game['margin'] * game['candidateColor'])
                candidate_color = 'black' if game['candidateColor'] == 1 else 'white'
                for color, stats in game['stats'].items():
                    rows['candidate' if color == candidate_color else 'B'].extend(stats)
            pairs.append([pair['index'], points[-1], pair_outcomes])
        mean = statistics.mean(points)
        radius = math.sqrt(math.log(80 if c['stage'] == 'confirmation' else 40) / (2 * len(points)))
        bounds = [max(0, mean - radius), min(1, mean + radius)]
        close(mean, recorded['summary']['mean'])
        assert len(points) == recorded['summary']['n'] == c['target']
        for a, b in zip(bounds, recorded['summary']['interval']):
            close(a, b)
        for key in ['wins', 'draws', 'losses']:
            assert outcomes[key] == recorded[key]
        evidence['conditions'].append({k: c[k] for k in ['id', 'stage', 'candidateId', 'budget', 'target', 'attempts', 'rejected']} |
                                     {'pairs': len(points), 'points': mean, 'interval': bounds, **dict(outcomes), 'meanMargin': statistics.mean(margins),
                                      'pairRows': pairs, 'metrics': {side: timing(v) for side, v in rows.items()}})
    final = [c for c in evidence['conditions'] if c['stage'] == 'confirmation' and c['budget']['timeMs'] in [80, 300]]
    evidence['primaryComplete'] = True
    evidence['evidenceForImprovement'] = all(c['interval'][0] > .5 for c in final)
    assert results['primaryComplete'] and results['evidenceForImprovement'] == evidence['evidenceForImprovement']
    evidence['freeze'] = state['freeze'] | {'modelSha256': sha(state['freeze']['path'])}
    evidence['latest'] = [metric(m) for m in results['latest']]
    evidence['confirmation'] = [metric(m) for m in results['confirmation']['metrics']]
    evidence['best'] = {key: {**v, 'sha256': sha(v['path'])} for key, v in state['best'].items()}
    evidence['history'] = sample_history(state['history'])
    evidence['historySampling'] = {'originalRows': len(state['history']), 'publishedRows': len(evidence['history']),
                                   'method': 'at most 160 regularly spaced rows/model, plus each minimum-MSE and every cycle ranking checkpoint'}
    evidence['modelSeen'] = state['modelSeen']
    evidence['fittingTasks'] = sum(t['type'] == 'fit' for t in state['tasks'].values())
    fit_spans, task_spans, exposures, preferences = 0, 0, 0, 0
    for task in state['tasks'].values():
        if task['type'] != 'fit':
            continue
        fitted = read(task['path'])
        fit_spans += fitted['curve'][-1]['fitMs']
        task_spans += task['wallMs']
        exposures += fitted['examples'] * len(fitted['curve'])
        preferences += fitted['preferencePairs'] * len(fitted['curve'])
    evidence['fittingWork'] = {'summedWorkerFitMs': fit_spans, 'summedTaskWallMs': task_spans,
                               'positionEpochExposures': exposures, 'preferenceEpochExposures': preferences,
                               'interpretation': 'Worker spans overlap and include encoding, updates and development prediction; neither spans nor category CPU isolate pure optimizer CPU.'}
    evidence['diagnostics'] = read(run / 'diagnostics.json')
    verify_diagnostics(evidence['diagnostics'])
    evidence['data'], evidence['labels'] = {}, {}
    for split, paths in state['data'].items():
        games = positions = 0
        policies, depths = Counter(), Counter()
        for path in paths:
            shard = read(path)
            games += len(shard['games'])
            for game in shard['games']:
                positions += len(game['states'])
                policies[game['policy']['black']] += 1
                policies[game['policy']['white']] += 1
                depths[game['policy']['depth']] += 1
        evidence['data'][split] = {'shards': len(paths), 'games': games, 'positions': positions, 'rawAttempts': state['next'][split],
                                   'colorPolicies': dict(policies), 'depths': dict(depths)}
    for split, paths in state['labels'].items():
        exact_sizes, kinds, skips, rejected = Counter(), Counter(), 0, 0
        for path in paths:
            shard = read(path)
            skips += len(shard.get('skipped', [])); rejected += shard.get('rejectedForLeakage', 0)
            for ref in shard['labels']:
                kinds[ref['kind']] += 1
                if ref['kind'] == 'exact':
                    exact_sizes[sum(v == 0 for v in ref['board'])] += 1
                if split != 'train':
                    published.add(canonical(ref['board'], ref['player']))
                    for _, child in children(ref['board'], ref['player']):
                        published.add(canonical(child, -ref['player']))
        evidence['labels'][split] = {'kinds': dict(kinds), 'exactEmptyCounts': dict(exact_sizes), 'skippedExact': skips, 'rejectedForLeakage': rejected}
    assert evidence['data']['train']['games'] == state['counts']['trainGames']
    assert evidence['data']['train']['positions'] == state['counts']['positions']
    assert evidence['labels']['train']['kinds']['exact'] == state['counts']['exact']
    assert evidence['labels']['train']['kinds']['search'] == state['counts']['search']
    assert sum(d['rawAttempts'] - d['games'] for d in evidence['data'].values()) == state['counts']['rejected']
    evidence['publishedKeys'] = sorted(published)
    evidence['rawHashes'] = {name: sha(run / name) for name in ['manifest.json', 'results.json', 'selection-freeze.json', 'confirmation-assessment.json', 'diagnostics.json', 'budget-extension-30-minutes.json']}
    evidence['checkpointCaveat'] = 'stoppingReason retains the first timeout; status=complete, stage=done and all fixed counts establish final completion'
    return evidence


def plot(e, destination):
    os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.local-research/reporting-mpl-cache'))
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    matplotlib.rcParams.update({'svg.hashsalt': STEM, 'font.size': 9})
    models = sorted({r['id'] for r in e['history']})
    colors = {name: plt.cm.tab20(i / 20) for i, name in enumerate(models)}
    fig, axes = plt.subplots(2, 2, figsize=(13, 9), constrained_layout=True)
    for name in models:
        rows = [r for r in e['history'] if r['id'] == name]
        outcome = '-outcome-' in name
        for column, key in enumerate(['totalPositions', 'totalCpuMs']):
            ax = axes[int(outcome)][column]
            ax.plot([r[key] / (1000 if column == 0 else 3600000) for r in rows], [r['mse'] for r in rows], label=name, color=colors[name], linewidth=1)
    for i, row in enumerate(axes):
        for j, ax in enumerate(row):
            ax.set(xlabel='Fitted unique outcome positions (thousands)' if j == 0 else 'Campaign CPU hours through checkpoint', ylabel='Development MSE', title=('Outcome target' if i else 'Margin target / ranking anchor') + (' vs data' if j == 0 else ' vs computation'))
            ax.grid(alpha=.2)
        row[1].legend(fontsize=7, loc='upper right')
    fig.suptitle('Learning curves: targets separated; sampled epoch rows, not playing strength')
    fig.savefig(destination / f'{STEM}-learning.svg', metadata={'Date': None}); plt.close(fig)
    fig, axes = plt.subplots(2, 2, figsize=(13, 9), constrained_layout=True)
    ax = axes[0, 0]
    for name in models:
        rows = [r for r in e['history'] if r['id'] == name and 'ranking' in r]
        ax.plot([r['totalPositions'] / 1000 for r in rows], [r['ranking']['exact']['pairAccuracy'] for r in rows], color=colors[name], label=name)
    ax.set(xlabel='Cumulative fitted outcome positions (thousands)', ylabel='Exact pairwise accuracy', title='Best available development checkpoints by cycle'); ax.grid(alpha=.2)
    ax = axes[0, 1]
    metrics = [m for m in e['latest'] if '-outcome-' not in m['id']]
    for m in metrics:
        color = 'black' if m['id'] == 'B' else colors[m['id']]
        ax.scatter(m['speed']['microseconds'], m['ranking']['exact']['regret'], color=color)
        ax.annotate(m['id'], (m['speed']['microseconds'], m['ranking']['exact']['regret']), fontsize=7, xytext=(3, 3), textcoords='offset points')
    ax.set(xlabel='Complete static evaluation (microseconds)', ylabel='Exact disc regret at depth 1', title='Development quality/cost: margin and ranking models'); ax.grid(alpha=.2)
    ax = axes[1, 0]
    for m in e['latest']:
        if '-outcome-' in m['id']:
            continue
        ax.plot([1, 2, 3, 4], [p['mse'] for p in m['prediction']['byPhase']], label=m['id'], color='black' if m['id'] == 'B' else colors[m['id']])
    ax.set(xlabel='Common phase bucket (boundaries 28/40/52 occupied)', ylabel='Margin-target development MSE', title='Opening-to-endgame errors'); ax.set_xticks([1, 2, 3, 4]); ax.grid(alpha=.2)
    ax = axes[1, 1]
    conditions = sorted([c for c in e['conditions'] if c['stage'] == 'confirmation'], key=lambda c: c['budget']['timeMs'])
    means = [c['points'] for c in conditions]
    ax.errorbar([c['budget']['timeMs'] for c in conditions], means, yerr=[[v - c['interval'][0] for v, c in zip(means, conditions)], [c['interval'][1] - v for v, c in zip(means, conditions)]], marker='o', capsize=4)
    ax.axhline(.5, color='black', linestyle='--'); ax.set_ylim(0, 1)
    for c in conditions:
        ax.annotate(f"n={c['pairs']} pairs", (c['budget']['timeMs'], c['points']), xytext=(5, 10), textcoords='offset points')
    ax.set(xlabel='Milliseconds per move', ylabel='Candidate points vs B', title='Fixed confirmation; 80/300 ms primary, 20 ms descriptive'); ax.grid(alpha=.2)
    fig.legend(*axes[0, 0].get_legend_handles_labels(), loc='lower center', bbox_to_anchor=(.5, -.10), ncol=4, fontsize=7)
    fig.suptitle('Architecture, phase and independent game comparisons; development is exploratory')
    fig.savefig(destination / f'{STEM}-comparison.svg', metadata={'Date': None}, bbox_inches='tight'); plt.close(fig)
    # Matplotlib emits trailing spaces inside multiline path attributes.
    # Preserve geometry while keeping generated artifacts clean in Git diffs.
    for path in destination.glob(f'{STEM}-*.svg'):
        path.write_text('\n'.join(line.rstrip() for line in path.read_text().splitlines()) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('run', type=Path)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--plots', action='store_true')
    args = parser.parse_args()
    evidence = snapshot(args.run.resolve())
    target = ROOT / 'docs/data' / (STEM + '.json')
    content = json.dumps(evidence, indent=2, sort_keys=True) + '\n'
    if args.check:
        assert target.read_text() == content, 'Publication differs from raw evidence'
        print('Verified publication against independent game replay, raw checkpoints and fixed targets.')
    else:
        target.write_text(content)
        if args.plots:
            plot(evidence, ROOT / 'docs')
        print('Published', target)


if __name__ == '__main__':
    main()
