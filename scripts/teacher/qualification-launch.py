#!/usr/bin/env python3
"""Preflight, snapshot and launch/resume bounded teacher qualification."""
import argparse, importlib.util, json, os, subprocess, sys, time, shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('research_launch',ROOT/'scripts/strong-launch.py')
launch=importlib.util.module_from_spec(spec);spec.loader.exec_module(launch)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output',required=True);p.add_argument('--mode',choices=['full','calibration'],default='full')
    p.add_argument('--resume',action='store_true');p.add_argument('--resources-only',action='store_true')
    p.add_argument('--foreground',action='store_true')
    a=p.parse_args();out=Path(a.output).resolve()
    if out==ROOT or not out.is_relative_to((ROOT/'.local-research').resolve()):p.error('Use a dedicated .local-research subdirectory')
    out.mkdir(parents=True,exist_ok=True)
    manifest=out/'manifest.json'
    if manifest.exists() and not a.resources_only:
        old=json.loads(manifest.read_text())
        if old['status'] in ['complete','calibration-rejected','infeasible','calibration-only','failed-gates']:
            print('Run already finished; no computation repeated.');return 0
        if old['status']=='stopped' and old.get('error') and 'Interrupted;' not in old['error']:
            print('Required query failed; stopped experiment is preserved and cannot be retried automatically.');return 2
        if not a.resume:p.error('Existing run requires --resume')
    start=time.monotonic();resources=launch.preflight(out)
    # Existing resource policy plus explicit teacher duplicate detection.
    if Path('/proc').exists():
        for proc in Path('/proc').iterdir():
            if not proc.name.isdigit():continue
            try:
                argv=(proc/'cmdline').read_bytes().split(b'\0')
                if argv and Path(os.fsdecode(argv[0])).name=='node' and any(x.endswith((b'/teacher/qualification.mjs',b'/teacher/audit.mjs')) for x in argv[1:]):
                    # Periodic resource-only checks are invoked by the current coordinator.
                    if not a.resources_only:resources['blockers'].append('Existing teacher coordinator '+proc.name)
            except OSError:pass
    resources['workers']=min(2,resources['workers']);resources['preflightMs']=(time.monotonic()-start)*1000
    launch.atomic(out/'preflight.json',resources)
    if a.resources_only:
        print(json.dumps(resources));return 0
    if resources['blockers']:print(json.dumps(resources));return 2
    source=launch.snapshot(out)
    if not (source/'.local-research').exists():(source/'.local-research').symlink_to(ROOT/'.local-research',target_is_directory=True)
    argv=['nice','-n','10','node',str(source/'scripts/teacher/qualification.mjs'),'--output',str(out),'--repository',str(ROOT),'--mode',a.mode]
    if a.resume and manifest.exists():argv[-1]=json.loads(manifest.read_text())['protocol']['mode']
    if a.foreground:return subprocess.call(argv,cwd=source)
    with (out/'launcher.log').open('ab',buffering=0) as log:
        proc=subprocess.Popen(argv,cwd=source,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
    launch.atomic(out/'launch.json',{'pid':proc.pid,'command':argv,'source':str(source)})
    # Bounded temporary keep-awake; the existing script releases on stale heartbeat or stop.
    for _ in range(100):
        if manifest.exists():break
        if proc.poll() is not None:break
        time.sleep(.05)
    try:
        if shutil.which('powershell.exe') and manifest.exists():
            def win(path):return subprocess.check_output(['wslpath','-w',str(path)],text=True).strip()
            with (out/'power.log').open('ab') as power_log:
                keeper=subprocess.Popen(['powershell.exe','-NoProfile','-NonInteractive','-File',win(source/'scripts/strong/keep-awake.ps1'),'-ManifestPath',win(manifest),'-StatusPath',win(out/'power.json'),'-Hours','2'],stdin=subprocess.DEVNULL,stdout=power_log,stderr=subprocess.STDOUT,start_new_session=True)
            launch.atomic(out/'power-launch.json',{'pid':keeper.pid,'boundedHours':2})
        elif sys.platform=='darwin' and shutil.which('caffeinate'):
            subprocess.Popen(['caffeinate','-i','-t','7200','-w',str(proc.pid)],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
    except (OSError,subprocess.SubprocessError) as error:
        launch.atomic(out/'power.json',{'state':'unavailable','error':str(error)})
    print(json.dumps({'pid':proc.pid,'output':str(out),'workers':resources['workers'],'availableGiB':resources['limitingAvailableGiB'],'command':argv}))
    return 0
if __name__=='__main__':sys.exit(main())
