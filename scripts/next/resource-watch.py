#!/usr/bin/env python3
"""Read-only host samples while one exact coordinator is alive; no control actions."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import time
spec = importlib.util.spec_from_file_location('strong_launch', Path(__file__).resolve().parents[1] / 'strong-launch.py')
launch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launch)
run = Path(sys.argv[1]).resolve()
output = run / 'resource-samples'
output.mkdir(exist_ok=True)
while True:
    state = json.loads((run / 'manifest.json').read_text())
    if state.get('status') != 'running':
        break
    try:
        os.kill(state['pid'], 0)
    except OSError:
        break
    record = launch.preflight(output)
    # The monitored coordinator is expected. Preserve the full raw assessment,
    # but do not interpret that duplicate-run guard as a resource failure.
    record['monitoringPid'] = state['pid']
    with (run / 'resources.jsonl').open('a') as stream:
        stream.write(json.dumps(record) + '\n')
    time.sleep(60)
