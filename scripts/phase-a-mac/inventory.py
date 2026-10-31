#!/usr/bin/env python3
"""Inventory retained evidence, without following links or opening score summaries.

This produces a conservative *retained-record* inventory, never an automatic
completeness certificate. Unknown observations stay restricted. Applied training
use requires separate receipts; a filename or generator role cannot prove it.
The original 21 GB inventory and occurrence layers are reused by digest.
"""
import argparse
import collections
import functools
import gzip
import hashlib
import heapq
import importlib.util
import json
import mmap
import os
from pathlib import Path
import re
import time

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('mailbox', ROOT/'scripts/native/verify.py')
mailbox = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mailbox)
SKIP_VALUES = {'score', 'scores', 'margin', 'outcome', 'points', 'statistics',
               'gameSummary', 'pairRows', 'gameBootstrap', 'rawBlackMargin'}
SOFTWARE = {'site-packages', 'node_modules', 'plot-venv', 'retired-python310-venv',
            'native-browser-venv', 'python-tools', 'matplotlib', '__pycache__'}


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda: f.read(1024*1024), b''):
            h.update(b)
    return h.hexdigest()


def write(path, value):
    with Path(path).open('x') as f:
        json.dump(value, f, separators=(',', ':'))
        f.write('\n')


def read(path):
    return json.loads(Path(path).read_text())


@functools.lru_cache(maxsize=512)
def registrations(directory):
    result = []
    for parent in [directory, *directory.parents]:
        if parent.name == '.local-research':
            break
        for name in ('registration.json', 'reservation.json', 'reservations.json', 'backend-registration.json'):
            p = parent/name
            if p.is_file():
                value = read(p)
                if isinstance(value, dict):
                    result.append(value)
    return result


def bound_root(path, value):
    condition = value.get('condition') if isinstance(value, dict) else None
    family = condition.get('family') if isinstance(condition, dict) else value.get('family') if isinstance(value, dict) else None
    game_index = re.search(r'(?:game-|prefix-|checkpoint-)(\d+)', path.name)
    for reg in registrations(path.parent):
        roots = reg.get('openings', reg.get('roots', reg.get('families', [])))
        if not isinstance(roots, list):
            continue
        index = family
        if index is None and game_index and 'schedule' in reg:
            i = int(game_index[1])
            if i < len(reg['schedule']):
                index = reg['schedule'][i].get('family')
        if type(index) is int:
            named = next((r for r in roots if r.get('id') == f'games-{index}'), None)
            root = named or (roots[index] if 0 <= index < len(roots) else None)
            if root and isboard(root.get('board')):
                return root
    return None


def initial():
    b = [0]*64
    b[27] = b[36] = -1
    b[28] = b[35] = 1
    return b


def isboard(x):
    return isinstance(x, list) and len(x) == 64 and all(type(v) is int and v in (-1, 0, 1) for v in x)


PERMUTATIONS = []
for mirror in (False, True):
    for rotation in range(4):
        permutation = []
        for row in range(8):
            for col in range(8):
                r, c = row, 7-col if mirror else col
                for _ in range(rotation):
                    r, c = c, 7-r
                permutation.append(r*8+c)
        PERMUTATIONS.append(permutation)


@functools.lru_cache(maxsize=100000)
def identities(board):
    return tuple(hashlib.sha256(min(''.join(str(board[q]*p+1) for q in perm)
                                  for perm in PERMUTATIONS).encode()).hexdigest()
                 for p in (1, -1))


def replay(board, player, steps, implicit_pass=False):
    """Replay placements/passes only. No search, outcome or score calculation."""
    b, p, passes = list(board), player, 0
    yield b, p
    for step in steps:
        cs = mailbox.children(b, p)
        if isinstance(step, dict):
            move = step['move']
            turn = step.get('player', p)
        else:
            move, turn = step, p
        if implicit_pass and not cs and mailbox.children(b, -p) and move not in (None, -1):
            p = -p
            cs = mailbox.children(b, p)
        if turn != p:
            raise ValueError('Recorded turn differs from legal replay')
        if passes == 2:
            raise ValueError('Move after terminal passes')
        if move in (None, -1):
            if cs:
                raise ValueError('Illegal pass')
            passes += 1
        else:
            if type(move) is not int or move not in cs:
                raise ValueError(f'Illegal placement {move}')
            b, passes = cs[move], 0
        p = -p
        yield b, p


