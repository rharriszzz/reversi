"""Static x86 inspection of the actual measured fixed-work engine binaries.

Instruction counts are static, not executed instructions/cycles. Padding outside
the ELF symbol's declared size is excluded. Keep ordinary optimized code intact.
"""
import collections
import json
import os
import re
import subprocess
from pathlib import Path


def inspect(executable, symbol):
    symbols = subprocess.check_output(['nm', '-S', '--defined-only', str(executable)], text=True)
    row = next(line.split() for line in symbols.splitlines() if line.split()[-1] == symbol)
    start, size = int(row[0], 16), int(row[1], 16)
    text = subprocess.check_output(['objdump', '-d', '--no-show-raw-insn',
                                    '--disassemble=' + symbol, str(executable)], text=True)
    instructions = []
    for line in text.splitlines():
        match = re.match(r'\s*([0-9a-f]+):\s+(\S+)\s*(.*)', line)
        if match and start <= int(match[1], 16) < start + size:
            instructions.append({'offset': int(match[1], 16)-start,
                                 'op': match[2], 'operands': match[3]})
    conditional = [i for i in instructions if i['op'].startswith('j') and i['op'] != 'jmp']
    backwards = [i for i in conditional if int(i['operands'].split()[0], 16) < start+i['offset']]
    return {'symbol': symbol, 'start': hex(start), 'bytes': size,
            'staticInstructions': len(instructions), 'conditionalBranches': len(conditional),
            'backwardConditionalBranches': len(backwards),
            'mnemonics': dict(collections.Counter(i['op'] for i in instructions)),
            'instructions': instructions}


def main():
    out = Path(os.environ['REVERSI_FLIP_RUN']).resolve()
    rows = []
    for tag in ['original', 'ray-table', 'refined', 'late-ray', 'doubling']:
        exe = out/tag/'fixed-work'
        functions = {name: inspect(exe, symbol) for name, symbol in {
            'flips': '_ZN7reversi5flipsEmmi',
            'play': '_ZN7reversi4playENS_5BoardEii',
        }.items()}
        nm = subprocess.check_output(['nm', '-S', '--defined-only', str(exe)], text=True)
        late = next(line.split()[-1] for line in nm.splitlines() if '11lastEmpties' in line)
        functions['lastEmpties'] = inspect(exe, late)
        tables = [line.split() for line in nm.splitlines()
                  if 'flipRays' in line or 'flip_experiment4rays' in line]
        rows.append({'tag': tag, 'functions': functions,
                     'geometryTableBytes': sum(int(line[1], 16) for line in tables),
                     'inlinedDirectionSymbols': [line for line in nm.splitlines() if 'flipsIn' in line],
                     'size': subprocess.check_output(['size', str(exe)], text=True)})
    (out/'assembly.json').write_text(json.dumps({'rows': rows}, indent=2)+'\n')
    print(json.dumps([{**{'tag': r['tag'], 'geometryTableBytes': r['geometryTableBytes']},
                       **{k: v for k, v in r['functions']['flips'].items()
                          if k not in ['instructions', 'mnemonics']}} for r in rows], indent=2))


if __name__ == '__main__':
    main()
