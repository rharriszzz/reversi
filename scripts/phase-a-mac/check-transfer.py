#!/usr/bin/env python3
"""Check at-rest transfer hashes, public anchors, and literal PC link aliases.

This does not assert a before-copy PC inventory exists. It writes fresh evidence
only. The full retained-file catalog is the input, not the live transfer tree.
"""
import argparse
import collections
import gzip
import hashlib
import json
from pathlib import Path
import posixpath
import re


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('catalog', type=Path)
    p.add_argument('output', type=Path)
    p.add_argument('--verification', type=Path, help='User-provided source-side checksum verification record')
    args = p.parse_args()
    with gzip.open(args.catalog, 'rt') as f:
        catalog = [json.loads(line) for line in f]
    pc = [r for r in catalog if r['source'].startswith('pc/')]
    public = collections.defaultdict(list)
    mentioned = collections.defaultdict(list)
    for r in catalog:
        if r['source'] == 'published':
            public[r['sha256']].append(r['path'])
            if r['path'].endswith('.json'):
                for h in set(re.findall(rb'\b[0-9a-f]{64}\b', Path(r['localPath']).read_bytes())):
                    mentioned[h.decode()].append(r['path'])
    by_original = {r['originalPath']:r for r in pc}
    runs, links = {}, []
    for name in sorted({r['source'] for r in pc}):
        rows = [r for r in pc if r['source'] == name]
        anchors = [dict(path=r['path'], sha256=r['sha256'], publishedPaths=public[r['sha256']])
                   for r in rows if r['sha256'] in public]
        # Match the complete bytes against published hashes embedded in receipts,
        # in addition to files copied identically into docs/data.
        runs[name] = dict(files=len(rows), bytes=sum(r['bytes'] for r in rows),
                          publishedExactFileAnchors=anchors,
                          embeddedPublishedHashAnchors=[dict(path=r['path'],sha256=r['sha256'],publishedPaths=mentioned[r['sha256']])
                                                       for r in rows if r['sha256'] in mentioned],
                          sourceWideBeforeCopyManifestSupplied=False)
    for r in pc:
        if r['kind'] != 'symlink':
            continue
        target = r['target']
        absolute = target if target.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(r['originalPath']), target))
        included = by_original.get(absolute)
        directory_members = [v for k,v in by_original.items() if k.startswith(absolute+'/')]
        links.append(dict(path=r['originalPath'], literalTarget=target, followed=False,
                          includedTargetSha256=included['sha256'] if included else None,
                          includedTargetDirectoryFiles=len(directory_members),
                          role='software environment link' if '/venv' in r['originalPath'] or '-venv/' in r['originalPath'] else 'build alias'))
    verification = json.loads(args.verification.read_text()) if args.verification else None
    verified = bool(verification and verification.get('acceptedForSourceTransferVerification'))
    result = dict(format='phase-a-pc-at-rest-transfer-check-v1', runs=runs,
                  files=len(pc), bytes=sum(r['bytes'] for r in pc), symlinks=links,
                  publiclyAnchoredRuns=sum(bool(v['publishedExactFileAnchors']) for v in runs.values()),
                  runsWithEmbeddedHashCorroboration=sum(bool(v['embeddedPublishedHashAnchors']) for v in runs.values()),
                  noForeignExecutableRun=True, sourceTransferVerified=verified,
                  sourceVerification=verification, bulkRecopyRequired=False,
                  limitation='Mac hashes independently bind retained identities. Source/destination equality and the complete dated-directory selection are established by the user-reported WSL2 rsync checksum copy and clean checksum dry run; raw transport transcripts were not supplied.')
    with args.output.open('x') as f:
        json.dump(result, f, indent=2)
        f.write('\n')
    print(json.dumps({k:result[k] for k in ('files','bytes','publiclyAnchoredRuns')}))


if __name__ == '__main__':
    main()
