#!/usr/bin/env python3
"""Read-only Phase A archive/flag reinspection. Never authorizes scored play.

Run on the Mac with the historical research root and a fresh output JSON path.
An available old archive is not a certificate of coverage of later PC work.
Unknown roles and every original restriction are retained. No game scores are
read, calculated, filtered, or used to classify an occurrence.
"""
import argparse
import collections
import hashlib
import importlib.util
import json
from pathlib import Path
import platform
import re
import time

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('independent_mailbox', ROOT/'scripts/native/verify.py')
mailbox = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mailbox)


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024*1024), b''):
            h.update(chunk)
    return h.hexdigest()


def read(path):
    return json.loads(path.read_text())


def keys(board):
    result = []
    for player in (1, -1):
        forms = []
        for mirror in (False, True):
            for rotation in range(4):
                values = []
                for row in range(8):
                    for col in range(8):
                        r, c = row, 7-col if mirror else col
                        for _ in range(rotation):
                            r, c = c, 7-r
                        values.append(str(board[r*8+c]*player+1))
                forms.append(''.join(values))
        result.append(hashlib.sha256(min(forms).encode()).hexdigest())
    return result


def pointer(value, location):
    for part in location.strip('/').split('/') if location else []:
        value = value[int(part)] if isinstance(value, list) else value[part]
    return value


def initial():
    b = [0]*64
    b[27] = b[36] = -1
    b[28] = b[35] = 1
    return b


def replay_to(game, opening, stop):
    b, p = opening['board'].copy(), opening['player']
    for step in game['moves'][:stop+1]:
        if step['player'] != p:
            assert not mailbox.children(b, p) and mailbox.children(b, -p)
            p = -p  # Recorded legacy omission of a forced pass.
        assert step['player'] == p
        children = mailbox.children(b, p)
        if step['move'] is None:
            assert not children
        else:
            b = children[step['move']]
        p = -p
    return b


