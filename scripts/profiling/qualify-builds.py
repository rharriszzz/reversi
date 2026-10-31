"""Correctness cross-check of measured harness against each production adapter.

No throughput comparison is taken here. Compile original native/main.cpp against
its matching frozen engine object/header, without overwriting measured binaries.
"""
import hashlib,json,subprocess
from pathlib import Path
import measure
ROOT=measure.ROOT;OUT=measure.OUT
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    reg=json.loads((OUT/'registration.json').read_text());rows=[]
    mapping={'nodes':'nodes','evaluations':'evaluations','probes':'ttProbes','hits':'ttHits','boundHits':'ttBoundHits','collisions':'ttCollisions','replacements':'ttReplacements','cutoffs':'cutoffs','ttCutoffs':'ttCutoffs','stores':'ttStores','rejectedStores':'ttRejectedStores','firstMoveCutoffs':'firstMoveCutoffs'}
    for tag,build in reg['builds'].items():
        exe=Path(build['executable']);assert sha(exe)==build['executableSha256'];directory=exe.parent;main=directory/'qualification-main.cpp';main.write_bytes(subprocess.check_output(['git','show',build['commit']+':native/main.cpp']));adapter=directory/'qualification-production-adapter';flags=[f for f in build['flags'] if f!='-g'];subprocess.run(['c++',*flags,'-I',str(directory),str(directory/'engine-production.o'),str(main),'-o',str(adapter)],check=True)
        for work in reg['workloads']:
            if work['mode']=='coach':continue # main.cpp has no analyze protocol; independent native/Wasm tests cover it.
            args=measure.args(work,1);result=json.loads(subprocess.check_output([str(exe),*args],text=True));mode,black,white,player,depth,model,*_=args;board=f'{black} {white} {player} {model}'
            command=f'evalbench {board} 4096' if mode=='evaluate' else f'search {board} {depth} 0 1 0 0 0';request=''.join(f'{i} {command}\n' for i in range(1,5));reply=subprocess.run([str(adapter),'16'],input=request,text=True,capture_output=True,check=True);answers=[json.loads(line) for line in reply.stdout.splitlines()];assert len(answers)==4 and all('error' not in x for x in answers),reply.stdout;actual=answers[-1]
            if mode=='evaluate':assert actual['checksum']==result['checksum'] and actual['evaluations']==result['metrics']['evaluations']
            else:
                assert actual['score']==result['checksum'] and actual['depth']==result['depth'] and actual['exact']==result['exact'] and actual['tableBytes']==result['tableBytes']
                for key,field in mapping.items():assert actual[field]==result['metrics'][key],(tag,work['id'],key)
            rows.append({'build':tag,'workload':work['id'],'passed':True,'adapterExecutableSha256':sha(adapter),'adapterMainSourceSha256':sha(main),'measuredHarnessSha256':sha(exe),'productionEngineObjectSha256':sha(directory/'engine-production.o')})
    measure.save('harness-qualification.json',{'passed':True,'cases':rows,'scope':'Ten static/search cases match original production adapters at matched three-call warmup, including all exposed search counters. Coaching uses public Engine.analyze and is covered by independent existing correctness tests. No timing conclusion from these qualification calls.'});print('10 harness/production-adapter correctness cases pass')
if __name__=='__main__':main()
