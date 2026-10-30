#!/usr/bin/env python3
"""Matched, complete-task Reversi benchmark. Standard library only; no campaigns."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
import signal
import shutil
import statistics
import subprocess
import sys

if sys.version_info < (3, 13):
    raise SystemExit("Reversi requires Python 3.13 or newer")
os.environ["REVERSI_PYTHON"] = sys.executable
import threading
import time
from setup import setup

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
KINDS = ['edax10', 'edax12', 'B', 'exact', 'linear', 'pattern']
sha = lambda data: hashlib.sha256(data).hexdigest()


def read(path):
    return json.loads(Path(path).read_text())


def atomic(path, value):
    path = Path(path)
    temporary = path.with_suffix('.tmp')
    with temporary.open('w') as stream:
        json.dump(value, stream, separators=(',', ':'))
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(path)


def command(args, timeout=25):
    try:
        r = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
        return dict(code=r.returncode, stdout=r.stdout.strip(), stderr=r.stderr.strip()[:1000])
    except (OSError, subprocess.TimeoutExpired) as e:
        return dict(error=str(e))


def windows():
    powershell = shutil.which('powershell.exe')
    if not powershell:
        return None
    response = command([powershell, '-NoProfile', '-NonInteractive', '-Command',
        '$o=Get-CimInstance Win32_OperatingSystem; $m=Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory; '
        '$c=Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name=\'_Total\'"; '
        '@{availableBytes=1024*$o.FreePhysicalMemory;totalBytes=1024*$o.TotalVisibleMemorySize;'
        'cpuPercent=$c.PercentProcessorTime;pageReadsPerSec=$m.PageReadsPerSec;pageWritesPerSec=$m.PageWritesPerSec} | ConvertTo-Json -Compress'])
    try:
        return json.loads(response['stdout'])
    except (KeyError, ValueError):
        return dict(unavailable=response)


def memory():
    if Path('/proc/meminfo').exists():
        m = {s.split(':')[0]: int(s.split()[1]) * 1024 for s in Path('/proc/meminfo').read_text().splitlines()}
        paging = {s.split()[0]: int(s.split()[1]) for s in Path('/proc/vmstat').read_text().splitlines() if s.startswith(('pswpin ', 'pswpout '))}
        return dict(availableBytes=m['MemAvailable'], swapUsedBytes=m['SwapTotal'] - m['SwapFree'], paging=paging)
    vm = command(['vm_stat'])
    text = vm.get('stdout', '')
    import re
    page = re.search(r'page size of (\d+)', text)
    fields = {k.strip(): int(v.replace('.', '')) for k, v in re.findall(r'^([^:\n]+):\s+(\d+)\.', text, re.M)}
    available = sum(fields.get(k, 0) for k in ['Pages free', 'Pages inactive', 'Pages speculative']) * int(page[1]) if page else None
    return dict(availableBytes=available, paging={k: fields.get(k) for k in ['Swapins', 'Swapouts']},
                swapUsage=command(['sysctl', '-n', 'vm.swapusage']), vmStat=vm,
                note='macOS free+inactive+speculative is an estimate; compressed/purgeable memory is not available RAM')


def process_tree():
    response = command(['ps', '-axo', 'pid=,ppid=,rss=,comm='])
    rows = []
    for line in response.get('stdout', '').splitlines():
        parts = line.split(None, 3)
        if len(parts) == 4:
            try:
                rows.append(dict(pid=int(parts[0]), ppid=int(parts[1]), rssBytes=int(parts[2]) * 1024, name=parts[3]))
            except ValueError:
                pass
    descendants = {os.getpid()}
    while True:
        added = {r['pid'] for r in rows if r['ppid'] in descendants} - descendants
        if not added:
            break
        descendants |= added
    return [r for r in rows if r['pid'] in descendants]


def percentile(xs, q):
    xs = sorted(xs)
    if not xs:
        return None
    p = (len(xs) - 1) * q
    lo = int(p)
    return xs[lo] + (xs[min(lo + 1, len(xs) - 1)] - xs[lo]) * (p - lo)


def distribution(xs):
    return dict(n=len(xs), median=statistics.median(xs), minimum=min(xs), maximum=max(xs),
                mean=statistics.mean(xs), stdev=statistics.stdev(xs) if len(xs) > 1 else 0,
                cv=statistics.stdev(xs) / statistics.mean(xs) if len(xs) > 1 and statistics.mean(xs) else 0)


class Sampler:
    def __init__(self, path, active):
        self.path, self.active, self.rows, self.stop_event = path, active, [], threading.Event()
        self.pressure = threading.Event()
        self.thread = threading.Thread(target=self.run, daemon=True)

    def run(self):
        with self.path.open('w') as stream:
            while not self.stop_event.is_set():
                start = time.monotonic()
                tree = process_tree()
                probe = time.monotonic()
                subprocess.run([sys.executable, '-c', 'pass'], stdout=subprocess.DEVNULL, check=True)
                row = dict(at=time.time(), activeTasks=len(self.active), nativeSearches=sum('Edax-' in r['name'] for r in tree),
                           treeRssBytes=sum(r['rssBytes'] for r in tree), memory=memory(),
                           probeMs=1000 * (time.monotonic() - probe), load=os.getloadavg())
                self.rows.append(row)
                if row['memory'].get('availableBytes') is not None and row['memory']['availableBytes'] < 768 * 2**20:
                    self.pressure.set()
                if len(self.rows) > 1:
                    old = self.rows[-2]
                    a, b = old['memory'].get('paging', {}), row['memory'].get('paging', {})
                    delta = sum(b[k] - a[k] for k in a if a[k] is not None and b.get(k) is not None)
                    if delta > 256 * max(.001, row['at'] - old['at']):
                        self.pressure.set()
                stream.write(json.dumps(row) + '\n')
                stream.flush()
                self.stop_event.wait(max(.01, 1 - (time.monotonic() - start)))

    def finish(self):
        self.stop_event.set()
        self.thread.join()
        rows = self.rows
        first, last = rows[0]['memory'], rows[-1]['memory']
        a, b = first.get('paging', {}), last.get('paging', {})
        return dict(samples=len(rows), peakTreeRssBytes=max(r['treeRssBytes'] for r in rows),
                    minAvailableBytes=min((r['memory']['availableBytes'] for r in rows if r['memory']['availableBytes'] is not None), default=None),
                    pagingDelta={k: b[k] - a[k] for k in a if a[k] is not None and b.get(k) is not None},
                    swapBefore=first.get('swapUsedBytes', first.get('swapUsage')), swapAfter=last.get('swapUsedBytes', last.get('swapUsage')),
                    sampledMeanActiveTasks=statistics.mean(r['activeTasks'] for r in rows),
                    sampledMaxActiveTasks=max(r['activeTasks'] for r in rows),
                    sampledMeanNativeSearches=statistics.mean(r['nativeSearches'] for r in rows),
                    sampledMaxNativeSearches=max(r['nativeSearches'] for r in rows),
                    responsivenessProbeMs=dict(p50=percentile([r['probeMs'] for r in rows], .5), p95=percentile([r['probeMs'] for r in rows], .95), maximum=max(r['probeMs'] for r in rows)),
                    responsiveness='Python startup/scheduler proxy; GUI responsiveness needs the operator observation',
                    pagingNote='Whole-system counters; Windows hard page reads also include file-backed faults')


def native_task(args, receipt, active, key, pressure=None):
    if pressure is not None and pressure.is_set():
        raise RuntimeError('Memory pressure/active swapping detected; queued benchmark work stopped, receipts retained')
    start = time.monotonic()
    with receipt.with_suffix('.stdout').open('w') as stdout, receipt.with_suffix('.stderr').open('w') as stderr:
        child = subprocess.Popen(args, cwd=ROOT, stdout=stdout, stderr=stderr, start_new_session=True)
        def expire():
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        timer = threading.Timer(180, expire)
        timer.start()
        active.add(key)
        try:
            _, status, usage = os.wait4(child.pid, 0)
            child.returncode = os.waitstatus_to_exitcode(status)
        finally:
            timer.cancel()
            active.discard(key)
    if child.returncode:
        raise RuntimeError(f'Task failed: {receipt.with_suffix(".stderr")} (exit {child.returncode})')
    r = read(receipt)
    return dict(task=key, elapsedSeconds=time.monotonic() - start, userSeconds=usage.ru_utime, systemSeconds=usage.ru_stime,
                maxRssBytes=usage.ru_maxrss * (1 if sys.platform == 'darwin' else 1024),
                numericalHash=r.get('numericalHash'), difference=r.get('difference'),
                nodes=r.get('nodes', 0), native=r.get('native'), receiptSha256=sha(receipt.read_bytes()))


def source_identity():
    # Bind all numerical/importable modules, not absolute paths, platform flags or reports.
    files = sorted(p for folder in ['src', 'scripts', 'tests'] for p in (ROOT / folder).rglob('*')
                   if p.is_file() and p.suffix in ('.js', '.mjs', '.py', '.patch', '.json', '.c', '.h', '.cpp', '.ps1'))
    hashes = {str(p.relative_to(ROOT)): sha(p.read_bytes()) for p in files}
    return dict(sha256=sha(json.dumps(hashes, sort_keys=True, separators=(',', ':')).encode()), files=hashes)


def safe_workers(count, per_worker_bytes, host_memory, win):
    available = host_memory.get('availableBytes')
    if available is None or (sys.platform == 'darwin' and available <= 0):
        return False, 'Available memory could not be established'
    if 'microsoft' in platform.release().lower():
        if not win or not win.get('availableBytes'):
            return False, 'Windows physical memory unavailable'
        available = min(available, win['availableBytes'])
    needed = 1.5 * 2**30 + count * per_worker_bytes
    return available >= needed, f'{available / 2**30:.2f} GiB available; requires {needed / 2**30:.2f} GiB (1.5 GiB reserve + measured task RSS with 35% allowance)'


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output', required=True)
    p.add_argument('--setup', action='store_true')
    p.add_argument('--installation', default=str(ROOT / '.local-research/machine-benchmark-teacher'))
    p.add_argument('--build')
    p.add_argument('--eval-file')
    p.add_argument('--smoke', action='store_true', help='Separate short integration result; never comparable to full trials')
    a = p.parse_args()
    out = Path(a.output).resolve()
    if not out.is_relative_to(ROOT / '.local-research') or out.exists():
        p.error('Use a fresh output under .local-research; completed trials are never overwritten')
    out.mkdir(parents=True)
    lock = ROOT / '.local-research/machine-benchmark.lock'
    with lock.open('x') as stream:
        stream.write(str(os.getpid()))
    result = dict(schema='reversi-machine-benchmark-v1', status='running', mode='smoke' if a.smoke else 'full',
                  started=datetime.now(timezone.utc).isoformat(), trials=[], skipped=[], errors=[])
    started = time.monotonic()
    try:
        os.nice(10)
        installation = Path(a.installation)
        if a.setup:
            setup(installation)
        build = Path(a.build or installation / 'fixed/build.json').resolve()
        eval_file = Path(a.eval_file or installation / 'eval.dat').resolve()
        fixture = HERE / 'positions.json'
        plan = read(HERE / 'workload.json')
        result.update(plan=plan, source=source_identity(), fixtureSha256=sha(fixture.read_bytes()),
                      fixtureIdentity=read(fixture)['identity'], corpusHash=read(fixture)['corpusHash'],
                      baselineModelSha256=sha((ROOT / 'src/features.js').read_bytes()),
                      engineeringLinearChecksum=read(fixture)['linearModel']['checksum'],
                      teacher=read(build), evalSha256=sha(eval_file.read_bytes()),
                      system=dict(platform=platform.platform(), machine=platform.machine(), logicalCpus=os.cpu_count(),
                                  python=sys.version, node=command(['node', '--version']), nodeArch=command(['node', '-p', 'process.arch']),
                                  cpu=command(['sysctl', '-n', 'machdep.cpu.brand_string']) if sys.platform == 'darwin' else command(['lscpu']),
                                  power=command(['pmset', '-g', 'custom']) if sys.platform == 'darwin' else None,
                                  translated=command(['sysctl', '-in', 'sysctl.proc_translated']) if sys.platform == 'darwin' else None,
                                  diskFreeBytes=shutil.disk_usage(out).free, windows=windows()),
                      command=sys.argv, cwd=str(ROOT), revision=command(['git', 'rev-parse', 'HEAD']),
                      accounting='wait4 per cold Node task, including reaped descendants; sampler records simultaneous process-tree RSS; no sum of per-process RSS peaks')
        if sys.platform == 'darwin' and (result['system']['translated'].get('stdout') == '1' or (platform.machine() == 'arm64' and result['system']['nodeArch'].get('stdout') != 'arm64')):
            raise RuntimeError('Rosetta/foreign-architecture runtime refused')
        existing = command(['ps', '-axo', 'pid=,args='])
        if any('node ' in line and any(s in line for s in ['/run.mjs', '/research.mjs', '/screen.mjs', '/qualification.mjs']) for line in existing.get('stdout', '').splitlines()):
            raise RuntimeError('Another research coordinator is running')
        worker = lambda mode, receipt, kind='', i=0: ['node', str(HERE / 'worker.mjs'), mode, str(fixture), str(build), str(eval_file), str(receipt), kind, str(i)]
        print('Validating pinned teacher, pass/terminal cases, independent exact references, B and fitting values...', flush=True)
        receipt = out / 'validation.json'
        active = set()
        result['validationUsage'] = native_task(worker('validate', receipt), receipt, active, 'validation')
        result['validation'] = read(receipt)
        # Same six one-task memory probes on both systems; not throughput trials.
        probes = []
        for kind in KINDS:
            receipt = out / f'probe-{kind}.json'
            probes.append(native_task(worker('task', receipt, kind), receipt, active, kind))
        result['probes'] = probes
        per_worker = max(r['maxRssBytes'] + (r['native'] or {}).get('maxRssBytes', 0) for r in probes) * 1.35
        result['memoryAllowancePerWorkerBytes'] = per_worker
        baseline = Sampler(out / 'baseline-responsiveness.jsonl', set())
        baseline.thread.start()
        time.sleep(3)
        result['baselineResponsiveness'] = baseline.finish()
        counts = [1, 2, 4, 6] + ([8] if platform.machine() == 'x86_64' and sys.platform != 'darwin' else [])
        if a.smoke:
            counts = [1, 2]
        # Rotate count and category order to spread thermal/background drift.
        for repetition in range(1 if a.smoke else plan['repetitions']):
            order = counts[repetition % len(counts):] + counts[:repetition % len(counts)]
            for count in order:
                if time.monotonic() - started > 40 * 60:
                    raise RuntimeError('40-minute envelope exceeded; preserve partial receipts and report incomplete work; never shorten scientific tasks')
                win, mem = windows(), memory()
                safe, reason = safe_workers(count, per_worker, mem, win)
                if not safe:
                    result['skipped'].append(dict(repetition=repetition, workers=count, reason=reason, memory=mem, windows=win))
                    atomic(out / 'result.json', result)
                    print(f'Skip {count} workers: {reason}', flush=True)
                    continue
                for k in range(len(KINDS)):
                    kind = KINDS[(k + repetition) % len(KINDS)]
                    n = min(8, plan['tasks'][kind]) if a.smoke else plan['tasks'][kind]
                    tag = f'{repetition}-{count}-{kind}'
                    trial_dir = out / tag
                    trial_dir.mkdir()
                    active = set()
                    sampler = Sampler(trial_dir / 'samples.jsonl', active)
                    start = time.monotonic()
                    sampler.thread.start()
                    try:
                        with ThreadPoolExecutor(max_workers=count) as pool:
                            futures = []
                            for i in range(n):
                                receipt = trial_dir / f'{i}.json'
                                futures.append(pool.submit(native_task, worker('task', receipt, kind, i), receipt, active, i, sampler.pressure))
                            rows = [f.result() for f in as_completed(futures)]
                            if sampler.pressure.is_set():
                                raise RuntimeError('Memory pressure/active swapping during trial; no throughput claim accepted')
                    finally:
                        sampled = sampler.finish()
                    elapsed = time.monotonic() - start
                    rows.sort(key=lambda r: r['task'])
                    cpu = sum(r['userSeconds'] + r['systemSeconds'] for r in rows)
                    trial = dict(kind=kind, repetition=repetition, workers=count, tasks=n, elapsedSeconds=elapsed,
                                 cpuSeconds=cpu, userSeconds=sum(r['userSeconds'] for r in rows), systemSeconds=sum(r['systemSeconds'] for r in rows),
                                 usefulTasksPerHour=3600 * n / elapsed, cpuCoreEquivalents=cpu / elapsed,
                                 meanActiveTasks=sum(r['elapsedSeconds'] for r in rows) / elapsed,
                                 slotOccupancy=sum(r['elapsedSeconds'] for r in rows) / (count * elapsed),
                                 nodes=sum(r['nodes'] for r in rows), nativeCpuSeconds=sum((r['native'] or {}).get('userSeconds', 0) + (r['native'] or {}).get('systemSeconds', 0) for r in rows),
                                 numericalSequenceSha256=sha(json.dumps([r['numericalHash'] for r in rows], separators=(',', ':')).encode()),
                                 maxFittingDifference=max((r['difference']['maxAbs'] for r in rows if r['difference']), default=0),
                                 fittingExactHashes=all(r['difference']['exactHashMatch'] for r in rows if r['difference']),
                                 maxTaskRssBytes=max(r['maxRssBytes'] for r in rows), resource=sampled,
                                 memoryPreflight=reason, windows=win)
                    atomic(trial_dir / 'metrics.json', rows)
                    result['trials'].append(trial)
                    atomic(out / 'result.json', result)
                    print(f'{tag}: {elapsed:.2f}s, {trial["usefulTasksPerHour"]:.1f} tasks/hour, {trial["meanActiveTasks"]:.2f} active tasks, {sampled["peakTreeRssBytes"]/2**20:.0f} MiB tree RSS', flush=True)
        if result['source'] != source_identity():
            raise RuntimeError('Benchmark/numerical source changed during timing')
        result['status'] = 'complete' if not result['skipped'] else 'complete-with-skips'
        result['summary'] = []
        for kind in KINDS:
            for count in counts:
                rows = [r for r in result['trials'] if r['kind'] == kind and r['workers'] == count]
                if rows:
                    result['summary'].append(dict(kind=kind, workers=count, elapsedSeconds=distribution([r['elapsedSeconds'] for r in rows]),
                        usefulTasksPerHour=distribution([r['usefulTasksPerHour'] for r in rows]),
                        cpuSeconds=distribution([r['cpuSeconds'] for r in rows]), peakTreeRssBytes=max(r['resource']['peakTreeRssBytes'] for r in rows)))
    except BaseException as e:
        result['status'] = 'failed'
        result['errors'].append(repr(e))
        raise
    finally:
        result['totalElapsedSeconds'] = time.monotonic() - started
        result['finished'] = datetime.now(timezone.utc).isoformat()
        atomic(out / 'result.json', result)
        lock.unlink(missing_ok=True)
    print(f'Result: {out / "result.json"} ({result["totalElapsedSeconds"] / 60:.1f} minutes)', flush=True)


if __name__ == '__main__':
    main()
