#!/usr/bin/env python3
"""Detach the dependency-free Node research coordinator from terminal/AI lifetime."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--mode', choices=['full', 'smoke'])
    parser.add_argument('--hours', type=float)
    parser.add_argument('--seconds', type=float)
    parser.add_argument('--workers', type=int)
    parser.add_argument('--seed', type=int)
    options = parser.parse_args()
    if options.hours is not None and options.seconds is not None:
        parser.error('choose --hours or --seconds')
    node = shutil.which('node')
    if not node:
        parser.error('Node 20+ is required for offline experiments')
    root = Path(__file__).resolve().parents[1]
    output = Path(options.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    command = [node, str(root / 'scripts/research.mjs'), '--output', str(output)]
    if options.resume:
        command.append('--resume')
    for name in ['mode', 'hours', 'seconds', 'workers', 'seed']:
        value = getattr(options, name)
        if value is not None:
            command += ['--' + name, str(value)]
    # nice is present on both supported Unix runtimes; no privileged operation.
    nice = shutil.which('nice')
    if nice:
        command = [nice, '-n', '10', *command]
    with (output / 'launcher.log').open('ab', buffering=0) as log:
        process = subprocess.Popen(command, cwd=root, stdin=subprocess.DEVNULL,
                                   stdout=log, stderr=subprocess.STDOUT,
                                   start_new_session=True, close_fds=True)
    # Require a durable checkpoint from THIS PID before reporting a start.
    # This also catches invalid arguments and live locks immediately.
    end = time.monotonic() + 15
    verified = False
    while time.monotonic() < end:
        manifest = output / 'manifest.json'
        if manifest.exists():
            state = json.loads(manifest.read_text())
            if state.get('sessions', [{}])[-1].get('pid') == process.pid:
                verified = True
                break
        code = process.poll()
        if code is not None:
            if code:
                print((output / 'launcher.log').read_text()[-4000:], file=sys.stderr)
                return code
            break
        time.sleep(0.05)
    if not verified:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=10)
        print('No startup checkpoint; see %s' % (output / 'launcher.log'), file=sys.stderr)
        return 1
    launch = {'pid': process.pid, 'command': command, 'output': str(output), 'launched': time.time()}
    # Coordinator manifest is authoritative; this file is only a launch receipt.
    receipt = output / ('launch-%s.json' % process.pid)
    receipt.write_text(json.dumps(launch, indent=2) + '\n')
    print('Started PID %s in an independent session.' % process.pid)
    print('Progress: %s' % (output / 'launcher.log'))
    print('Report:   %s' % (output / 'report.md'))
    print('Stop: kill -TERM %s ; resume with --resume and the same --output.' % process.pid)
    return 0


if __name__ == '__main__':
    sys.exit(main())