def occurrence_board(raw, occurrence):
    loc = occurrence['location']
    match = re.search(r'/replayed/(\d+)$', loc)
    if match:
        game = pointer(raw, loc[:match.start()])
        return replay_to(game, raw.get('opening', {'board': initial(), 'player': 1}), int(match[1])), 'legally replayed path'
    match = re.search(r'/reserved-root-child-(\d+)$', loc)
    if match:
        trajectory = pointer(raw, loc[:match.start()])
        return mailbox.children(trajectory['root']['board'], trajectory['root']['player'])[int(match[1])], 'reserved alternative'
    match = re.search(r'/(job-label|state-label)/move-(null|\d+)/step-(\d+)$', loc)
    if match:
        parent = pointer(raw, loc[:match.start()])
        state = parent['job']['state'] if match[1] == 'job-label' else parent['state']
        result = parent['result'] if match[1] == 'job-label' else parent.get('result', parent.get('teacher'))
        move = None if match[2] == 'null' else int(match[2])
        row = next(r for r in result['rows'] if r['move'] == move)
        moves = ([] if move is None else [move]) + row.get('pv', [])
        b, p = state['board'].copy(), state['player']
        for q in moves[:int(match[3])]:
            children = mailbox.children(b, p)
            if q is None:
                assert not children
            else:
                b = children[q]
            p = -p
        return b, 'legally replayed teacher continuation'
    value = pointer(raw, loc)
    if isinstance(value, list) and len(value) == 64:
        return value, 'literal board'
    if isinstance(value, str) and re.fullmatch('[012]{64}', value):
        return [int(c)-1 for c in value], 'canonical encoded board (upstream role may remain unknown)'
    if isinstance(value, str) and re.fullmatch(r'-?1:[01\-]+', value):
        player, text = value.split(':')
        board = [int(c) for c in re.findall('-1|[01]', text)]
        assert len(board) == 64 and int(player) in (1, -1)
        return board, 'encoded student-search observation'
    raise ValueError(f'Unsupported occurrence {loc}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('research', type=Path)
    parser.add_argument('current_inventory', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    assert platform.system() == 'Darwin' and platform.machine() == 'arm64'
    start = time.monotonic()
    research = args.research.resolve()
    archive = research/'pc-import-20261029'
    screen = research/'frozen-player-screen-v1-20261029'
    confirmation = research/'p-independent-confirmation-v1-20261029'
    assert not args.output.exists() and not args.output.resolve().is_relative_to(research)
    original_inventory = screen/'pc-inventory-qualified.json'
    assert args.current_inventory.read_bytes() == original_inventory.read_bytes()
    inventory = read(original_inventory)
    lookup = {row['path']: row for row in inventory['files']}
    loaded, files = {}, {}

    def raw(relative):
        if relative not in loaded:
            path = archive/relative
            digest = sha(path)
            assert digest == lookup[relative]['sha256'], relative
            files[relative] = digest
            loaded[relative] = read(path)
        return loaded[relative]

    prior = read(confirmation/'provenance-audit.json')
    focused = read(confirmation/'historical-target-audit.json')
    confirmed = {r['key'] for r in focused['confirmedDirectHistoricalTargetKeys']}
    assert len(prior['violations']) == 65 and len(confirmed) == 2
    frontier_source = archive/'residual-frontier-v1r2-20261028/source/scripts/residual/frontier.mjs'
    assert 'observed.add(observedKey(b,p))' in frontier_source.read_text()
    frontier_relative = frontier_source.relative_to(archive).as_posix()
    assert sha(frontier_source) == lookup[frontier_relative]['sha256']
    files[frontier_relative] = sha(frontier_source)

    def inspect_role(data, o, board, identity):
        path, loc = o['path'], o['location']
        run = path.split('/')[0]
        if '/result/observed/' in loc:
            assert data['job']['type'] == 'root-search'
            return {'kind': 'student-search internal static observation',
                    'collectorSource': frontier_relative, 'notProofOfFitting': True}
        if '/keys/' in loc and '/tasks/pair-' not in path:
            return {'kind': 'exclusion membership; upstream observation role unresolved', 'unresolved': True}
        if '/history/' in loc and ('/trajectories/' in path or '/tasks/generation-' in path):
            tr = data.get('result', data)
            reservation = raw(run+'/reservations.json')
            registry = list(sum(reservation['roles'].values(), [])) if 'roles' in reservation else reservation['assessment']+reservation['games']
            accepted = [r for r in registry if r['seed'] == tr['seed']]
            direct = any(identity in keys(r['board']) or any(identity in keys(c) for c in mailbox.children(r['board'], r['player']).values()) for r in accepted)
            return {'kind': 'accepted-source ancestry' if accepted else 'rejected-generator ancestry',
                    'acceptedIds': [r['id'] for r in accepted], 'isAcceptedRootOrChild': direct,
                    'notProofOfFitting': True}
        if '/reserved-root-child-' in loc:
            tr = data.get('result', data)
            reservation = raw(run+'/reservations.json')
            registry = list(sum(reservation['roles'].values(), [])) if 'roles' in reservation else reservation['assessment']+reservation['games']
            accepted = [r for r in registry if r['seed'] == tr['seed']]
            return {'kind': 'accepted reserved alternative' if accepted else 'rejected-generator alternative',
                    'acceptedIds': [r['id'] for r in accepted], 'restrictionRetained': True}
        if '/tasks/pair-' in path:
            return {'kind': 'played assessment-game path or derived key', 'notProofOfFitting': True}
        if run.startswith('strong-') and '/games/' in loc:
            match = re.match(r'/games/(\d+)', loc)
            game = data['games'][int(match[1])]
            sampled = [i for i, s in enumerate(game.get('states', [])) if identity in keys(s['board'])]
            return {'kind': 'old behavior-game observation', 'game': game['id'],
                    'split': game.get('split'), 'storedSampleIndices': sampled,
                    'evenSampleIndices': [i for i in sampled if i % 2 == 0],
                    'appliedFitProven': identity in confirmed,
                    'note': 'Even sampling alone does not prove accepted/applied use; original restriction retained.'}
        if '/state/board' in loc or '/fixtures/' in loc:
            return {'kind': 'disclosed direct engineering/query state', 'restrictionRetained': True}
        if o['role'] == 'teacher-internal-PV':
            return {'kind': 'returned teacher continuation', 'notProofOfFitting': True}
        if '/history/' in loc:
            return {'kind': 'encoded source ancestry; upstream allocation remains restricted', 'unresolved': True}
        return {'kind': 'occurrence verified; exact upstream role unresolved', 'unresolved': True}

    rows, methods = [], collections.Counter()
    for flag in prior['violations']:
        occurrences = []
        for o in flag['evidence']:
            data = raw(o['path'])
            board, method = occurrence_board(data, o)
            assert flag['key'] in keys(board), (flag['key'], o['path'], o['location'])
            methods[method] += 1
            occurrences.append({'path': o['path'], 'sha256': files[o['path']],
                                'location': o['location'], 'recordedRole': o['role'],
                                'verification': method, 'roleReinspection': inspect_role(data, o, board, flag['key']),
                                'originalClassification': o['classification']})
        rows.append({'key': flag['key'], 'knownOlderAppliedTarget': flag['key'] in confirmed,
                     'occurrencesVerified': occurrences,
                     'originalRestrictionRetained': True,
                     'interpretation': 'Occurrence identity verified; this does not clear an upstream unknown role or prove gradient use.'})

    # Reverify the actual old fit receipt/cursor and exact even-index target.
    manifest = raw('strong-six-hour-20261027/manifest.json')
    learner = archive/'strong-six-hour-20261027/source/scripts/strong/train.mjs'
    coordinator = archive/'strong-six-hour-20261027/source/scripts/strong/run.mjs'
    assert 'g.states.filter((_,i)=>i%2===0)' in learner.read_text()
    assert 'newPaths=s.data.train.slice(from,to)' in coordinator.read_text()
    for name in (learner, coordinator):
        relative = name.relative_to(archive).as_posix()
        assert sha(name) == lookup[relative]['sha256']
        files[relative] = sha(name)
    target_checks = []
    for row in focused['confirmedDirectHistoricalTargetKeys']:
        for e in row['evidence']:
            if not e['evenIndexUsedByFit']:
                continue
            shard = raw(e['path'])
            state = shard['games'][e['gameIndex']]['states'][e['stateIndex']]
            assert e['stateIndex'] % 2 == 0 and row['key'] in keys(state['board'])
            index = next(i for i, p in enumerate(manifest['data']['train']) if p.endswith('/'+e['path'].split('/')[-1]))
            assert index == e['shardIndex'] and manifest['appliedFits'][e['appliedFit']]
            assert manifest['tasks'][e['appliedFit']]['status'] == 'complete'
            fit = raw('strong-six-hour-20261027/tasks/'+e['appliedFit']+'.json')
            assert fit['examples'] > 0 and manifest['fitCursor']['linear-margin-p4'] > index
            target_checks.append({'key': row['key'], 'shard': e['path'], 'game': e['id'],
                                  'stateIndex': e['stateIndex'], 'fit': e['appliedFit'],
                                  'model': 'older linear-margin-p4; not frozen P or L'})

    # Preserve the later native V2 development-query restriction as well.
    proof = read(ROOT/'docs/data/native-v2-overlap-proof-20261030.json')
    for path, digest in proof['files']:
        relative = path.split('pc-import-20261029/')[1]
        assert files.get(relative, sha(archive/relative)) == digest
        raw(relative)
    frontier = raw('residual-frontier-v1r2-20261028/frontiers/development-50.json')
    assert sorted(keys(frontier['result']['parents'][1]['board'])) == sorted(proof['keys'])

    # Byte identities of reusable indices/role inventories, not a new coverage certificate.
    layers = []
    for directory, filename, field in [
        (screen/'history-v2', 'membership.bin', 'digest'),
        (screen/'history-v2', 'occurrences.jsonl.gz', 'occurrencesSha256'),
        (screen/'preflight-final', 'engineering-keys.bin', 'engineeringDigest'),
        (confirmation, 'added-keys.bin', 'addedDigest'),
        (confirmation, 'known-direct-keys.bin', 'knownDirectDigest'),
        (research/'native-v2-20261030', 'history-extra.bin', 'extraDigest'),
    ]:
        meta = read(directory/('preflight.json' if directory.name == 'preflight-final' else 'manifest.json' if directory.name == 'history-v2' else 'history.json'))
        digest = sha(directory/filename)
        assert digest == meta[field], filename
        layers.append({'path': str(directory/filename), 'bytes': (directory/filename).stat().st_size, 'sha256': digest})

    later_runs = ['windows-pc-20261030', 'fast-flips-pc-20261031', 'runtime-cpu-20261031',
                  'runtime-cpu-final-20261031', 'runtime-cpu-followup-20261031',
                  'pc-production-followup-20261031', 'pc-final-production-20261031']
    roots = [p/'.local-research' for p in research.parent.parent.glob('reversi*') if p.is_dir()]
    availability = [{'run': name, 'found': [str(root/name) for root in roots if (root/name).is_dir()]} for name in later_runs]
    body = {'format': 'phase-a-mac-provenance-preflight-v1', 'host': platform.platform(),
            'originalInventory': {'files': inventory['fileCount'], 'bytes': inventory['bytes'],
                                  'sha256': sha(args.current_inventory), 'freshRehashIdentical': True},
            'original65FlagReinspection': rows, 'remainingOriginalFlags': 63,
            'occurrenceMethods': dict(methods), 'olderAppliedTargetReverification': target_checks,
            'laterDevelopmentQueryReverified': {'keys': proof['keys'], 'files': proof['files']},
            'rawInputs': files, 'reusableHistoricalLayers': layers, 'laterPCRunAvailability': availability,
            'completeCoverageCertified': False, 'scoredLaunchPermitted': False,
            'coverageGaps': [
                'No post-import complete PC artifact inventory/role-membership supplement is available in the inspected Mac research roots. Later PC engineering work has published summaries, but the Oct 29 archive cannot certify its complete observations, query continuations, unused or partial inputs.',
                'Later local Mac reservation/game/engineering additions have not been certified together with the missing PC supplement as a complete current exclusion inventory. Existing layer digests remain reusable evidence, not that certificate.'
            ], 'originalConfirmationDecisionUnchanged': True,
            'wallSeconds': time.monotonic()-start,
            'sourceSha256': sha(Path(__file__)), 'independentRulesSourceSha256': sha(ROOT/'scripts/native/verify.py')}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x') as stream:
        json.dump(body, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'output': str(args.output), 'flags': len(rows), 'occurrences': sum(methods.values()),
                      'completeCoverageCertified': False, 'scoredLaunchPermitted': False,
                      'wallSeconds': body['wallSeconds']}))


if __name__ == '__main__':
    main()
