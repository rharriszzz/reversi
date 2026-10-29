#!/usr/bin/env python3
"""Bounded, checkpointed constraint/pattern experiment; fresh resource checks."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('residual_launch',ROOT/'scripts/residual/launch.py')
base=importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

def resources(output):
    r=base.resources(output,current_ok=True)
    duplicates=[]
    if Path('/proc').exists():
        for proc in Path('/proc').iterdir():
            if not proc.name.isdigit():continue
            try:
                args=(proc/'cmdline').read_bytes().split(b'\0')
                if args and Path(os.fsdecode(args[0])).name=='node' and any(a.endswith(b'/next-residual/run.mjs') for a in args[1:]):
                    if os.fsencode(str(output)) not in args:duplicates.append(int(proc.name))
            except OSError:pass
    if duplicates:r['blockers'].append('Another next-residual run is active: '+str(duplicates))
    r['workers']=min(2,r['workers'])
    base.base.atomic(output/'preflight.json',r)
    return r

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output',required=True)
    p.add_argument('--old',default=str(ROOT/'.local-research/residual-frontier-v1r2-20261028'))
    p.add_argument('--engineering')
    p.add_argument('--resume',action='store_true')
    p.add_argument('--workers',type=int,default=2)
    p.add_argument('--resources-only',action='store_true')
    p.add_argument('--foreground',action='store_true')
    a=p.parse_args();output=Path(a.output).resolve()
    if not output.is_relative_to(ROOT/'.local-research') or output==ROOT/'.local-research':p.error('Dedicated ignored local output required')
    if output==Path(a.old).resolve() or output.is_relative_to(Path(a.old).resolve()):p.error('Never write into the completed training experiment')
    output.mkdir(parents=True,exist_ok=True)
    r=resources(output)
    if a.resources_only:print(json.dumps(r));return 0
    if r['blockers']:print(json.dumps(r));return 2
    if a.workers not in (1,2):p.error('Configured worker ceiling is one or two')
    manifest=output/'manifest.json'
    if manifest.exists():
        state=json.loads(manifest.read_text())
        if state['status'] in ['complete','positional-gate-failed','cost-infeasible']:print('Run finished; no work repeated');return 0
        if not a.resume:p.error('Existing run requires --resume')
        if state['status']=='failed':p.error('Preserve failed checkpoint and audit the engineering issue before repair')
        try:os.kill(state['pid'],0)
        except ProcessLookupError:pass
        else:p.error('This coordinator is already live')
    engineering=Path(a.engineering or output/'engineering-v2').resolve()
    for name in ['L','P','fit-report','benchmark','pilot']:
        if not (engineering/(name+'.json')).exists():p.error('Engineering qualification incomplete: '+name)
    source=base.base.snapshot(output)
    if (output/'memory-repair.json').exists():
        certificate=json.loads((output/'memory-repair.json').read_text())
        source=Path(certificate['executionDirectory']).resolve()
        if not source.is_relative_to(output):p.error('Execution repair must remain within the local output')
    if not (source/'.local-research').exists():(source/'.local-research').symlink_to(ROOT/'.local-research')
    argv=[shutil.which('node') or 'node','--expose-gc',str(source/'scripts/next-residual/run.mjs'),
          '--output',str(output),'--repository',str(ROOT),'--old',str(Path(a.old).resolve()),
          '--engineering',str(engineering),'--workers',str(a.workers)]
    if shutil.which('nice'):argv=[shutil.which('nice'),'-n','10',*argv]
    with (output/'launcher.log').open('ab',buffering=0) as log:
        proc=subprocess.Popen(argv,cwd=source,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True,close_fds=True)
    for _ in range(300):
        if manifest.exists() and json.loads(manifest.read_text()).get('pid')==proc.pid:break
        if proc.poll() is not None:print((output/'launcher.log').read_text()[-5000:]);return 1
        time.sleep(.05)
    else:proc.terminate();print('No startup checkpoint; gracefully stopped');return 1
    base.base.atomic(output/('launch-%s.json'%proc.pid),{'pid':proc.pid,'argv':argv,'configuredWorkers':a.workers,'safeCap':r['workers']})
    state=json.loads(manifest.read_text());hours=max(.001,(8*3600000-state['elapsedMs'])/3600000)
    try:
        if shutil.which('powershell.exe'):
            def win(path):return subprocess.check_output(['wslpath','-w',str(path)],text=True).strip()
            with (output/'power.log').open('ab') as log:
                keeper=subprocess.Popen(['powershell.exe','-NoProfile','-NonInteractive','-File',win(source/'scripts/strong/keep-awake.ps1'),
                                         '-ManifestPath',win(manifest),'-StatusPath',win(output/'power.json'),'-Hours',str(hours)],stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
            base.base.atomic(output/'power-launch.json',{'pid':keeper.pid,'boundedHours':hours})
        elif sys.platform=='darwin' and shutil.which('caffeinate'):
            subprocess.Popen(['caffeinate','-i','-t',str(int(hours*3600)),'-w',str(proc.pid)],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
    except (OSError,subprocess.SubprocessError) as error:base.base.atomic(output/'power.json',{'error':str(error)})
    # Independent pool/native-search occupancy samples, separate from coordinator logging.
    with (output/'monitor.log').open('ab') as log:
        subprocess.Popen([sys.executable,str(source/'scripts/next-residual/monitor.py'),str(output)],stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
    print(json.dumps({'pid':proc.pid,'output':str(output),'configuredWorkers':a.workers,'safeCap':r['workers'],'activeBudgetHours':8}))
    return proc.wait() if a.foreground else 0
if __name__=='__main__':sys.exit(main())
