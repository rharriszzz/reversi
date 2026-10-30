"""Persistent Python 3 native client; build once with node scripts/native/build.mjs.

One client per serial research worker. close() cancels the current native process;
create a new client to resume. Calls perform entire searches in C++.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[2]

class NativeEngine:
    def __init__(self, receipt=None, tt_mib=16):
        self.receipt = json.loads(Path(receipt or ROOT / '.local-research/native/build.json').read_text())
        executable = Path(self.receipt['executable'])
        if hashlib.sha256(executable.read_bytes()).hexdigest() != self.receipt['executableSha256']:
            raise ValueError('Native executable identity changed')
        if not isinstance(tt_mib, int) or not 0 <= tt_mib <= 1024:
            raise ValueError('TT must be 0..1024 MiB')
        self.process = subprocess.Popen([str(executable), str(tt_mib)], stdin=subprocess.PIPE,
                                        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
        self.counter = 0
        hello = self.request('hello')
        if hello['models'] != list(self.receipt['models'].values()):
            self.close()
            raise ValueError('Native model identity mismatch')

    def request(self, command):
        self.counter += 1
        start = time.monotonic()
        self.process.stdin.write(f'{self.counter} {command}\n')
        self.process.stdin.flush()
        line = self.process.stdout.readline()
        if not line:
            raise RuntimeError('Native process exited')
        row = json.loads(line)
        if row['id'] != self.counter or 'error' in row:
            raise RuntimeError(row.get('error', 'Wrong response identity'))
        row['interfaceMs'] = (time.monotonic() - start) * 1000
        return row

    def search(self, board, player, *, model='P', depth=14, time_ms=None):
        if len(board) != 64 or any(v not in (-1, 0, 1) for v in board) or player not in (-1, 1):
            raise ValueError('Invalid board/player')
        if model not in ('B', 'L', 'P') or not isinstance(depth, int) or not 1 <= depth <= 14:
            raise ValueError('Invalid model/depth')
        import math
        if time_ms is not None and (not math.isfinite(time_ms) or time_ms <= 0):
            raise ValueError('Invalid time budget')
        deadline = 0 if time_ms is None else time.time() * 1000 + time_ms
        black = sum(1 << q for q, v in enumerate(board) if v == 1)
        white = sum(1 << q for q, v in enumerate(board) if v == -1)
        result = self.request(f'search {black:x} {white:x} {player} {("B", "L", "P").index(model)} {depth} {time_ms or 0} 1 1 0 {deadline}')
        if result['modelIdentity'] != self.receipt['models'][model]:
            raise RuntimeError('Wrong native model')
        return dict(result, backend='native', buildIdentity=self.receipt['fingerprint'])

    def close(self):
        if self.process.poll() is None:
            self.process.terminate()
        self.process.communicate(timeout=5)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
