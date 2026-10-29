#!/usr/bin/env python3
"""Actual Darwin physical headroom, swap counters and executable occupancy."""
import json, re, subprocess, datetime

def sample():
    def run(*args):
        return subprocess.check_output(args, text=True)
    vm = run('vm_stat'); page = int(re.search(r'page size of (\d+)', vm)[1])
    counters = {k.strip(): int(v) for k,v in re.findall(r'^([^:\n]+):\s+(\d+)', vm, re.M)}
    available = sum(counters.get(k, 0) for k in ('Pages free','Pages inactive','Pages speculative')) * page / 2**30
    processes = run('ps','-axo','pid,ppid,%cpu,rss,comm')
    native = [x for x in processes.splitlines()[1:] if x.split(maxsplit=4)[-1].endswith('/mEdax-armv8-a')]
    safe = max(0, min(6, int((available-1.5)/.65)))
    return dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(), availableGiB=available,
                swap=run('sysctl','vm.swapusage').strip(), swapins=counters.get('Swapins'),swapouts=counters.get('Swapouts'),
                safeCap=safe, activeNativeSearches=len(native),native=native,processes=processes,
                disk=run('df','-k','.'),power=run('pmset','-g','custom'))
if __name__ == '__main__': print(json.dumps(sample()))
