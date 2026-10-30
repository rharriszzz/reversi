"""Serial persistent-process startup, warmed IPC and observed Linux memory."""
import json
import statistics
import time
from pathlib import Path
from qualify import client,args
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.local-research/windows-pc-20261030'
rows=[];positions=json.loads((OUT/'fixtures.json').read_text())['positions']
for tag,path in [('portable',ROOT/'.local-research/native/build.json'),('host',ROOT/'.local-research/native-host/build.json')]:
    for rep in range(5):
        start=time.monotonic()
        with client.NativeEngine(path) as e:
            startup=(time.monotonic()-start)*1000
            roundtrips=[e.request('hello')['interfaceMs'] for _ in range(100)]
            for model in ['B','P']:
                for p in positions:e.request(f'search {args(p["board"],p["player"],model)} 6 0 1 0 0 0')
            status=Path(f'/proc/{e.process.pid}/status').read_text()
            memory={l.split(':')[0]:l.split(':',1)[1].strip() for l in status.splitlines() if l.startswith(('VmRSS:','VmHWM:','VmPeak:','VmSize:','Threads:'))}
            rows.append({'tag':tag,'rep':rep,'startupMs':startup,'helloRoundTripMs':roundtrips,'memory':memory,'receipt':e.receipt})
(OUT/'native-overhead.json').write_text(json.dumps(rows));print(json.dumps({tag:{'startupMedianMs':statistics.median(r['startupMs'] for r in rows if r['tag']==tag),'helloMedianMs':statistics.median(v for r in rows if r['tag']==tag for v in r['helloRoundTripMs'])} for tag in ['portable','host']}))
