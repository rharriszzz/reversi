#!/usr/bin/env python3
"""Independent public path and opening-pair statistics audit, standard library."""
import argparse
import json
import math
from pathlib import Path
import statistics

DIRECTIONS = (-11, -10, -9, -1, 1, 9, 10, 11)

def children(board, player):
    box = [9] * 100
    for q, v in enumerate(board):
        box[11 + q // 8 * 10 + q % 8] = v
    result = {}
    for q in range(64):
        at = 11 + q // 8 * 10 + q % 8
        if box[at]:
            continue
        changed = []
        for step in DIRECTIONS:
            line = []
            cursor = at + step
            while box[cursor] == -player:
                line.append(cursor)
                cursor += step
            if box[cursor] == player:
                changed.extend(line)
        if changed:
            copy = box[:]
            for pos in changed + [at]:
                copy[pos] = player
            result[q] = [copy[11 + i // 8 * 10 + i % 8] for i in range(64)]
    return result

def cdf(t, df):
    # Independent numerical integration of Student density (Simpson).
    if t < 0:
        return 1 - cdf(-t, df)
    coefficient = math.exp(math.lgamma((df + 1)/2) - math.lgamma(df/2)) / math.sqrt(df*math.pi)
    n = 2000
    step = t/n
    def f(x):
        return coefficient * (1 + x*x/df)**(-(df+1)/2)
    total = f(0) + f(t)
    total += 4 * sum(f(i*step) for i in range(1, n, 2))
    total += 2 * sum(f(i*step) for i in range(2, n, 2))
    return .5 + total*step/3

def critical(df):
    low, high = 0, 5
    for _ in range(40):
        mid = (low + high)/2
        if cdf(mid, df) < .975:
            low = mid
        else:
            high = mid
    return (low+high)/2

def tail(t, df, n=65536):
    if t == 0:
        return .5
    if t < 0:
        return 1-tail(-t, df, n)
    if df == 1:
        return math.atan(1/t)/math.pi
    logc = math.lgamma((df+1)/2)-math.lgamma(df/2)-.5*math.log(df*math.pi)
    end = 1/t
    h = end/n
    def f(u):
        return 0 if u == 0 else math.exp(logc-(df+1)/2*math.log1p(1/(u*u*df))-2*math.log(u))
    return h/3*(f(end)+sum((4 if j%2 else 2)*f(j*h) for j in range(1,n)))

def verify(public, summary):
    assert public['registration'] == summary['registration']
    games = public['games']
    assert len(games) == 768
    seen = set()
    for game in games:
        key = game['family'], game['timeMs'], game['nativeColor']
        assert key not in seen
        seen.add(key)
        board, player = game['opening']['board'], game['opening']['player']
        passes = 0
        for move in game['moves']:
            assert player == move['player']
            legal = children(board, player)
            if move['move'] is None:
                assert not legal
                passes += 1
            else:
                board = legal[move['move']]
                passes = 0
            player = -player
            assert passes <= 2
        assert passes == 2 and board == game['board']
        margin = sum(board)*game['nativeColor']
        outcome = (margin > 0) - (margin < 0)
        assert game['margin'] == margin and game['outcome'] == outcome
        assert game['points'] == (1 + outcome)/2
    scores = {}
    for budget, count in ((80, 256), (300, 128)):
        pairs = []
        for family in range(count):
            pair = [g for g in games if g['timeMs'] == budget and g['family'] == family]
            assert len(pair) == 2 and {g['nativeColor'] for g in pair} == {-1, 1}
            assert pair[0]['opening'] == pair[1]['opening']
            pairs.append(statistics.mean(g['points'] for g in pair))
        scores[budget] = pairs
        mean = statistics.mean(pairs)
        se = statistics.stdev(pairs) / math.sqrt(count)
        radius = critical(count-1)*se
        expected = summary['statistics']['conditions'][str(budget)]
        assert abs(expected['mean'] - mean) < 1e-12
        assert abs(expected['standardError'] - se) < 1e-12
        if se and expected.get('pValueMethod') == 'positive survival density integral':
            value = tail((mean-.5)/se, count-1)
            assert math.isclose(expected['approximateOneSidedP'], value, rel_tol=1e-7, abs_tol=1e-300)
        for a, b in zip(expected['approximate95'], (max(0, mean-radius), min(1, mean+radius))):
            assert abs(a-b) < 1e-8
        panel = [g for g in games if g['timeMs'] == budget]
        for name, outcome in (('wins', 1), ('draws', 0), ('losses', -1)):
            assert expected[name] == sum(g['outcome'] == outcome for g in panel)
        assert abs(expected['meanMargin'] - statistics.mean(g['margin'] for g in panel)) < 1e-12
    differences = [b-a for a, b in zip(scores[80][:128], scores[300])]
    assert abs(summary['statistics']['matched']['mean'] - statistics.mean(differences)) < 1e-12
    return {'passed': True, 'games': 768, 'pairs80': 256, 'pairs300': 128,
            'independentRules': True, 'independentStudentIntegration': True,
            'positiveTailVerified': all(x.get('pValueMethod') == 'positive survival density integral' for x in summary['statistics']['conditions'].values())}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', nargs='?', type=Path, default=Path('.local-research/native-engine-20261030'))
    args = parser.parse_args()
    print(json.dumps(verify(json.loads((args.directory/'public-games.json').read_text()),
                            json.loads((args.directory/'summary.json').read_text()))))
