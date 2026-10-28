#!/usr/bin/env python3
"""Build the independent mailbox horizon oracle against external Edax evaluation only."""
import pathlib,subprocess,json,hashlib,sys,platform
root=pathlib.Path(__file__).resolve().parents[2];source=root/'scripts/teacher/bound-horizon-oracle.c';up=root/'.local-research/teacher/edax';out=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else root/'.local-research/edax-bound-20261028/horizon-oracle').resolve();out.parent.mkdir(parents=True,exist_ok=True)
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=up,text=True).strip();assert commit=='713a434f13b3d15fb69c61b9ba3641aed82c496c'
cc='clang' if sys.platform=='darwin' else 'gcc';arch='armv8-a' if platform.machine() in ('arm64','aarch64') else 'x86-64-v3'
command=[cc,'-std=c17','-O3','-DNDEBUG','-D_GNU_SOURCE=1',f'-march={arch}',f'-I{up}/src',str(source),'-lm',*(['-lrt'] if sys.platform!='darwin' else []),'-o',str(out)]
r=subprocess.run(command,capture_output=True,text=True);out.with_suffix('.build.log').write_text(r.stdout+r.stderr);r.check_returncode()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();meta={'sourceSha256':sha(source),'binarySha256':sha(out),'upstream':commit,'command':command,'compiler':subprocess.check_output([cc,'--version'],text=True).splitlines()[0]};out.with_suffix('.build.json').write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(meta))
