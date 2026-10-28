#!/usr/bin/env python3
"""Download/build the pinned external GPL teacher locally; never vendor it."""
import hashlib,json,subprocess,sys
from pathlib import Path
root=Path(sys.argv[1] if len(sys.argv)>1 else '.local-research/teacher').resolve()
root.mkdir(parents=True,exist_ok=True)
checkout=root/'edax'
commit='713a434f13b3d15fb69c61b9ba3641aed82c496c'
def run(args,**kw):return subprocess.check_output(args,text=True,**kw).strip()
if not checkout.exists():run(['git','clone','https://github.com/abulmo/edax-reversi.git',str(checkout)])
run(['git','fetch','origin',commit],cwd=checkout)
run(['git','checkout','--detach',commit],cwd=checkout)
# Explicit architecture avoids host-specific instructions on future machines.
arch='armv8-a' if __import__('platform').machine() in ('arm64','aarch64') else 'x86-64-v3'
compiler='clang' if sys.platform=='darwin' else 'gcc'
subprocess.run(['make','build',f'ARCH={arch}',f'CC={compiler}',f'OS={"osx" if sys.platform=="darwin" else "linux"}','-j2'],cwd=checkout/'src',check=True)
data_commit='786421f355219ade872ce7285c1cab1eaf67836a'
run(['git','fetch','origin',data_commit],cwd=checkout)
evalfile=checkout/'bin/data/eval.dat'
evalfile.parent.mkdir(parents=True,exist_ok=True)
evalfile.write_bytes(subprocess.check_output(['git','show',data_commit+':bin/data/eval.dat'],cwd=checkout))
assert hashlib.sha256(evalfile.read_bytes()).hexdigest()=='f8b2299612d9fa4414157e70e932636e33111c2602d0c2fc382a7d90ef21b792'
(root/'build.json').write_text(json.dumps({'source':commit,'dataSource':data_commit,'compiler':run([compiler,'--version']).splitlines()[0],'architecture':arch,'binarySha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (checkout/'bin').glob('*Edax*') if p.is_file()}},indent=2))
print(json.dumps({'source':commit,'eval':str(evalfile),'binaries':[str(p) for p in (checkout/'bin').glob('*Edax*')],'license':str(checkout/'LICENSE')}))
