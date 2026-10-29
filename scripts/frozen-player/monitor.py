#!/usr/bin/env python3
"""Run one bounded command with a temporary keep-awake assertion and telemetry."""
import json, subprocess, sys, time
from pathlib import Path
from resources import sample

path = Path(sys.argv[1]); path.parent.mkdir(parents=True, exist_ok=True)
command = sys.argv[2:]
with path.open('a', buffering=1) as log:
    start = time.monotonic()
    child = subprocess.Popen(['caffeinate', '-i', '-s', *command])
    try:
        while True:
            value = sample()
            value.update(command=command, pid=child.pid, wallSeconds=time.monotonic()-start)
            log.write(json.dumps(value)+'\n')
            code = child.poll()
            if code is not None:
                break
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                pass
    except BaseException:
        child.terminate()
        child.wait()
        raise
sys.exit(code)
