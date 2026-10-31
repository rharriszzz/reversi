"""Serial closing regression suites, outside performance measurements."""
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path


def main():
    root = Path(__file__).resolve().parents[2]
    out = (root/os.environ['REVERSI_FLIP_RUN']).resolve()
    rows = []
    tasks = [
        ('node-regression', ['node', '--test', '--test-concurrency=1',
            *[str(p.relative_to(root)) for p in sorted((root/'tests').glob('*.test.mjs'))]], {}),
        ('node-sanitizers', ['node', '--test', '--test-concurrency=1',
            'tests/native-search.test.mjs', 'tests/native-v2.test.mjs', 'tests/mac-endgame.test.mjs'],
            {'NATIVE_SANITIZE': '1'}),
        ('python-regression', [sys.executable, '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py'], {}),
        ('mac-evidence-audit', [sys.executable, 'scripts/fast-flips/verify-public.py'], {})]
    for name, command, env in tasks:
        start = time.monotonic()
        path = out/(name+'.log')
        with path.open('w') as output:
            result = subprocess.run(command, cwd=root, env={**os.environ, **env},
                                    stdout=output, stderr=subprocess.STDOUT, timeout=900)
        lines = path.read_text()
        count = re.findall(r'(?:tests\s+(\d+)|Ran (\d+) tests)', lines)
        rows.append({'name': name, 'command': command, 'environment': env,
                     'returnCode': result.returncode, 'seconds': time.monotonic()-start,
                     'tests': next((int(a or b) for a, b in count), None),
                     'summary': lines.splitlines()[-12:]})
        (out/'pc-test-receipt.json').write_text(json.dumps({'passed': len(rows) == len(tasks) and all(r['returnCode'] == 0 for r in rows),
                                                         'rows': rows}, indent=2)+'\n')
        print(json.dumps(rows[-1]), flush=True)
        result.check_returncode()


if __name__ == '__main__':
    main()
