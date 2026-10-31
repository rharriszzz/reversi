"""Compile/run ordinary non-dispatch engine + browser C ABI on Linux, no SDK."""
import ctypes as C,hashlib,json,os,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/os.environ.get('REVERSI_DISPATCH_RUN','.local-research/runtime-cpu-final-20261031')
sys.path.insert(0,str(ROOT/'scripts/native'))
from client import NativeEngine
flags=['-O3','-std=c++17','-ffp-contract=off','-fno-fast-math','-fPIC','-shared']
file=OUT/'ordinary-browser.so';subprocess.run([os.environ.get('CXX','g++'),*flags,'-I',str(OUT/'dispatch'),'native/engine.cpp','native/browser.cpp','-o',str(file)],check=True)
lib=C.CDLL(str(file));lib.rv_abi.restype=C.c_int;assert lib.rv_abi()==1
lib.rv_identity.argtypes=[C.c_int];lib.rv_identity.restype=C.c_char_p
lib.rv_create.argtypes=[C.c_uint];lib.rv_create.restype=C.c_void_p
lib.rv_destroy.argtypes=[C.c_void_p]
lib.rv_query.argtypes=[C.c_void_p,C.c_int,*[C.c_uint32]*4,*[C.c_int]*3,*[C.c_double]*2,*[C.c_int]*2];lib.rv_query.restype=C.c_char_p
positions=json.loads((OUT/'positions.json').read_text());checked=0
for model in range(3):
    with NativeEngine(OUT/'A/build.json',tt_mib=0) as reference:
        assert lib.rv_identity(model).decode()==reference.receipt['models']['BLP'[model]]
        session=lib.rv_create(0);assert session
        try:
            for p in positions[:10]:
                black=sum(1<<q for q,v in enumerate(p['board']) if v==1);white=sum(1<<q for q,v in enumerate(p['board']) if v==-1)
                for depth in [1,3,4]:
                    row=json.loads(lib.rv_query(session,1,black&0xffffffff,black>>32,white&0xffffffff,white>>32,p['player'],model,depth,0,0,1,1))
                    expected=reference.search(p['board'],p['player'],model='BLP'[model],depth=depth)
                    for key in ['move','score','depth','exact','nodes','evaluations','ttProbes','ttHits','ttCollisions','ttStores','ttRejectedStores','firstMoveCutoffs','generation']:assert row[key]==expected[key],key
                    checked+=1
        finally:lib.rv_destroy(session)
layout=OUT/'layout.cpp';layout.write_text('#include "engine.hpp"\n#include <iostream>\nint main(){std::cout<<sizeof(reversi::Engine)<<" "<<sizeof(reversi::Entry); }\n')
sizes={}
for tag,include in [('original',OUT/'A'),('experimental',ROOT/'native')]:
    exe=OUT/('layout-'+tag);subprocess.run([os.environ.get('CXX','g++'),'-std=c++17','-I',str(include),str(layout),'-o',str(exe)],check=True)
    sizes[tag]=[int(x) for x in subprocess.check_output([str(exe)],text=True).split()]
assert sizes['original']==sizes['experimental']
result={'passed':True,'engineAndEntryBytes':sizes,'flags':flags,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'queries':checked,'target':'Linux x86-64 ordinary single-target C++/C ABI path; no dispatch macro, SDK or new Wasm compile; not ARM64/Mac hardware qualification.'}
(OUT/'ordinary-path.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
