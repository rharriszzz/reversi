"""Build/check the dependency-free player package. Python standard library only.

Run from any directory: python3 scripts/build-static.py [--check]
Serve dist/ to exercise the real /reversi/ project prefix; upload dist/reversi/.
The allowlist is deliberately literal: new runtime files require review here.
"""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import shutil
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'dist/reversi'
FILES = (
    'index.html', 'style.css', 'assets/apple-touch-icon.png',
    'src/app.js', 'src/backend.js', 'src/coaching.js', 'src/fast-features.js',
    'src/features.js', 'src/review.js', 'src/rules.js', 'src/search.js',
    'src/wasm-engine.js', 'src/worker.js', 'src/wasm/manifest.js',
    'src/wasm/engine-934b888ad89f8d75.mjs',
    'src/wasm/engine-934b888ad89f8d75.wasm',
    'src/wasm/LICENSE.emscripten.txt', 'src/wasm/LICENSE.llvm.txt',
)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def plain(path, base):
    """Reject links in any component, including the output directory itself."""
    if path != base and base not in path.parents:
        raise ValueError(f'Path outside package base: {path}')
    while path != base.parent:
        if path.is_symlink():
            raise ValueError(f'Symlink in package path: {path}')
        if path == base:
            break
        path = path.parent


def reference(base, owner, value):
    url = urlsplit(value)
    if url.scheme or url.netloc or url.path.startswith('/'):
        raise ValueError(f'Nonrelative website reference in {owner}: {value}')
    target = (base / owner).parent.joinpath(unquote(url.path)).resolve()
    if not target.is_relative_to(base.resolve()):
        raise ValueError(f'Escaping reference in {owner}: {value}')
    name = target.relative_to(base.resolve()).as_posix()
    if name not in FILES or not target.is_file():
        raise ValueError(f'Missing/unlisted reference in {owner}: {value}')
    return name


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        self.links += [v for k, v in attrs if k in ('src', 'href')]


def validate(base=None):
    base = OUTPUT if base is None else base
    plain(base, ROOT)
    found = set()
    for path in base.rglob('*'):
        plain(path, base)
        if path.is_file():
            found.add(path.relative_to(base).as_posix())
    if found != set(FILES):
        raise ValueError(f'Package file mismatch: extra={found-set(FILES)}, missing={set(FILES)-found}')
    for name in FILES:
        plain(ROOT / name, ROOT)
        if digest(base / name) != digest(ROOT / name):
            raise ValueError(f'Package differs from source: {name}')
    manifest = json.loads((base / 'src/wasm/manifest.js').read_text().split('export default ')[1].strip().removesuffix(';'))
    if set(manifest['artifacts']) != {Path(n).name for n in FILES if n.endswith(('.wasm', '.mjs'))}:
        raise ValueError('Wasm artifact allowlist does not match manifest')
    for name, expected in manifest['artifacts'].items():
        if digest(base / 'src/wasm' / name) != expected:
            raise ValueError(f'Wasm hash mismatch: {name}')
    # Validate the module graph, including the module worker and dynamic loader.
    # The generated loader's Node-only built-in imports are deliberately excluded.
    parser = Links()
    parser.feed((base / 'index.html').read_text())
    reached = {reference(base, 'index.html', v) for v in parser.links}
    pending = list(reached)
    while pending:
        owner = pending.pop()
        if owner.endswith('.js'):
            source = (base / owner).read_text()
            refs = re.findall(r'\bfrom\s+[\'"]([^\'"]+)[\'"]', source)
            refs += re.findall(r'\bimport\(\s*[\'"]([^\'"]+)[\'"]\s*\)', source)
            refs += re.findall(r'new URL\(\s*[\'"]([^\'"]+)[\'"]', source)
            if owner == 'src/wasm-engine.js':
                refs.append('./wasm/' + manifest['module'])
        elif owner.endswith('.mjs'):
            refs = ['./' + manifest['module'].replace('.mjs', '.wasm')]
            if Path(refs[0]).name not in (base / owner).read_text():
                raise ValueError('Generated loader does not name expected Wasm binary')
        elif owner.endswith('.css'):
            refs = re.findall(r'url\(\s*[\'"]?([^\'"\)\s]+)', (base / owner).read_text())
        else:
            refs = []
        for ref in refs:
            target = reference(base, owner, ref)
            if target not in reached:
                reached.add(target)
                pending.append(target)
    runtime = {n for n in FILES if n.endswith(('.js', '.mjs', '.wasm', '.css', '.png'))}
    if reached != runtime:
        raise ValueError(f'Unreachable runtime files: {runtime-reached}')
    return {'files': len(FILES), 'bytes': sum((base/n).stat().st_size for n in FILES),
            'fingerprint': manifest['fingerprint'], 'models': manifest['models'],
            'sha256': {n: digest(base/n) for n in FILES}}


def build():
    plain(OUTPUT, ROOT)
    if OUTPUT.exists():
        extras = {p.relative_to(OUTPUT).as_posix() for p in OUTPUT.rglob('*') if p.is_file()} - set(FILES)
        if extras:
            raise ValueError(f'Refusing output containing unexpected files: {extras}')
    for name in FILES:
        source, dest = ROOT / name, OUTPUT / name
        plain(source, ROOT)
        plain(dest, ROOT)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, dest)
    return validate()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Validate the existing package without modifying it')
    args = parser.parse_args()
    print(json.dumps(validate() if args.check else build(), indent=2))
