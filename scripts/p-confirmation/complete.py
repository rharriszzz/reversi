#!/usr/bin/env python3
"""Bound the entire post-reservation execution, preserve logs, then publish audited results."""
import datetime, json, os, pathlib, signal, subprocess, sys, time
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'.local-research/p-independent-confirmation-v1-20261029'
start=time.monotonic();state=json.loads((OUT/'state.json').read_text());prior=state['activeMs'];limit=(8*3600000-20*60000-prior)/1000
stages=[['node','scripts/p-confirmation/run.mjs','execute'],['node','scripts/p-confirmation/audit.mjs'],['node','scripts/p-confirmation/analyze.mjs'],['python3','scripts/p-confirmation/verify.py']]
receipts=[]
for i,cmd in enumerate(stages):
    remaining=limit-(time.monotonic()-start)
    if remaining<=0:raise SystemExit('Eight-hour ceiling/reporting reserve reached; retain incomplete experiment')
    with (OUT/f'completion-stage-{i}.log').open('a') as log:
        t=time.monotonic();p=subprocess.Popen(cmd,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
        try:code=p.wait(timeout=remaining)
        except subprocess.TimeoutExpired:
            os.killpg(p.pid,signal.SIGTERM)
            try:p.wait(timeout=10)
            except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL)
            raise SystemExit('Active allowance exhausted; completed work retained')
        receipts.append(dict(command=cmd,pid=p.pid,exitCode=code,wallSeconds=time.monotonic()-t))
        if code:raise SystemExit(f'Stage {i} failed; see retained log {log.name}')
completion=dict(format='p-confirmation-completion-v1',at=datetime.datetime.now(datetime.timezone.utc).isoformat(),stages=receipts,activeMs=prior+1000*(time.monotonic()-start),reportReserveMs=20*60000,capMs=8*3600000)
tmp=OUT/'completion.json.tmp';tmp.write_text(json.dumps(completion,separators=(',',':')));os.replace(tmp,OUT/'completion.json')
subprocess.run(['python3','scripts/p-confirmation/publish.py','results'],cwd=ROOT,check=True)
plotpython=ROOT/'.local-research/frozen-player-screen-v1-20261029/plot-venv/bin/python3'
subprocess.run([str(plotpython),'scripts/p-confirmation/publish.py','figure'],cwd=ROOT,check=True)
print(json.dumps(completion))
