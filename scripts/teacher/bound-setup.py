#!/usr/bin/env python3
"""Build a separate GPL-3.0 Edax engineering variant; never patch the pinned checkout."""
import argparse,hashlib,io,json,pathlib,platform,subprocess,sys,tarfile,time
ROOT=pathlib.Path(__file__).resolve().parents[2]
COMMIT='713a434f13b3d15fb69c61b9ba3641aed82c496c'
sha=lambda b:hashlib.sha256(b).hexdigest()
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',default='.local-research/teacher/edax-fixed-v2');a=p.parse_args();out=pathlib.Path(a.output).resolve();up=ROOT/'.local-research/teacher/edax';patch=ROOT/'scripts/teacher/edax-bound.patch'
 if not out.is_relative_to(ROOT/'.local-research') or out==up or up in out.parents:p.error('Use a separate .local-research directory outside the pinned installation')
 if out.exists():p.error('Build destination already exists; inspect its immutable build.json or choose another directory')
 if subprocess.check_output(['git','rev-parse','HEAD'],cwd=up,text=True).strip()!=COMMIT:raise RuntimeError('Pinned checkout identity mismatch')
 archive=subprocess.check_output(['git','archive',COMMIT],cwd=up);out.mkdir(parents=True)
 with tarfile.open(fileobj=io.BytesIO(archive)) as t:
  for member in t.getmembers():
   if not (out/member.name).resolve().is_relative_to(out) or member.issym() or member.islnk():raise RuntimeError('Unsafe source archive')
  t.extractall(out)
 subprocess.run(['git','apply','--no-index',str(patch)],cwd=out,check=True)
 (out/'bin').mkdir(exist_ok=True);arch='armv8-a' if platform.machine() in ('arm64','aarch64') else 'x86-64-v3';compiler='clang' if sys.platform=='darwin' else 'gcc';osname='osx' if sys.platform=='darwin' else 'linux'
 sourceFiles=[{'path':str(f.relative_to(out)),'sha256':sha(f.read_bytes())} for f in sorted((out/'src').iterdir()) if f.suffix in ('.c','.h') or f.name=='Makefile']
 tree=sha(json.dumps(sourceFiles,separators=(',',':')).encode());start=time.monotonic()
 command=['nice','-n','10','make','build',f'ARCH={arch}',f'CC={compiler}',f'OS={osname}','-j1']
 with (out/'build.log').open('w') as log:subprocess.run(command,cwd=out/'src',stdout=log,stderr=subprocess.STDOUT,check=True)
 binary=out/'bin'/f'{"m" if sys.platform=="darwin" else "l"}Edax-{arch}'
 metadata={'kind':'edax-fixed-window-v2','upstream':COMMIT,'patchSha256':sha(patch.read_bytes()),'sourceTreeSha256':tree,'sourceFiles':sourceFiles,'binary':str(binary),'binarySha256':sha(binary.read_bytes()),'compiler':subprocess.check_output([compiler,'--version'],text=True).splitlines()[0],'command':command,'buildSeconds':time.monotonic()-start,'license':'GPL-3.0; complete upstream LICENSE and notices retained locally'}
 (out/'build.json').write_text(json.dumps(metadata,indent=2)+'\n');print(json.dumps({'buildFile':str(out/'build.json'),'binarySha256':metadata['binarySha256'],'sourceTreeSha256':tree}))
if __name__=='__main__':main()