def inventory(sources):
    rows, stats = [], {}
    for source in sources:
        root = Path(source['path'])
        count, size = 0, 0
        for directory, dirs, names in os.walk(root, followlinks=False):
            # Links are records, not new roots. Do not recurse into their target.
            links = [n for n in dirs if (Path(directory)/n).is_symlink()]
            dirs[:] = sorted(n for n in dirs if n not in links)
            if source.get('filesOnly'):
                dirs[:] = []
            for name in sorted(names+links):
                p = Path(directory)/name
                if 'phase-a-provenance' in p.parts:
                    continue  # This publication's output, outside historical data.
                relative = p.relative_to(root).as_posix()
                before = p.lstat()
                if p.is_symlink():
                    target = os.readlink(p)
                    raw = os.fsencode(target)
                    row = dict(kind='symlink', target=target, followed=False,
                               bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
                elif p.is_file():
                    row = dict(kind='file', bytes=before.st_size, sha256=sha(p))
                else:
                    raise ValueError(f'Unsupported filesystem record {p}')
                after = p.lstat()
                stamp = lambda s: (s.st_size, s.st_mtime_ns, s.st_ino)
                if stamp(before) != stamp(after):
                    raise ValueError(f'Input changed while hashing {p}')
                rows.append(dict(source=source['id'], path=relative,
                                 localPath=str(p), originalPath=source['originalPath']+'/'+relative,
                                 mtimeNs=after.st_mtime_ns, inode=after.st_ino, **row))
                count += 1
                size += row['bytes']
        stats[source['id']] = dict(files=count, bytes=size)
        print(json.dumps(dict(stage='inventory', source=source['id'], files=count, bytes=size)), flush=True)
    return rows, stats


def merge(paths, output):
    files = [Path(p).open('rb') for p in paths]
    maps = []
    try:
        for f in files:
            size = os.fstat(f.fileno()).st_size
            if size % 32:
                raise ValueError('Malformed SHA-256 membership shard')
            if size:
                maps.append(mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ))
        def iterator(m):
            previous = None
            for i in range(0, len(m), 32):
                k = m[i:i+32]
                if previous is not None and k <= previous:
                    raise ValueError('Membership shard is not strictly sorted')
                previous = k
                yield k
        old, count = None, 0
        with Path(output).open('xb') as out:
            for k in heapq.merge(*(iterator(m) for m in maps)):
                if k != old:
                    out.write(k)
                    count += 1
                    old = k
        return count
    finally:
        for m in maps:
            m.close()
        for f in files:
            f.close()


