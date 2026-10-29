#!/usr/bin/env python3
"""Build an isolated, pinned teacher without changing any research installation."""
import hashlib
import io
import json
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tarfile
import time

ROOT = Path(__file__).resolve().parents[2]
SOURCE = '713a434f13b3d15fb69c61b9ba3641aed82c496c'
DATA = '786421f355219ade872ce7285c1cab1eaf67836a'
EVAL_SHA = 'f8b2299612d9fa4414157e70e932636e33111c2602d0c2fc382a7d90ef21b792'
sha = lambda data: hashlib.sha256(data).hexdigest()


def setup(destination):
    destination = Path(destination).resolve()
    if not destination.is_relative_to(ROOT / '.local-research'):
        raise ValueError('Installation must be under .local-research')
    if destination.exists():
        raise ValueError('Installation already exists; use it or choose a fresh directory')
    compiler = 'clang' if sys.platform == 'darwin' else 'gcc'
    for tool in ['git', 'make', compiler, 'node']:
        if not shutil.which(tool):
            raise RuntimeError(f'Missing {tool}; Codex should install the native system tool before rerunning. See docs/MAC_PC_BENCHMARK.md.')
    if int(subprocess.check_output(['node', '-p', 'process.versions.node.split(".")[0]'], text=True)) < 20:
        raise RuntimeError('Node 20+ required for offline research tools')
    if sys.platform == 'darwin':
        translated = subprocess.run(['sysctl', '-in', 'sysctl.proc_translated'], capture_output=True, text=True).stdout.strip()
        if translated == '1' or (platform.machine() == 'arm64' and subprocess.check_output(['node', '-p', 'process.arch'], text=True).strip() != 'arm64'):
            raise RuntimeError('Use native ARM64 Python, shell and Node; Rosetta is not an M4 benchmark')
    destination.mkdir(parents=True)
    checkout, build = destination / 'upstream', destination / 'fixed'
    subprocess.run(['git', 'clone', '--no-checkout', 'https://github.com/abulmo/edax-reversi.git', str(checkout)], check=True)
    subprocess.run(['git', 'fetch', 'origin', SOURCE, DATA], cwd=checkout, check=True)
    archive = subprocess.check_output(['git', 'archive', SOURCE], cwd=checkout)
    build.mkdir()
    with tarfile.open(fileobj=io.BytesIO(archive)) as stream:
        for member in stream.getmembers():
            if not (build / member.name).resolve().is_relative_to(build) or member.issym() or member.islnk():
                raise RuntimeError('Unsafe source archive')
        stream.extractall(build)
    patch = ROOT / 'scripts/teacher/edax-bound.patch'
    subprocess.run(['git', 'apply', '--no-index', str(patch)], cwd=build, check=True)
    eval_data = subprocess.check_output(['git', 'show', DATA + ':bin/data/eval.dat'], cwd=checkout)
    if sha(eval_data) != EVAL_SHA:
        raise RuntimeError('Pinned evaluation data hash differs')
    (destination / 'eval.dat').write_bytes(eval_data)
    (build / 'bin').mkdir(exist_ok=True)
    # Architecture-specific instruction selection, same patched numerical source.
    arch = 'armv8-a' if platform.machine() in ('arm64', 'aarch64') else 'x86-64-v3'
    command = ['nice', '-n', '10', 'make', 'build', f'ARCH={arch}', f'CC={compiler}',
               f'OS={"osx" if sys.platform == "darwin" else "linux"}', '-j1']
    files = [{'path': str(f.relative_to(build)), 'sha256': sha(f.read_bytes())} for f in sorted((build / 'src').iterdir())
             if f.suffix in ('.c', '.h') or f.name == 'Makefile']
    start = time.monotonic()
    with (build / 'build.log').open('w') as log:
        subprocess.run(command, cwd=build / 'src', stdout=log, stderr=subprocess.STDOUT, check=True)
    binary = build / 'bin' / f'{"m" if sys.platform == "darwin" else "l"}Edax-{arch}'
    meta = dict(kind='edax-fixed-window-v2', upstream=SOURCE, patchSha256=sha(patch.read_bytes()),
                sourceTreeSha256=sha(json.dumps(files, separators=(',', ':')).encode()), sourceFiles=files,
                binary=str(binary), binarySha256=sha(binary.read_bytes()), compiler=subprocess.check_output([compiler, '--version'], text=True).splitlines()[0],
                command=command, buildSeconds=time.monotonic() - start, dataSource=DATA, evalSha256=EVAL_SHA,
                binaryFormat=subprocess.check_output(['file', str(binary)], text=True).strip(),
                license='GPL-3.0; complete upstream LICENSE/notices and corresponding source retained locally')
    (build / 'build.json').write_text(json.dumps(meta, indent=2) + '\n')
    return build / 'build.json', destination / 'eval.dat'


if __name__ == '__main__':
    print(setup(sys.argv[1] if len(sys.argv) > 1 else ROOT / '.local-research/machine-benchmark-teacher'))
