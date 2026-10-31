"""Supplemental SOFTWARE cpu-clock IP sampling of unchanged measured binaries.

No stacks or per-call timers. The process-wide profile includes setup/warmup and
teardown; only repeated unprofiled complete batches decide performance. No cycle,
cache-miss, branch-misprediction or precise-IP claims follow from this data.
"""
import collections
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
from pathlib import Path


def main():
    out = Path(os.environ['REVERSI_FLIP_RUN']).resolve()
    local = Path('.local-research/windows-pc-20261030/perf-tools/usr/lib/linux-tools-5.15.0-202/perf')
    perf = shutil.which('perf') or str(local.resolve())
    data = json.loads((out/'integrated-final.json').read_text())
    captures = []
    for panel in ['profile-root', 'opening', 'middle']:
        w = next(w for w in data['workloads'] if w['id'] == panel+'-P')
        sample = next(r for r in data['rows'] if r['workload'] == w['id'])
        for tag in ['original', 'refined']:
            elapsed = sample['results'][tag]['wallSeconds']/w['repeats']
            repeat = math.ceil(4/elapsed)
            exe = out/tag/'fixed-work'
            raw = out/f'software-{panel}-{tag}.perf.data'
            assert not raw.exists(), 'Preserve existing capture'
            command = [perf, 'record', '-o', str(raw), '-e', 'cpu-clock:u',
                       '-F', '999', '--', str(exe), w['mode'], w['file'],
                       str(repeat), '2', '0']
            result = subprocess.run(command, text=True, capture_output=True, timeout=30, check=True)
            target = json.loads(result.stdout)
            # -D exposes LOST records; their absence is recorded separately from
            # any unknown kernel-side loss not reported by perf.
            dump = subprocess.run([perf, 'script', '-D', '-i', str(raw)], text=True,
                                  capture_output=True, check=True)
            lost = [line.strip() for line in dump.stdout.splitlines() if 'PERF_RECORD_LOST' in line]
            exported = subprocess.run([perf, 'script', '-i', str(raw), '-F',
                                       'event,ip,sym,dso'], text=True, capture_output=True, check=True)
            (out/f'software-{panel}-{tag}.perf.txt').write_text(exported.stdout)
            symbols = collections.Counter()
            unresolved = 0
            for line in exported.stdout.splitlines():
                match = re.match(r'\s*cpu-clock:u:\s+([0-9a-f]+)\s+(.*?)\s+\((.*)\)\s*$', line)
                if not match:
                    raise RuntimeError('Unexpected perf export: '+line)
                symbol = match[2]
                if symbol == '[unknown]':
                    unresolved += 1
                symbols[re.sub(r'\+0x[0-9a-f]+$', '', symbol)] += 1
            assert sum(symbols.values()) > 1000, 'Insufficient software samples'
            captures.append({'panel': panel, 'tag': tag, 'command': command,
                             'mechanism': 'Software cpu-clock user IP, requested 999 Hz, no stacks',
                             'binarySha256': hashlib.sha256(exe.read_bytes()).hexdigest(),
                             'rawSha256': hashlib.sha256(raw.read_bytes()).hexdigest(),
                             'samples': sum(symbols.values()), 'unresolved': unresolved,
                             'reportedLostRecords': lost, 'unknownUnreportedLoss': None,
                             'symbolCounts': dict(symbols), 'target': {k: v for k, v in target.items() if k != 'roots'},
                             'collectorStderr': result.stderr, 'exportStderr': exported.stderr})
    # run.py owns the output file; only stdout publishes the complete document.
    print(json.dumps({'captures': captures,
        'limitations': 'Software timer-triggered process-lifetime IPs, not hardware cycles or exact instruction latencies. No caller stacks or P/E-core identity; startup and teardown included. No profile percentages used as measured speedups.'}, indent=2))


if __name__ == '__main__':
    main()