class Extractor:
    def __init__(self, stream):
        self.stream, self.keys = stream, set()
        self.counts, self.seeds = collections.Counter(), set()
        self.replays, self.errors, self.opaque = 0, [], 0
        self.file = None
        self.bound = {}

    def emit(self, b, location, role, player=None, method='literal', source_id=None):
        if not isboard(b) or sum(v != 0 for v in b) < 12:
            return
        ks = identities(tuple(b))
        self.keys.update(ks)
        self.counts[role] += 1
        self.stream.write(json.dumps(dict(keys=ks, file=self.file, location=location,
                                         role=role, appliedFitting='not established by this extraction',
                                         player=player, sourceId=source_id, method=method,
                                         occupied=sum(v != 0 for v in b)), separators=(',', ':'))+'\n')

    def path(self, b, p, steps, loc, role, implicit=False, expected=None):
        states = list(replay(b, p, steps, implicit))
        if expected is not None and states[-1][0] != expected:
            raise ValueError('Replayed final board differs from recorded board')
        for i, (board, turn) in enumerate(states):
            self.emit(board, f'{loc}/replayed/{i}', role, turn, 'independent mailbox replay')
        self.replays += 1

    def visit(self, value, loc='', role='unresolved observation; restrict conservatively', player=None, root=None):
        if isinstance(value, str):
            if re.fullmatch('[012]{64}', value):
                self.emit([int(c)-1 for c in value], loc, 'encoded ancestry; upstream role unresolved', method='canonical encoding')
            elif re.fullmatch(r'-?1:[01,\-]+', value):
                p, b = value.split(':')
                cells = list(map(int, b.split(','))) if ',' in b else list(map(int, re.findall('-1|[01]', b)))
                self.emit(cells, loc, 'internal student-search observation', int(p), 'encoded observation')
            elif re.fullmatch('[0-9a-f]{64}', value) and re.search(r'/(?:keys|usedKeys|forbiddenKeys|ancestryKeys)/', loc):
                self.keys.add(value)
                self.stream.write(json.dumps(dict(keys=[value], file=self.file, location=loc,
                                                 role='opaque exclusion membership; upstream role unresolved'))+'\n')
                self.opaque += 1
            return
        if not isinstance(value, (dict, list)):
            return
        if isinstance(value, list):
            if isboard(value):
                self.emit(value, loc, role, player)
            elif len(value) == 8 and all(isinstance(x, str) and re.fullmatch('[.BW]{8}', x) for x in value):
                self.emit([{'B': 1, 'W': -1, '.': 0}[v] for v in ''.join(value)], loc, role, player)
            else:
                for i, v in enumerate(value):
                    self.visit(v, f'{loc}/{i}', role, player, root)
            return
        if value.get('player') in (1, -1):
            player = value['player']
        if type(value.get('seed')) is int:
            self.seeds.add(value['seed'])
        declared = value.get('role', value.get('spec', {}).get('role'))
        if declared is not None:
            role = f'declared {declared}; application not inferred'
        if isboard(value.get('board')) and player in (1, -1):
            query_root = dict(board=value['board'], player=player)
            if 'moves' not in value and 'steps' not in value:
                root = query_root
            if any(k in loc.lower() for k in ('reservation', 'roots', 'openings', 'families', '/root', '/positions/', '/state', '/parents/')):
                for move, child in mailbox.children(query_root['board'], player).items():
                    self.emit(child, f'{loc}/derived-child/{move}', 'reserved/query alternative; restrict', -player)
        opening = value.get('opening')
        if isinstance(opening, dict) and isboard(opening.get('board')):
            root = opening
        for state in (value.get('state'), value.get('job', {}).get('state') if isinstance(value.get('job'), dict) else None,
                      value.get('input', {}).get('s') if isinstance(value.get('input'), dict) else None):
            if isinstance(state, dict) and isboard(state.get('board')) and state.get('player') in (1, -1):
                root = state
        identity = value.get('identity')
        if isinstance(identity, str) and identity in self.bound:
            root = self.bound[identity]
        if root and isinstance(identity, str):
            self.bound[identity] = root
        if isinstance(value.get('pv'), list) and root is not None:
            pv = value['pv']
            def move_number(m):
                if m in (None, -1, 'pass'):
                    return None
                if isinstance(m, str) and re.fullmatch('[a-hA-H][1-8]', m):
                    return (int(m[1])-1)*8+ord(m[0].lower())-97
                return m
            pv = list(map(move_number, pv))
            if '/rows/' in loc and value.get('move') is not None:
                pv = [move_number(value['move'])]+pv
            try:
                self.path(root['board'], root['player'], pv, f'{loc}/pv', 'returned search continuation; no fitting inferred')
            except (KeyError, ValueError, TypeError) as e:
                self.errors.append(dict(file=self.file, location=f'{loc}/pv', reason=str(e)))
        for field in ('moves', 'steps'):
            steps = value.get(field)
            if not isinstance(steps, list) or not steps:
                continue
            if not all(type(s) is int or isinstance(s, dict) and 'move' in s for s in steps):
                continue
            if field == 'moves' and all(isinstance(s, dict) and 'pv' in s for s in steps) and 'passes' not in value and 'points' not in value:
                # Analyze replies contain alternative moves, not one game path.
                continue
            # A source trajectory is always replayed from the initial board;
            # ordinary games use their bound root, never their final board.
            if 'history' in value and 'root' in value and 'spec' in value:
                b, p = initial(), 1
                path_role = 'generated source trajectory; acceptance/application not inferred'
                expected = value['history'][-1]['board'] if value['history'] else None
            elif isboard(value.get('board')) and ('/openings/' in loc or '/families/' in loc or 'history' in value and 'seed' in value):
                b, p, path_role, expected = initial(), 1, 'generated opening prefix', value['board']
            elif isinstance(opening, dict) and isboard(opening.get('board')):
                b, p, path_role, expected = opening['board'], opening['player'], 'played path', value.get('board')
            elif root is not None:
                b, p, path_role, expected = root['board'], root['player'], 'played path', value.get('board')
            elif 'index' in value and 'human' in value:
                b, p, path_role, expected = initial(), 1, 'played engineering acceptance path', value.get('board')
            elif 'split' in value and 'states' in value:
                b, p, path_role, expected = initial(), 1, 'legacy behavior game; sampled fitting requires receipt', value.get('board')
            else:
                # Root opening prefixes and other unsupported formats remain
                # explicit gaps. Never guess an origin to obtain a legal path.
                self.errors.append(dict(file=self.file, location=f'{loc}/{field}',
                                        reason='unbound move path', count=len(steps)))
                continue
            try:
                self.path(b, p, steps, f'{loc}/{field}', path_role, True, expected)
            except (KeyError, ValueError, TypeError) as e:
                self.errors.append(dict(file=self.file, location=f'{loc}/{field}', reason=str(e)))
        for k, v in value.items():
            if k not in SKIP_VALUES:
                child_role = role
                if k in ('history', 'ancestry'):
                    child_role = 'source ancestry; acceptance/application not inferred'
                elif k == 'observed':
                    child_role = 'internal student-search observation'
                self.visit(v, f'{loc}/{k}', child_role, player, root)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sources', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--reuse-catalog', type=Path, help='Reuse an earlier at-rest hash catalog; all recorded metadata is rechecked')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=False)
    started = time.monotonic()
    sources = read(args.sources)
    for s in sources:
        if args.output.resolve().is_relative_to(Path(s['path']).resolve()):
            raise ValueError('Output must be outside historical sources')
    if args.reuse_catalog:
        with gzip.open(args.reuse_catalog, 'rt') as f:
            rows = [json.loads(line) for line in f]
        stats = {}
        for s in sources:
            rs = [r for r in rows if r['source'] == s['id']]
            stats[s['id']] = dict(files=len(rs), bytes=sum(r['bytes'] for r in rs))
    else:
        rows, stats = inventory(sources)
    with gzip.open(args.output/'files.jsonl.gz', 'xt') as f:
        for row in rows:
            f.write(json.dumps(row, separators=(',', ':'))+'\n')
    parsed, excluded, parse_errors, seen = [], collections.Counter(), [], {}
    with gzip.open(args.output/'occurrences.jsonl.gz', 'xt') as f:
        extractor = Extractor(f)
        for i, row in enumerate(rows):
            p = Path(row['localPath'])
            if row['kind'] != 'file':
                excluded['literal symlink record; not followed'] += 1
                continue
            if p.suffix not in ('.json', '.jsonl'):
                excluded['non-JSON: identity retained; no automatic scientific decoding'] += 1
                continue
            if any(part in SOFTWARE for part in p.parts):
                excluded['software dependency/cache'] += 1
                continue
            if row['sha256'] in seen:
                parsed.append(dict(file=i, aliasOf=seen[row['sha256']]))
                continue
            seen[row['sha256']] = i
            extractor.file = i
            try:
                if p.suffix == '.jsonl':
                    with p.open() as stream:
                        for n, line in enumerate(stream):
                            if line.strip():
                                value = json.loads(line)
                                extractor.visit(value, f'line/{n}', root=bound_root(p, value))
                else:
                    value = read(p)
                    extractor.visit(value, root=bound_root(p, value))
                parsed.append(dict(file=i))
            except (ValueError, KeyError, TypeError, UnicodeError) as e:
                parse_errors.append(dict(file=i, reason=str(e)))
    with (args.output/'supplement.bin').open('xb') as f:
        for key in sorted(extractor.keys):
            f.write(bytes.fromhex(key))
    # Content and membership of the old immutable layers stay inspectable.
    prior = read(ROOT/'docs/data/phase-a-mac/preflight.json')
    layers = prior['reusableHistoricalLayers']
    for layer in layers:
        if sha(layer['path']) != layer['sha256']:
            raise ValueError(f'Prior layer changed: {layer["path"]}')
    membership = [x['path'] for x in layers if x['path'].endswith('.bin')]
    size = merge(membership+[args.output/'supplement.bin'], args.output/'membership.bin')
    # Detect changes and additions/removals across this extraction, without
    # following historical symlinks. Stable stats complement per-file hashing.
    for row in rows:
        st = Path(row['localPath']).lstat()
        if st.st_mtime_ns != row['mtimeNs'] or st.st_ino != row['inode']:
            raise ValueError(f'Input changed after hashing {row["localPath"]}')
    body = dict(format='phase-a-retained-inventory-v1', sources=sources, runs=stats,
                originalArchive=prior['originalInventory'], originalArchiveRehash='reused qualified prior rehash; not repeated',
                priorLayers=layers, files=len(rows), parsed=parsed, excluded=dict(excluded),
                parseErrors=parse_errors, replayGaps=extractor.errors, replays=extractor.replays,
                occurrenceRoles=dict(extractor.counts), supplementalKeys=len(extractor.keys),
                keys=size, seeds=sorted(extractor.seeds), completeCoverageCertified=False,
                scoredLaunchPermitted=False, sourceSha256=sha(__file__),
                artifacts={n:sha(args.output/n) for n in ('files.jsonl.gz', 'occurrences.jsonl.gz', 'supplement.bin', 'membership.bin')},
                wallSeconds=time.monotonic()-started,
                limitation='Retained-file extraction; unsupported paths and non-JSON scientific encodings require review. No applied-target role is inferred from filenames or declarations.')
    write(args.output/'manifest.json', body)
    print(json.dumps({k:body[k] for k in ('files','keys','supplementalKeys','replays','wallSeconds')}), flush=True)
    print(json.dumps(dict(parseErrors=len(parse_errors), replayGaps=len(extractor.errors))), flush=True)


if __name__ == '__main__':
    main()
