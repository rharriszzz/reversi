"""Serial final correctness checks. No outputs here are performance evidence."""
import json,os,re,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=(ROOT/os.environ.get('REVERSI_FLIP_RUN','.local-research/fast-flips-m4-20261031')).resolve()
def main():
    rows=[]
    tasks=[('final-qualification',['node','scripts/fast-flips/qualify.mjs'],{'FLIP_TAGS':'original,refined'}),
           ('timed-publications',['node','scripts/fast-flips/verify-timed.mjs'],{}),
           ('final-call-diagnostic',[sys.executable,'scripts/fast-flips/diagnose.py'],{'FLIP_DIAGNOSTIC_TAG':'refined'}),
           ('node-regression',['node','--test','--test-concurrency=1',*[str(p.relative_to(ROOT)) for p in sorted((ROOT/'tests').glob('*.test.mjs'))]],{}),
           ('node-sanitizers',['node','--test','--test-concurrency=1','tests/native-search.test.mjs','tests/native-v2.test.mjs','tests/mac-endgame.test.mjs'],{'NATIVE_SANITIZE':'1'}),
           ('python-regression',[sys.executable,'-m','unittest','discover','-s','tests','-p','test_*.py'],{})]
    for name,cmd,env in tasks:
        start=time.monotonic();path=OUT/(name+'.log')
        with path.open('w') as f:r=subprocess.run(cmd,cwd=ROOT,env={**os.environ,**env},stdout=f,stderr=subprocess.STDOUT,timeout=600)
        text=path.read_text();tests=re.findall(r'(?:tests\s+(\d+)|Ran (\d+) tests)',text)
        rows.append({'name':name,'command':cmd,'environment':env,'returnCode':r.returncode,'seconds':time.monotonic()-start,'tests':next((int(a or b) for a,b in tests),None),'summary':text.splitlines()[-12:]})
        (OUT/'test-receipt.json').write_text(json.dumps({'passed':all(r['returnCode']==0 for r in rows),'rows':rows},indent=2)+'\n')
        print(json.dumps({'check':name,'returnCode':r.returncode,'seconds':rows[-1]['seconds'],'tests':rows[-1]['tests']}),flush=True);r.check_returncode()
if __name__=='__main__':main()
