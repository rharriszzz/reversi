"""Offline symbol-offset/assembly mapping for existing software captures.

Does not collect samples or rerun the target. Preserve raw files in ignored
storage. Sampled RIP attribution is not an instruction-latency measurement.
"""
import collections
import hashlib
import json
import os
import re
import shutil
import subprocess
from pathlib import Path


def main():
    out = Path(os.environ['REVERSI_FLIP_RUN']).resolve()
    data = json.loads((out/'software-profiles.json').read_text())
    assembly = json.loads((out/'assembly.json').read_text())
    local = Path('.local-research/windows-pc-20261030/perf-tools/usr/lib/linux-tools-5.15.0-202/perf')
    perf = shutil.which('perf') or str(local.resolve())
    for capture in data['captures']:
        raw = out/f"software-{capture['panel']}-{capture['tag']}.perf.data"
        assert hashlib.sha256(raw.read_bytes()).hexdigest() == capture['rawSha256']
        text = subprocess.check_output([perf, 'script', '-i', str(raw), '-F',
                                        'event,ip,sym,symoff,dso'], text=True)
        assert len(text.splitlines()) == capture['samples']
        counts = collections.Counter()
        ips = collections.defaultdict(collections.Counter)
        for line in text.splitlines():
            match = re.match(r'\s*cpu-clock:u:\s+([0-9a-f]+)\s+reversi::flips\+0x([0-9a-f]+)\s+\(', line)
            if match:
                offset = int(match[2], 16)
                counts[offset] += 1
                ips[offset][match[1]] += 1
        assert sum(counts.values()) == capture['symbolCounts']['reversi::flips']
        function = next(r for r in assembly['rows'] if r['tag'] == capture['tag'])['functions']['flips']
        instructions = {i['offset']: i for i in function['instructions']}
        capture['flipInstructionSamples'] = [{
            'offset': offset, 'samples': count, 'rawIps': dict(ips[offset]),
            'assembly': instructions.get(offset), 'withinSymbol': 0 <= offset < function['bytes']
        } for offset, count in counts.most_common()]
        assert all(r['withinSymbol'] for r in capture['flipInstructionSamples'])
    (out/'software-profiles.json').write_text(json.dumps(data, indent=2)+'\n')
    print(json.dumps({'passed': True, 'captures': len(data['captures']),
                      'flipSamples': sum(sum(i['samples'] for i in c['flipInstructionSamples']) for c in data['captures'])}))


if __name__ == '__main__':
    main()
