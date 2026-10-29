#!/usr/bin/env python3
"""PC-side read-only hashed inventory. Not an independence certificate or index.

Output stays outside all input directories. No raw research contents are copied.
Every file is hashed before/after stable stat checks. Symlinks are refused.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path


def inventory(root, record_pc_links=False):
    root = Path(root).resolve()
    rows = []
    for path in sorted(root.rglob('*')):
        if path.is_symlink():
            target = os.readlink(path)
            relative = path.relative_to(root).as_posix()
            # Reviewed PC snapshot aliases. Record the literal link, never follow
            # it into either the current checkout or the imported archive.
            allowed = (path.name == '.local-research' and target == '/home/rharris/git/reversi/.local-research'
                       or 'fit-source' in relative and target in (
                           '/home/rharris/git/reversi/src', '/home/rharris/git/reversi/scripts/teacher'))
            if not record_pc_links or not allowed:
                raise ValueError(f'Symlink requires explicit provenance review: {path}')
            raw = os.fsencode(target)
            rows.append({'path': relative, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
                         'kind': 'symlink', 'target': target, 'followed': False})
            continue
        if not path.is_file():
            continue
        before = path.stat()
        digest = hashlib.sha256()
        with path.open('rb') as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                digest.update(chunk)
        after = path.stat()
        if (before.st_size, before.st_mtime_ns, before.st_ino) != (after.st_size, after.st_mtime_ns, after.st_ino):
            raise ValueError(f'Input changed while hashing: {path}')
        rows.append({'path': path.relative_to(root).as_posix(), 'bytes': after.st_size,
                     'sha256': digest.hexdigest()})
    if not rows:
        raise ValueError('Empty historical input directory')
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--record-reviewed-pc-links', action='store_true')
    args = parser.parse_args()
    root, output = args.input.resolve(), args.output.resolve()
    if output == root or root in output.parents:
        parser.error('Output must be outside inventoried input')
    rows = inventory(root, args.record_reviewed_pc_links)
    body = {'format': 'frozen-player-history-inventory-v1', 'files': rows,
            'fileCount': len(rows), 'bytes': sum(r['bytes'] for r in rows),
            'independenceCertified': False}
    output.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation: never overwrite a previous inventory.
    with output.open('x') as stream:
        json.dump(body, stream, separators=(',', ':'))
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())
    print(json.dumps({'output': str(output), 'files': len(rows), 'bytes': body['bytes'],
                      'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}))


if __name__ == '__main__':
    main()
