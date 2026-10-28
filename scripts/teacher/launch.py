#!/usr/bin/env python3
"""Preflight and frozen-source Stage A only; run in foreground, safely resumable."""
import importlib.util,subprocess,sys,json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('launch',root/'scripts/strong-launch.py')
launch=importlib.util.module_from_spec(spec);spec.loader.exec_module(launch)
out=Path(sys.argv[1] if len(sys.argv)>1 else '.local-research/teacher-audit').resolve();out.mkdir(parents=True,exist_ok=True)
if (out/'manifest.json').exists() and json.loads((out/'manifest.json').read_text()).get('status')=='complete':
 print('Stage A already complete; no computation repeated.');raise SystemExit(0)
check=launch.preflight(out);launch.atomic(out/'preflight.json',check)
if check['blockers']:raise SystemExit(check['blockers'])
if Path('/proc').exists():
 for proc in Path('/proc').iterdir():
  if not proc.name.isdigit():continue
  try:
   argv=(proc/'cmdline').read_bytes().split(b'\0')
   if argv and Path(argv[0].decode()).name=='node' and any(v.endswith(b'/teacher/audit.mjs') for v in argv[1:]):
    raise SystemExit('Another Stage A coordinator is live: '+proc.name)
  except (OSError,UnicodeError):pass
source=launch.snapshot(out)
args=['node',str(source/'scripts/teacher/audit.mjs'),'--output',str(out),'--repository',str(source),'--binary',str(root/'.local-research/teacher/edax/bin/lEdax-x86-64-v3'),'--eval',str(root/'.local-research/teacher/edax/bin/data/eval.dat'),'--mode',sys.argv[2] if len(sys.argv)>2 else 'pilot']
# Historical local paths remain at original repository; expose via symlink only
# inside the frozen snapshot, never copy large trajectories.
local=source/'.local-research'
if not local.exists():local.symlink_to(root/'.local-research',target_is_directory=True)
with (out/'launcher.log').open('a') as log:
 print(json.dumps({'command':args,'resources':{k:check[k] for k in ['workers','limitingAvailableGiB','blockers']},'log':str(out/'launcher.log')}),flush=True)
 raise SystemExit(subprocess.call(args,cwd=root,stdout=log,stderr=subprocess.STDOUT))
