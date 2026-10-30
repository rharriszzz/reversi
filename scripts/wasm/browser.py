"""Test-only browser choice and process accounting; ordinary play imports none."""
import os
import sys
import json
import subprocess
from pathlib import Path

def check_resources():
    if os.environ.get('REVERSI_WINDOWS_BROWSER')!='1':return
    file=Path(__file__).resolve().parents[2]/os.environ.get('REVERSI_PC_OUTPUT','.local-research/windows-pc-20261030')/'resources-latest.json'
    if not file.exists():raise RuntimeError('Start scripts/windows-pc/resources.py before Windows measurements')
    import time
    if time.time()-file.stat().st_mtime>45:raise RuntimeError('Resource monitor is stale')
    row=json.loads(file.read_text());w=row['windows'];l=row['linux']
    if l['availableBytes']<2*2**30 or w['availableBytes']<1.5*2**30:
        raise RuntimeError('Insufficient memory headroom; completed measurements are retained')
    if w['availableBytes']<3*2**30 and w['pagesOutputPerSec']>256:
        raise RuntimeError('Windows memory pressure with active page output; stop measurements')

def launch_browser(pw,**options):
    if os.environ.get('REVERSI_WINDOWS_BROWSER')!='1':
        if os.environ.get('REVERSI_BROWSER_CHANNEL'):
            options.setdefault('channel',os.environ['REVERSI_BROWSER_CHANNEL'])
        return pw.chromium.launch(**options)
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'windows-pc'))
    # This module is also named browser; load the Windows helper explicitly.
    import importlib.util
    spec=importlib.util.spec_from_file_location('windows_browser',Path(__file__).resolve().parents[1]/'windows-pc/browser.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    owner=module.WindowsBrowser(pw);browser=owner.__enter__()
    browser.reversi_windows_profile=owner.identity['profile']
    import atexit
    atexit.register(owner.__exit__)
    browser.close=lambda:owner.__exit__()
    return browser

def process_resources(session):
    pids=[str(p['id']) for p in session.send('SystemInfo.getProcessInfo')['processInfo']]
    if os.environ.get('REVERSI_WINDOWS_BROWSER')=='1':
        code='$p=@(Get-Process -Id '+','.join(pids)+' -ErrorAction SilentlyContinue); [pscustomobject]@{processes=$p.Count; workingSetSumBytes=($p|Measure-Object WorkingSet64 -Sum).Sum;privateBytesSum=($p|Measure-Object PrivateMemorySize64 -Sum).Sum}|ConvertTo-Json -Compress'
        raw=subprocess.check_output(['/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-Command',code],text=True,timeout=20)
        return json.loads(raw)
    ps=subprocess.run(['ps','-o','rss=','-p',','.join(pids)],capture_output=True,text=True)
    return {'browserProcessRssKiB':sum(int(s) for s in ps.stdout.split()),'swap':subprocess.check_output(['sysctl','vm.swapusage'],text=True).strip()}
