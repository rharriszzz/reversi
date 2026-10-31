"""Supporting micro timings, using the historical corpus unchanged."""
import hashlib,json,os,subprocess,time
from pathlib import Path
OUT=Path(os.environ['REVERSI_DISPATCH_RUN']).resolve()
hello=json.loads(subprocess.check_output([str(OUT/'dispatch/reversi-native')],input='1 hello\n',env={**os.environ,'REVERSI_CPU_BACKEND':'auto'},text=True))
assert hello['cpuBackend']=='x86-popcnt-bmi1-bmi2-lzcnt' and all(hello['cpuFeatures'].values()),'Enhanced microbenchmark is unsupported on this CPU'
rows=[];corpus=None
tags=['A','B','C','D','AP','BP','CP','DP','N']
for trial in range(3):
    order=tags[trial:]+tags[:trial]
    if trial%2:order.reverse()
    for tag in order:
        raw=subprocess.check_output([str(OUT/tag/'micro'),'docs/data/fast-flips-mac/search-cases.txt'],env={**os.environ,'FLIP_MICRO_CALLS':'3000000','REVERSI_CPU_BACKEND':'portable' if tag.endswith('P') else 'auto'},text=True,timeout=90)
        r=json.loads(raw)
        if corpus is None:corpus=r['corpus']
        assert r['corpus']==corpus
        rows.append({'trial':trial,'order':order,'tag':tag,'sha256':hashlib.sha256((OUT/tag/'micro').read_bytes()).hexdigest(),**r})
print(json.dumps({'rows':rows,'method':'Three rotating/reversed executable rounds, each with seven in-process repetitions per class; fixed historical xorshift/Fisher-Yates corpus and exhaustive mailbox checks; 3M target calls/class/trial; one statically selected kernel per micro executable; supporting evidence, no whole-search dispatch cost inferred.'}))
