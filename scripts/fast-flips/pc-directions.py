"""Isolated direction wrappers for static inspection, never timed evidence.

Cross-direction sharing/reordering makes unique per-direction instruction totals
in the complete optimized flips body ambiguous. These diagnostic wrappers expose
each template at identical own/opp/q boundaries, including move-bit setup/return.
Their instruction counts must not be summed into the measured function's cost.
"""
import json
import os
import subprocess
from pathlib import Path
import importlib.util


def main():
    out = Path(os.environ['REVERSI_FLIP_RUN']).resolve()
    spec = importlib.util.spec_from_file_location('assembly', Path(__file__).with_name('pc-assembly.py'))
    assembly = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(assembly)
    builds = json.loads((out/'builds.json').read_text())
    rows = []
    for tag in ['original', 'refined']:
        source = (out/tag/'engine.cpp').read_text()
        source += '\nnamespace reversi {\n'
        for direction in range(8):
            call = (f'flipsIn<{direction}>(Bits(1)<<q,own,opp)' if tag == 'original'
                    else f'flipsIn<{direction}>(own,opp,q)')
            source += f'extern "C" [[gnu::noinline]] Bits direction{direction}(Bits own,Bits opp,int q){{return {call};}}\n'
        source += '}\n'
        file = out/f'direction-{tag}.cpp'
        obj = out/f'direction-{tag}.o'
        file.write_text(source)
        subprocess.run([os.environ.get('CXX', 'g++'), *builds['flags'], '-I', str(out/tag),
                        '-c', str(file), '-o', str(obj)], check=True, capture_output=True)
        rows.append({'tag': tag, 'directions': [assembly.inspect(obj, f'direction{d}') for d in range(8)]})
    (out/'directions.json').write_text(json.dumps({'rows': rows,
        'meaning': 'Static isolated template wrapper counts, includes setup/return, diagnostic code only. Not dynamic instructions, cycles, or an additive decomposition of the measured flips body.'}, indent=2)+'\n')
    print(json.dumps([{r['tag']: [d['staticInstructions'] for d in r['directions']]} for r in rows]))


if __name__ == '__main__':
    main()
