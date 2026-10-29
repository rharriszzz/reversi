#!/usr/bin/env python3
"""Launch a bounded residual-learning session, or resume its remaining allowance."""
import argparse
from datetime import datetime, timezone
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('strong_launch', ROOT / 'scripts/strong-launch.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)


def resources(output, current_ok=False):
    value = base.preflight(output)
    existing = []
    if Path('/proc').exists():
        for proc in Path('/proc').iterdir():
            if not proc.name.isdigit():
                continue
            try:
                argv = (proc / 'cmdline').read_bytes().split(b'\0')
                if argv and Path(os.fsdecode(argv[0])).name == 'node' and any(
                        a.endswith((b'/residual/run.mjs', b'/teacher/qualification.mjs', b'/teacher/audit.mjs')) for a in argv[1:]):
                    if current_ok and any(os.fsencode(str(output)) == a for a in argv):
                        continue
                    existing.append(int(proc.name))
            except OSError:
                pass
    if existing:
        value['blockers'].append('Existing teacher/residual coordinators: ' + str(existing))
    # Safe worker cap; fresh scaling in the pilot determines useful concurrency.
    value['workers'] = min(4, value['workers'])
    base.atomic(output / 'preflight.json', value)
    return value


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output', required=True)
    p.add_argument('--resume', action='store_true')
    p.add_argument('--new-session', action='store_true', help='Only with a new user-authorized allowance')
    p.add_argument('--repair-from', help='Fresh engineering run; carry the stopped run session ledger and deadline')
    p.add_argument('--session-hours', type=float)
    p.add_argument('--deadline-utc', help='Optional earlier ISO UTC deadline')
    p.add_argument('--mode', choices=['pilot', 'session-one', 'continue'], default='session-one')
    p.add_argument('--workers', type=int)
    p.add_argument('--resources-only', action='store_true')
    p.add_argument('--open-assessment', action='store_true', help='Later session only; never allowed in the first session')
    p.add_argument('--foreground', action='store_true')
    a = p.parse_args()
    output = Path(a.output).resolve()
    if output == ROOT or not output.is_relative_to((ROOT / '.local-research').resolve()):
        p.error('Use a dedicated .local-research subdirectory')
    output.mkdir(parents=True, exist_ok=True)
    start = time.monotonic()
    resource = resources(output, current_ok=a.resources_only)
    if a.resources_only:
        print(json.dumps(resource))
        return 0
    if resource['blockers']:
        print(json.dumps(resource))
        return 2
    manifest_path = output / 'manifest.json'
    session_path = output / 'session.json'
    old = json.loads(manifest_path.read_text()) if manifest_path.exists() else None
    first_session = bool(old and session_path.exists() and old.get('sessions') and
                         json.loads(session_path.read_text())['id'] == old['sessions'][0]['id'])
    if a.open_assessment and (not old or a.mode != 'continue' or (not a.new_session and first_session)):
        p.error('Locked assessment is prohibited in the first session; use a later authorized continuation')
    if old and not a.resume:
        p.error('Existing run requires --resume')
    if old and old['status'] == 'failed':
        p.error('Failed scientific work is preserved; repair and run a fresh engineering pilot')
    if old and old['status'] in ['complete', 'positional-gate-failed']:
        print('Scientific run finished; no computation repeated.')
        return 0
    if a.workers is not None and not 1 <= a.workers <= resource['workers']:
        p.error('Requested workers exceed fresh resource cap')
    workers = a.workers or resource['workers']
    if a.repair_from:
        if old or session_path.exists() or a.new_session or a.session_hours or a.deadline_utc:
            p.error('Repair uses a fresh directory and the existing allowance')
        previous_dir = Path(a.repair_from).resolve()
        previous = json.loads((previous_dir / 'manifest.json').read_text())
        if previous['status'] not in ['failed', 'paused'] or any(
                count for role, count in previous.get('counts', {}).get('reserved', {}).items() if role != 'pilot'):
            p.error('Repair requires a preserved stopped engineering-only run')
        session = json.loads((previous_dir / 'session.json').read_text())
        session.update(priorActiveMs=session['priorActiveMs']+(time.monotonic()-start)*1000,
                       experimentPriorMs=previous['elapsedMs'], repairFrom=str(previous_dir))
        base.atomic(session_path, session)
    elif not session_path.exists() or a.new_session:
        if not a.session_hours or not 0 < a.session_hours <= 8:
            p.error('A new session requires its explicit authorized --session-hours (at most eight)')
        if session_path.exists():
            previous = json.loads(session_path.read_text())
            base.atomic(output / 'sessions' / (previous['id'] + '.json'), previous)
        now = time.time()
        deadline = now + a.session_hours * 3600
        if a.deadline_utc:
            deadline = min(deadline, datetime.fromisoformat(a.deadline_utc.replace('Z', '+00:00')).timestamp())
        session = {'id': datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S'),
                   'budgetMs': a.session_hours * 3600000, 'priorActiveMs': (time.monotonic()-start)*1000,
                   'deadlineEpochMs': deadline * 1000, 'authorizedHours': a.session_hours}
        base.atomic(session_path, session)
    else:
        if a.session_hours is not None or a.deadline_utc:
            p.error('Resume preserves the existing session allowance; a new allowance requires --new-session')
        session = json.loads(session_path.read_text())
        if session['priorActiveMs'] >= session['budgetMs'] - 300000 or time.time()*1000 >= session['deadlineEpochMs'] - 300000:
            print('Session allowance exhausted; checkpoint preserved. A later user-authorized session is required.')
            return 0
    source = base.snapshot(output)
    if (output / 'planning-amendment.json').exists():
        amendment = json.loads((output / 'planning-amendment.json').read_text())
        source = Path(amendment['executionDirectory']).resolve()
        if not source.is_relative_to(output):
            p.error('Planning execution source must remain within the local run directory')
    # Snapshot hashes include compact published data, not this mutable run's data.
    if not (source / '.local-research').exists():
        (source / '.local-research').symlink_to(ROOT / '.local-research')
    argv = [shutil.which('node') or 'node', '--expose-gc', str(source / 'scripts/residual/run.mjs'),
            '--output', str(output), '--repository', str(ROOT), '--workers', str(workers),
            '--worker-ceiling', str(a.workers or 4), '--mode', a.mode]
    if a.open_assessment:
        argv += ['--open-assessment', 'true']
    if shutil.which('nice'):
        argv = [shutil.which('nice'), '-n', '10', *argv]
    with (output / 'launcher.log').open('ab', buffering=0) as log:
        proc = subprocess.Popen(argv, cwd=source, stdin=subprocess.DEVNULL,
                                stdout=log, stderr=subprocess.STDOUT, start_new_session=True, close_fds=True)
    for _ in range(300):
        if manifest_path.exists():
            m = json.loads(manifest_path.read_text())
            if m.get('pid') == proc.pid:
                break
        if proc.poll() is not None:
            print((output / 'launcher.log').read_text()[-5000:])
            return 1
        time.sleep(.05)
    else:
        proc.terminate()
        print('Coordinator did not checkpoint startup; sent graceful termination')
        return 1
    base.atomic(output / ('launch-%s.json' % proc.pid), {'pid': proc.pid, 'argv': argv, 'workers': workers, 'session': session})
    keeper_hours = max(.001, min(session['budgetMs']-session['priorActiveMs'], session['deadlineEpochMs']-time.time()*1000)/3600000)
    try:
        if shutil.which('powershell.exe'):
            def win(path):
                return subprocess.check_output(['wslpath', '-w', str(path)], text=True).strip()
            with (output / 'power.log').open('ab') as log:
                keeper = subprocess.Popen(['powershell.exe', '-NoProfile', '-NonInteractive', '-File',
                                           win(source / 'scripts/strong/keep-awake.ps1'), '-ManifestPath', win(manifest_path),
                                           '-StatusPath', win(output / 'power.json'), '-Hours', str(keeper_hours)],
                                          stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            base.atomic(output / 'power-launch.json', {'pid': keeper.pid, 'boundedHours': keeper_hours})
        elif sys.platform == 'darwin' and shutil.which('caffeinate'):
            subprocess.Popen(['caffeinate', '-i', '-t', str(int(keeper_hours*3600)), '-w', str(proc.pid)],
                             stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    except (OSError, subprocess.SubprocessError) as error:
        base.atomic(output / 'power.json', {'state': 'unavailable', 'error': str(error)})
    print(json.dumps({'pid': proc.pid, 'output': str(output), 'workers': workers,
                      'limitingAvailableGiB': resource['limitingAvailableGiB'], 'session': session}))
    if a.foreground:
        return proc.wait()
    return 0


if __name__ == '__main__':
    sys.exit(main())
