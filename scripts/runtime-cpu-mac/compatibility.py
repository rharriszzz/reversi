"""Compile ordinary ARM64 and Intel Mac paths; never execute Intel output."""
import hashlib,json,os,subprocess
from pathlib import Path
OUT=Path(os.environ['REVERSI_FLIP_RUN']).resolve();cxx=os.environ.get('CXX','c++')
flags=['-O3','-std=c++17','-ffp-contract=off','-fno-fast-math']
include=['-I',str(OUT/'selected'),'-I','native']
def run(args):return subprocess.check_output(args,text=True,stderr=subprocess.STDOUT)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    preprocessed=run([cxx,*flags,*include,'-E','native/engine.cpp'])
    assert '__builtin_cpu_init' not in preprocessed and '__builtin_cpu_supports' not in preprocessed
    (OUT/'ordinary-arm64.ii').write_text(preprocessed)
    symbols=run(['nm','-C',str(OUT/'selected/engine')])
    assert 'cpu_enhanced' not in symbols and '___cpu_model' not in symbols and '___cpu_indicator_init' not in symbols
    (OUT/'ordinary-arm64.nm').write_text(symbols)
    target=['-target','x86_64-apple-macos27'];files=[]
    for name in ['engine','main','browser']:
        obj=OUT/f'intel-{name}.o'
        run([cxx,*flags,*target,*include,'-c',f'native/{name}.cpp','-o',str(obj)]);files.append(obj)
    exe=OUT/'intel-native'
    run([cxx,*flags,*target,str(files[0]),str(files[1]),'-o',str(exe)])
    dylib=OUT/'intel-browser.dylib'
    run([cxx,*flags,*target,'-dynamiclib',str(files[0]),str(files[2]),'-o',str(dylib)])
    intel_symbols=run(['nm','-C',str(exe)]);assert 'cpu_enhanced' not in intel_symbols
    result={'passed':True,'arm64PreprocessorHasX86Detector':False,'arm64HasEnhancedSymbols':False,'intelExecuted':False,'flags':flags,'intelTarget':target,'files':{p.name:{'sha256':sha(p),'format':run(['file',str(p)]).strip()} for p in [*files,exe,dylib]},'limits':'Intel Mac C++ engine, CLI and browser C ABI compile/link with the installed macOS SDK. No Intel Mac hardware execution. Existing Linux x86 dispatch source/build settings are retained unchanged from qualified PC commit.'}
    (OUT/'compatibility.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
if __name__=='__main__':main()
