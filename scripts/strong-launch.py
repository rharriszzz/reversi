#!/usr/bin/env python3
"""Resource-checked, frozen-source launch/resume of offline evaluator learning."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time


ROOT = Path(__file__).resolve().parents[1]


def atomic(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.tmp-%s' % os.getpid())
    with temporary.open('w') as stream:
        stream.write(json.dumps(value, indent=2) + '\n')
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)
    try:
        fd = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    except OSError:
        pass


def command(args, timeout=15):
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
        return {'code': p.returncode, 'stdout': p.stdout.strip(), 'stderr': p.stderr.strip()[:1000]}
    except (OSError, subprocess.TimeoutExpired) as error:
        return {'error': str(error)}


def preflight(output):
    record = {'at': datetime.now(timezone.utc).isoformat(), 'platform': sys.platform,
              'logicalCpus': os.cpu_count(), 'diskFreeGiB': shutil.disk_usage(output).free / 2**30}
    if Path('/proc/meminfo').exists():
        memory = {line.split(':')[0]: int(line.split()[1]) for line in Path('/proc/meminfo').read_text().splitlines()}
        record['availableGiB'] = memory['MemAvailable'] / 2**20
        record['swapUsedMiB'] = (memory['SwapTotal'] - memory['SwapFree']) / 1024

        def cpu():
            fields = list(map(int, Path('/proc/stat').read_text().splitlines()[0].split()[1:9]))
            return sum(fields), fields[3] + fields[4]

        def paging():
            return {line.split()[0]: int(line.split()[1]) for line in Path('/proc/vmstat').read_text().splitlines() if line.startswith(('pswpin ', 'pswpout '))}

        before, pages = cpu(), paging()
        time.sleep(1)
        after, pages_after = cpu(), paging()
        record['cpuBusy'] = 1 - (after[1] - before[1]) / max(1, after[0] - before[0])
        record['swapPagesInOutPerSecond'] = sum(pages_after[k] - pages[k] for k in pages)
    elif sys.platform == 'darwin':
        record['vmStat'] = command(['vm_stat'])
        record['memoryPressure'] = command(['memory_pressure'])
        record['powerSettings'] = command(['pmset', '-g', 'custom'])
        record['cpuBusy'] = min(1, os.getloadavg()[0] / max(1, os.cpu_count()))
    record['topProcesses'] = command(['ps', '-eo', 'pid,pcpu,rss,comm', '--sort=-rss'] if sys.platform != 'darwin' else ['ps', '-axo', 'pid,pcpu,rss,comm', '-r'])
    # No shell interpolation: PowerShell receives this as one literal program.
    powershell = shutil.which('powershell.exe')
    if powershell:
        script = r"""$os=Get-CimInstance Win32_OperatingSystem
