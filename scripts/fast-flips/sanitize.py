"""ASan/UBSan correctness only; never run inside benchmark timing."""
import json,os,subprocess
from pathlib import Path
OUT=Path(os.environ.get('REVERSI_FLIP_RUN','.local-research/fast-flips-m4-20261031')).resolve()
b=json.loads((OUT/'builds.json').read_text());flags=[*b['flags'],'-O1','-fsanitize=address,undefined','-fno-omit-frame-pointer'];rows=[]
for tag in os.environ.get('FLIP_TAGS','original,doubling,ray-table,late-ray').split(','):
    d=OUT/tag
    subprocess.run([os.environ.get('CXX','c++'),*flags,'-I',str(d),str(d/'engine.cpp'),'tests/native-internals.cpp','-o',str(d/'internals-sanitize')],check=True)
    subprocess.run([str(d/'internals-sanitize')],check=True,timeout=60)
    if tag in ['ray-table','selected']:
        subprocess.run([os.environ.get('CXX','c++'),*flags,'-I',str(d),str(d/'engine.cpp'),'scripts/fast-flips/kernels.cpp','scripts/fast-flips/micro.cpp','-o',str(d/'micro-sanitize')],check=True)
        result=json.loads(subprocess.check_output([str(d/'micro-sanitize'),'--check'],text=True,timeout=60))
    else:result=None
    rows.append({'tag':tag,'internalsPassed':True,'micro':result})
print(json.dumps({'passed':True,'flags':flags,'rows':rows}))
