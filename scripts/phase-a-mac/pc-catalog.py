#!/usr/bin/env python3
"""Read-only source-side transfer check. Standard library; never follows links.

Hash only the requested later runs, record the complete top-level run listing,
and write one fresh small compressed manifest outside the research directory.
No original corpus or engine executable is opened or copied.
"""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import platform


def compare(source, mac_rows):
    expected = {r['path']:r for r in source['files']}
    actual = {}
    for row in mac_rows:
        if row['source'].startswith('pc/'):
            path = row['source'][3:]+'/'+row['path']
            actual[path] = {k:row[k] for k in ('kind','bytes','sha256','target') if k in row}
    missing = sorted(expected.keys()-actual.keys())
    extra = sorted(actual.keys()-expected.keys())
    changed = [p for p in expected.keys() & actual.keys()
               if {k:expected[p][k] for k in ('kind','bytes','sha256','target') if k in expected[p]} != actual[p]]
    return dict(equal=not(missing or extra or changed), missing=missing, extra=extra,
                changed=sorted(changed), sourceTopLevelEntries=source['topLevelEntries'])


def collect(root, names):
    rows = []
    top = sorted(p.name for p in root.iterdir())
    for name in names:
        if Path(name).name != name or name in ('.', '..'):
            raise ValueError('Run names must be single directory names')
        base = root/name
        if not base.is_dir() or base.is_symlink():
            raise ValueError(f'Missing or linked run root {base}')
        for directory, dirs, files in os.walk(base, followlinks=False):
            links = [n for n in dirs if (Path(directory)/n).is_symlink()]
            dirs[:] = sorted(n for n in dirs if n not in links)
            for n in sorted(files+links):
                path = Path(directory)/n
                before = path.lstat()
                if path.is_symlink():
                    target = os.readlink(path)
                    raw = os.fsencode(target)
                    row = dict(kind='symlink', target=target, bytes=len(raw),
                               sha256=hashlib.sha256(raw).hexdigest())
                else:
                    h = hashlib.sha256()
                    with path.open('rb') as stream:
                        for block in iter(lambda: stream.read(1024*1024), b''):
                            h.update(block)
                    row = dict(kind='file', bytes=before.st_size, sha256=h.hexdigest())
                after = path.lstat()
                if (before.st_size, before.st_mtime_ns, before.st_ino) != (after.st_size, after.st_mtime_ns, after.st_ino):
                    raise ValueError(f'Input changed {path}')
                rows.append(dict(path=path.relative_to(root).as_posix(), **row))
    if top != sorted(p.name for p in root.iterdir()):
        raise ValueError('Top-level run listing changed')
    return dict(format='phase-a-pc-source-catalog-v1', root=str(root), host=platform.node(),
                platform=platform.platform(), topLevelEntries=top, selectedRuns=names,
                files=rows, count=len(rows), bytes=sum(r['bytes'] for r in rows),
                linksFollowed=False, noEngineOrGameExecution=True)


def main():
    if len(os.sys.argv)>1 and os.sys.argv[1]=='--compare':
        p = argparse.ArgumentParser(description='Compare source-side manifest with committed Mac transfer catalog')
        p.add_argument('--compare', type=Path, required=True)
        p.add_argument('mac_catalog', type=Path)
        a = p.parse_args()
        with gzip.open(a.compare, 'rt') as f:
            source = json.load(f)
        with gzip.open(a.mac_catalog, 'rt') as f:
            mac_rows = [json.loads(line) for line in f]
        result = compare(source, mac_rows)
        print(json.dumps(result, indent=2))
        raise SystemExit(0 if result['equal'] else 1)
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('root', type=Path)
    p.add_argument('run_list', type=Path)
    p.add_argument('output', type=Path)
    a = p.parse_args()
    root, output = a.root.resolve(), a.output.resolve()
    if output.is_relative_to(root):
        p.error('Output must be outside historical research input')
    result = collect(root, json.loads(a.run_list.read_text()))
    with output.open('xb') as raw:
        with gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0) as stream:
            stream.write((json.dumps(result, separators=(',', ':'))+'\n').encode())
    print(json.dumps(dict(output=str(output), files=result['count'], bytes=result['bytes'],
                          sha256=hashlib.sha256(output.read_bytes()).hexdigest())))


if __name__ == '__main__':
    main()
