"""Low-rate audit, timestamps and monotonic swap counters. Never changes settings."""
import json
import os
import sys
import time
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'.local-research/windows-pc-20261030'

def linux():
    m={k:int(v.split()[0])*1024 for k,v in (line.split(':',1) for line in Path('/proc/meminfo').read_text().splitlines())}
    vm=dict(line.split() for line in Path('/proc/vmstat').read_text().splitlines())
    return {'at':time.time(),'availableBytes':m['MemAvailable'],'totalBytes':m['MemTotal'],'swapUsedBytes':m['SwapTotal']-m['SwapFree'],'swapInPages':int(vm['pswpin']),'swapOutPages':int(vm['pswpout']),'load':os.getloadavg(),'cpuTicks':Path('/proc/stat').read_text().splitlines()[0],'pressure':{k:Path('/proc/pressure/'+k).read_text().strip() for k in ['memory','cpu','io']},'freeStorageBytes':os.statvfs(ROOT).f_bavail*os.statvfs(ROOT).f_frsize}

def windows():
    script=subprocess.check_output(['wslpath','-w',str(Path(__file__).with_suffix('.ps1'))],text=True).strip()
    return json.loads(subprocess.check_output(['/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-File',script],text=True,timeout=30))

def latest():
    return {'linux':linux(),'windows':json.loads((OUT/'resources-latest.json').read_text())['windows']} if (OUT/'resources-latest.json').exists() else {'linux':linux()}

if __name__=='__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    while True:
        row={'linux':linux(),'windows':windows()}
        with (OUT/'resources.jsonl').open('a') as f:f.write(json.dumps(row)+'\n')
        temp=OUT/'resources-latest.tmp';temp.write_text(json.dumps(row));temp.replace(OUT/'resources-latest.json')
        if '--once' in sys.argv:print(json.dumps(row));break
        time.sleep(15)
