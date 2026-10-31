"""Inspect real linked symbols/instructions; keep compact static evidence."""
import collections,hashlib,json,os,re,subprocess
from pathlib import Path
OUT=Path(os.environ.get('REVERSI_DISPATCH_RUN','.local-research/runtime-cpu-20261031')).resolve()
def command(*a):return subprocess.check_output(a,text=True)
def inspect(file):
    raw=command('objdump','-dC','--no-show-raw-insn',str(file));(file.parent/(file.name+'.asm')).write_text(raw)
    blocks={};current=None
    for line in raw.splitlines():
        match=re.match(r'^([0-9a-f]+) <(.*)>:$',line)
        if match:current=match[2];blocks[current]={'address':int(match[1],16),'instructions':[]}
        elif current:
            match=re.match(r'^\s*([0-9a-f]+):\s+(\S+)\s*(.*)$',line)
            if match:blocks[current]['instructions'].append({'address':int(match[1],16),'op':match[2],'args':match[3]})
    findings={};extensions={'popcnt','lzcnt','tzcnt','blsi','blsr','blsmsk','andn','bextr','bzhi','shlx','shrx','sarx','rorx','pext','pdep','mulx'}
    for name,b in blocks.items():
        if 'reversi::' not in name:continue
        ins=b['instructions'];ops=collections.Counter(i['op'] for i in ins)
        targets=[i for i in ins if i['op'].startswith('call') or i['op']=='jmp']
        is_enhanced='cpu_enhanced::' in name or '<1>' in name
        if not is_enhanced and file.parent.name not in ('D','E'):
            # GCC emits REP BSF (disassembled TZCNT) for nonzero operands at
            # baseline. The byte sequence safely executes as BSF on old CPUs.
            forbidden={k:v for k,v in ops.items() if k in extensions-{'tzcnt'}}
            assert not forbidden,(file,name,forbidden)
        if any(k in name for k in ['negamax<','lastEmpties<','root<','searchImpl<','analyzeImpl<','windowsImpl<']):
            for i in targets:
                assert not i['args'].startswith('*'),(name,'indirect search call',i)
                if is_enhanced:assert 'cpu_portable::' not in i['args'] and '<0>' not in i['args'],(name,i)
                else:assert 'cpu_enhanced::' not in i['args'] and '<1>' not in i['args'],(name,i)
        findings[name]={'address':hex(b['address']),'alignmentMod64':b['address']%64,'instructionCount':len(ins),'extensions':{k:v for k,v in ops.items() if k in extensions},'branches':sum(v for k,v in ops.items() if k.startswith('j') and k!='jmp'),'calls':targets,'lastAddress':hex(ins[-1]['address']) if ins else None}
    symbols=command('nm','-SC','--defined-only',str(file));(file.parent/(file.name+'.nm')).write_text(symbols)
    tables=[l for l in symbols.splitlines() if any(x in l for x in ['flipRays','frozen::table','patternContributions','priorities','frozen::weights'])]
    if 'dispatch' in str(file):
        assert len([l for l in tables if 'flipRays' in l])==1
        assert len([n for n in findings if 'Engine::negamax<0>' in n and 'cold' not in n])==1
        assert len([n for n in findings if 'Engine::negamax<1>' in n and 'cold' not in n])==1
        assert len([l for l in tables if 'frozen::table0' in l])==1 and len([l for l in tables if 'frozen::table1' in l])==1
    return {'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'size':command('size',str(file)),'sections':command('readelf','-SW',str(file)),'tables':tables,'functions':findings}
result={tag:inspect(OUT/tag/'fixed-work') for tag in ['A','B','C','D','E']}
result['dispatch']=inspect(OUT/'dispatch/reversi-native')
(OUT/'assembly.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:{'size':v['size'],'tables':v['tables']} for k,v in result.items()}))
