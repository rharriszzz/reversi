"""Check the twelve-root panel and disclosed root against the mailbox solver.

Correctness only. This reference has no production dependencies, TT or bitboard
ray algorithm. Never compare its runtime to production for performance claims.
"""
import hashlib
import json
import os
import subprocess
from pathlib import Path


def main():
    out = Path(os.environ['REVERSI_FLIP_RUN']).resolve()
    reference = out/'mailbox-exact'
    source = Path('scripts/fast-flips/pc-mailbox-exact.cpp')
    subprocess.run([os.environ.get('CXX', 'g++'), '-O3', '-std=c++17',
                    '-Wall', '-Wextra', '-Wpedantic', str(source), '-o', str(reference)], check=True)
    data = json.loads((out/'integrated-final.json').read_text())
    rows = []
    for panel in ['exact12', 'profile-root']:
        workload = next(w for w in data['workloads'] if w['id'] == panel+'-B')
        values = json.loads(subprocess.check_output([str(reference), workload['file']], text=True, timeout=600))
        assert len(values) == len(workload['positionIds'])
        for model in ['B', 'L', 'P']:
            row = next(r for r in data['rows'] if r['workload'] == panel+'-'+model)
            for tag, result in row['results'].items():
                for index, actual in enumerate(result['roots']):
                    expected = values[index % len(values)]['score']
                    assert actual['exact'] and actual['score'] == expected, (model, tag, index)
        rows.append({'panel': panel, 'positionIds': workload['positionIds'], 'references': values})
    receipt = {'passed': True, 'distinctRoots': 13, 'models': ['B', 'L', 'P'],
               'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'rows': rows,
               'method': 'Independent 10x10 sentinel mailbox exact alpha-beta, direct directional captures, no TT or production helper/evaluator. All timed fixed-call scores compared for every algorithm/model.'}
    (out/'mailbox-exact.json').write_text(json.dumps(receipt, indent=2)+'\n')
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