$perf=Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
$cpu=Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'"
$apps=Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 ProcessName,Id,WorkingSet64,CPU
$disks=Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" | Select-Object FreeSpace,Size
@{totalKiB=$os.TotalVisibleMemorySize;availableKiB=$os.FreePhysicalMemory;cpuPercent=$cpu.PercentProcessorTime;pageReadsPerSec=$perf.PageReadsPerSec;pageWritesPerSec=$perf.PageWritesPerSec;apps=$apps;disk=$disks;power=(& powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE | Out-String)} | ConvertTo-Json -Depth 4 -Compress"""
        response = command([powershell, '-NoProfile', '-NonInteractive', '-Command', script], timeout=25)
        try:
            record['windows'] = json.loads(response['stdout'])
        except (KeyError, ValueError):
            record['windowsUnavailable'] = response
    # Read the real Linux process table where accessible. Refuse another v1/v2
    # research coordinator; this check supplements the run's atomic writer lock.
    duplicates = []
    if Path('/proc').exists():
        for proc in Path('/proc').iterdir():
            if not proc.name.isdigit():
                continue
            try:
                args = (proc / 'cmdline').read_bytes().split(b'\0')
                if args and b'node' in Path(os.fsdecode(args[0])).name.encode() and any(b'/strong/run.mjs' in arg or arg.endswith(b'/research.mjs') for arg in args[1:]):
                    duplicates.append({'pid': int(proc.name), 'command': [os.fsdecode(a) for a in args if a]})
            except (OSError, ValueError):
                pass
    record['existingResearch'] = duplicates
    available = record.get('availableGiB', 2)
    windows = record.get('windows', {})
    if windows.get('availableKiB') is not None:
        available = min(available, float(windows['availableKiB']) / 2**20)
    busy = max(record.get('cpuBusy', 0), float(windows.get('cpuPercent') or 0) / 100)
    workers = 2 if available >= 3.5 and busy < .35 else 1
    blockers = []
    if 'microsoft' in os.uname().release.lower() and not windows.get('availableKiB'):
        blockers.append('Windows physical memory unavailable; run resource check from the normal WSL host')
    if available < 1.25:
        blockers.append('Less than 1.25 GiB available physical memory')
    if busy > .85:
        blockers.append('CPU utilization exceeds 85%')
    if record['diskFreeGiB'] < 10:
        blockers.append('Less than 10 GiB free disk')
    if record.get('swapPagesInOutPerSecond', 0) > 256:
        blockers.append('Active WSL swapping exceeds 256 pages/second')
    if duplicates:
        blockers.append('An existing research coordinator is live')
    record.update(workers=workers,limitingAvailableGiB=available,blockers=blockers,
                  policy='At most two 320 MiB worker heaps; one below 3.5 GiB available physical memory. No application or saved setting changes.')
    atomic(output / 'preflight.json', record)
    return record


def snapshot(output):
    destination = output / 'source'
    if destination.exists():
        return destination
    temporary = output / ('source.tmp-%s' % os.getpid())
    for name in ['src', 'scripts', 'tests', 'docs/data']:
        shutil.copytree(ROOT / name, temporary / name, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    shutil.copy2(ROOT / 'package.json', temporary / 'package.json')
    os.rename(temporary, destination)
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--hours', type=float)
    parser.add_argument('--seconds', type=float)
    parser.add_argument('--workers', type=int)
    parser.add_argument('--seed', type=int)
    parser.add_argument('--smoke', action='store_true')
    parser.add_argument('--pilot', action='store_true')
    parser.add_argument('--continue-from')
    parser.add_argument('--exclude-run', action='append', default=[])
    parser.add_argument('--check-only', action='store_true')
    options = parser.parse_args()
    if options.hours is not None and options.seconds is not None:
        parser.error('Choose hours or seconds')
    if options.resume and any(value is not None for value in [options.hours, options.seconds, options.workers, options.seed, options.continue_from]):
        parser.error('Resume uses saved configuration')
    if any(v is not None and v <= 0 for v in [options.hours, options.seconds, options.workers, options.seed]):
        parser.error('Numeric parameters must be positive')
    output = Path(options.output).resolve()
    if output == ROOT or any(output.is_relative_to(ROOT / name) for name in ['src', 'scripts', 'tests', '.git']):
        parser.error('Choose a dedicated local output directory')
    output.mkdir(parents=True, exist_ok=True)
    node = shutil.which('node')
    if not node:
        parser.error('Node 20+ required for offline research')
    resources = preflight(output)
    print('Resources:', json.dumps({k: resources[k] for k in ['limitingAvailableGiB', 'workers', 'blockers']}))
    if resources['blockers']:
        return 2
    if options.check_only:
        return 0
    if options.resume and (output / 'manifest.json').exists():
        state = json.loads((output / 'manifest.json').read_text())
        if state['status'] == 'complete':
            print('Already complete; no work started.')
            return 0
    if (output / 'manifest.json').exists() and not options.resume:
        parser.error('Output already contains a run; use --resume')
    source = snapshot(output)
    run = [node, str(source / 'scripts/strong/run.mjs'), '--output', str(output), '--repository', str(ROOT)]
    if options.resume:
        run += ['--resume', '--worker-cap', str(resources['workers'])]
    else:
        run += ['--workers', str(min(options.workers or resources['workers'], resources['workers']))]
        if options.smoke:
            run.append('--smoke')
        if options.pilot:
            run.append('--pilot')
        for name in ['hours', 'seconds', 'seed', 'continue_from']:
            value = getattr(options, name)
            if value is not None:
                run += ['--' + name.replace('_', '-'), str(value)]
        for previous in options.exclude_run:
            run += ['--exclude-run', str(Path(previous).resolve())]
    if shutil.which('nice'):
        run = [shutil.which('nice'), '-n', '10', *run]
    with (output / 'launcher.log').open('ab', buffering=0) as log:
        process = subprocess.Popen(run, cwd=source, stdin=subprocess.DEVNULL, stdout=log,
                                   stderr=subprocess.STDOUT, start_new_session=True, close_fds=True)
    verified = False
    for _ in range(300):
        path = output / 'manifest.json'
        if path.exists():
            state = json.loads(path.read_text())
            if state['sessions'][-1]['pid'] == process.pid:
                verified = True
                break
        if process.poll() is not None:
            break
        time.sleep(.05)
    if not verified:
        print((output / 'launcher.log').read_text()[-4000:], file=sys.stderr)
        if process.poll() is None:
            process.terminate()
        return 1
    atomic(output / ('launch-%s.json' % process.pid), {'pid': process.pid, 'command': run, 'source': str(source)})
    # Temporary keep-awake was explicitly authorized by the user previously.
    # It changes no saved setting and releases itself when the run stops.
    keeper = None
    if sys.platform == 'darwin' and shutil.which('caffeinate'):
        with (output / 'power.log').open('ab') as log:
            keeper = subprocess.Popen(['caffeinate', '-i', '-w', str(process.pid)], stdin=subprocess.DEVNULL,
                                      stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    elif 'microsoft' in os.uname().release.lower() and shutil.which('powershell.exe'):
        manifest = json.loads((output / 'manifest.json').read_text())
        hours_left = max(.01, (manifest['config']['budgetMs'] - manifest['elapsedMs']) / 3600000) + .05
        def windows_path(path):
            return subprocess.run(['wslpath', '-w', str(path)], capture_output=True, text=True, check=True).stdout.strip()
        try:
            power_command = ['powershell.exe', '-NoProfile', '-NonInteractive', '-File',
                             windows_path(source / 'scripts/strong/keep-awake.ps1'),
                             '-ManifestPath', windows_path(output / 'manifest.json'),
                             '-StatusPath', windows_path(output / 'power.json'), '-Hours', str(hours_left)]
            with (output / 'power.log').open('ab') as log:
                keeper = subprocess.Popen(power_command, stdin=subprocess.DEVNULL, stdout=log,
                                          stderr=subprocess.STDOUT, start_new_session=True, close_fds=True)
        except (OSError, subprocess.SubprocessError) as error:
            atomic(output / 'power.json', {'state': 'unavailable', 'error': str(error)})
    if keeper:
        atomic(output / 'power-launch.json', {'pid': keeper.pid, 'temporary': True})
    # Generate a Windows login/manual recovery command; do not register a task
    # or change persistent settings. An already-running duplicate is refused.
    if 'microsoft' in os.uname().release.lower():
        distribution = os.environ.get('WSL_DISTRO_NAME', 'Ubuntu')
        recovery = ['wsl.exe', '-d', distribution, '--cd', str(ROOT), '--', sys.executable,
                    str(ROOT / 'scripts/strong-launch.py'), '--resume', '--output', str(output)]
        (output / 'resume-after-reboot.cmd').write_text('@echo off\r\n' + subprocess.list2cmdline(recovery) + '\r\npause\r\n')
    print('Started PID', process.pid)
    print('Report:', output / 'report.md')
    print('Progress: tail -f %s' % (output / 'launcher.log'))
    print('Resume after reboot: python3 scripts/strong-launch.py --resume --output %s' % output)
    print('No saved power settings or startup tasks changed.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
