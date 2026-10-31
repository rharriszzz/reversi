#!/usr/bin/env python3
"""Resolve legacy wrapper/teacher PV encodings using actual bound source roots.

No search or game outcome calculations. Failed decodings remain explicit; these
are format exceptions rather than asserted illegal historical engine moves.
"""
import argparse
import collections
import functools
import gzip
import importlib.util
import json
import random
import re
from pathlib import Path

spec=importlib.util.spec_from_file_location('inventory',Path(__file__).with_name('inventory.py'))
inv=importlib.util.module_from_spec(spec);spec.loader.exec_module(inv)


def pointer(value,loc):
    for k in loc.strip('/').split('/') if loc.strip('/') else []:
        value=value[int(k)] if isinstance(value,list) else value[k]
    return value


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('extraction',type=Path);parser.add_argument('custom_paths',type=Path);parser.add_argument('output',type=Path)
    a=parser.parse_args();a.output.mkdir(exist_ok=False)
    m=inv.read(a.extraction/'manifest.json')
    with gzip.open(a.extraction/'files.jsonl.gz','rt') as f:files=[json.loads(s) for s in f]
    @functools.lru_cache(maxsize=512)
    def raw(path):return inv.read(path)
    research=Path('/Users/rharris/git/reversi/.local-research')
    screen=research/'frozen-player-screen-v1-20261029'
    def registry(path):
        roots={}
        for p in [path.parent,*path.parent.parents]:
            if p.name=='.local-research':break
            for n in ('engineering-inputs.json','reservations.json','reservation.json','preflight.json'):
                if (p/n).is_file():
                    v=raw(p/n)
                    for r in v.get('roots',[]):
                        if inv.isboard(r.get('board')):roots.setdefault(r.get('id'),r)
                    for row in v.get('rows',[]):
                        r=row.get('root') if isinstance(row,dict) else None
                        if isinstance(r,dict) and inv.isboard(r.get('board')):roots.setdefault(r.get('id'),r)
        return roots
    scientific={r['id']:r for r in raw(screen/'scientific/reservations.json')['roots']}
    pilot=raw(research/'pc-import-20261029/residual-frontier-v1r2-20261028/pilot-reservation.json')
    pilot_roots={r['id']:r for r in pilot.get('roots',[])}
    identities={}
    for q in ('qualification','qualification-v1'):
        p=research/'p-independent-confirmation-v1-20261029'/q/'report.json'
        for g in raw(p)['games']:identities[g['game']['identity']]=g['opening']
    remaining=[];resolved=[];keys=set();rows=[]
    def record(board,player,file,loc,role):
        if sum(v!=0 for v in board)<12:return
        ks=inv.identities(tuple(board));keys.update(ks)
        rows.append(dict(keys=ks,file=file,location=loc,player=player,role=role))
    for gap in m['replayGaps']:
        f=files[gap['file']];path=Path(f['localPath']);v=raw(path);loc=gap['location'];parent=loc.rsplit('/',1)[0]
        owner=pointer(v,parent);steps=pointer(v,loc);root=None
        if isinstance(v,dict) and isinstance(v.get('job'),dict):
            s=v['job'].get('root')
            if isinstance(s,dict) and inv.isboard(s.get('board')):root=s
        # Nearest serialized query/opening has precedence over a family number
        # in a different registration (qualification is not a scored family).
        parts=parent.strip('/').split('/') if parent else []
        for n in range(len(parts),-1,-1):
            if root:break
            ancestor=pointer(v,'/'+'/'.join(parts[:n]))
            if not isinstance(ancestor,dict):continue
            for k in ('state','opening','root'):
                s=ancestor.get(k)
                if isinstance(s,dict) and inv.isboard(s.get('board')) and s.get('player') in (1,-1):root=s;break
            if root:break
            if isinstance(ancestor.get('identity'),str) and ancestor['identity'] in identities:root=identities[ancestor['identity']];break
            if ancestor.get('rootId') in registry(path):root=registry(path)[ancestor['rootId']];break
            if path.name in ('frozen-player-screen-20261029.json','witnesses.json') and ancestor.get('source') in scientific:root=scientific[ancestor['source']];break
            if ancestor.get('openingId') in scientific:root=scientific[ancestor['openingId']];break
            if path.name=='residual-frontier-v1-20261028.json' and ancestor.get('id') in pilot_roots:root=pilot_roots[ancestor['id']];break
        if path.name in ('custom-game.json','safari-qualification-20261030.json') and 'moves' in owner:
            root=dict(board=inv.initial(),player=1)
        try:
            if root is None:raise ValueError('No explicit compatible root binding located')
            if loc.endswith('/pv'):
                def number(q):
                    if q in (None,-1,'pass'):return None
                    if isinstance(q,str) and len(q)==2:return (int(q[1])-1)*8+ord(q[0].lower())-97
                    return q
                steps=list(map(number,steps))
                # Historical teacher rows store PV *after* the root move.
                if ('value' in owner or '/continuations/' in loc) and owner.get('move') is not None:steps=[number(owner['move'])]+steps
            states=list(inv.replay(root['board'],root['player'],steps,True))
            endpoint=owner.get('endpoint',owner.get('leaf'))
            if isinstance(endpoint,dict) and inv.isboard(endpoint.get('board')):
                if states[-1][0]!=endpoint['board']:raise ValueError('Serialized continuation endpoint differs')
                if endpoint.get('player') in (1,-1) and states[-1][1]!=endpoint['player']:raise ValueError('Serialized endpoint turn differs')
            if loc.endswith('/moves') and inv.isboard(owner.get('board')) and states[-1][0]!=owner['board']:
                raise ValueError('Serialized played final board differs')
            for i,(b,p) in enumerate(states):record(b,p,gap['file'],f'{loc}/reconciled/{i}','replayed historical observation; no fitting inferred')
            resolved.append(gap)
        except (ValueError,KeyError,TypeError,IndexError) as e:
            remaining.append(dict(**gap,reconciliationReason=str(e)))
    text_inputs=[]
    for i,f in enumerate(files):
        if f['kind']!='file' or not f['path'].endswith('.txt'):continue
        count=0
        for line_number,line in enumerate(Path(f['localPath']).read_text(errors='replace').splitlines()):
            match=re.fullmatch(r'([0-9a-fA-F]{1,16})\s+([0-9a-fA-F]{1,16})(?:\s+-?\d+)+\s*',line)
            if not match:continue
            black,white=map(lambda s:int(s,16),match.groups())
            if black&white:continue
            board=[1 if black>>q&1 else -1 if white>>q&1 else 0 for q in range(64)]
            if sum(v!=0 for v in board)<12:continue
            record(board,None,i,f'/line/{line_number}','engineering bitboard input; orientation covered by both-turn/color identities')
            count+=1
        if count:text_inputs.append(dict(file=i,source=f['source'],path=f['path'],sha256=f['sha256'],boards=count))
    custom=inv.read(a.custom_paths)
    saved=raw(research/'safari-qualification-20261030/custom-game.json')
    import hashlib
    assert hashlib.sha256(json.dumps(custom['candidate'],sort_keys=True).encode()).hexdigest()==saved['weightsSha256']
    for i,g in enumerate(custom['games']):
        states=list(inv.replay(g['opening']['board'],g['opening']['player'],g['moves'],True))
        assert states[-1][0]==g['board']
        for j,(b,p) in enumerate(states):record(b,p,str(a.custom_paths),f'/games/{i}/{j}','unrelated historical custom-model selection assessment; reconstructed')
    # The pure backend pilot collector kept only timings. Recover its exact
    # seeded source prefixes/roots/alternatives, never invent timed continuations.
    pilot_inputs=[]
    for budget in (80,300):
        seed=0x4d345000+budget;rng=random.Random(seed);b=inv.initial();p=1
        for i in range(8):
            cs=inv.mailbox.children(b,p)
            if not cs:p=-p;cs=inv.mailbox.children(b,p)
            q=rng.choice(sorted(cs));b=cs[q];p=-p
            record(b,p,'scripts/mac/backend-games.py',f'/pilot/{budget}/source/{i}','known backend engineering source prefix; no fitting')
        for q,c in inv.mailbox.children(b,p).items():record(c,-p,'scripts/mac/backend-games.py',f'/pilot/{budget}/root-child/{q}','known backend engineering root alternative')
        pilot_inputs.append(dict(budgetMs=budget,seed=seed,board=b,player=p,playedPathRetained=False,
                                 role='P native versus P Wasm unscored timing pilot; not model fitting/selection assessment'))
    with gzip.open(a.output/'occurrences.jsonl.gz','xt') as f:
        for row in rows:f.write(json.dumps(row,separators=(',',':'))+'\n')
    with (a.output/'keys.bin').open('xb') as f:
        for k in sorted(keys):f.write(bytes.fromhex(k))
    count=inv.merge([a.extraction/'membership.bin',a.output/'keys.bin'],a.output/'membership.bin')
    result=dict(format='phase-a-reconciled-wrappers-v1',baseManifestSha256=inv.sha(a.extraction/'manifest.json'),
                resolved=len(resolved),remaining=remaining,addedOccurrenceKeys=len(keys),keys=count,
                customAssessmentPaths=8,customSavedWeightsHashMatched=True,customSeed=custom['seed'],
                customPathsSha256=inv.sha(a.custom_paths),sourceSha256=inv.sha(__file__),
                backendPilotSources=pilot_inputs,
                textBitboardInputs=text_inputs,
                artifacts={n:inv.sha(a.output/n) for n in ('occurrences.jsonl.gz','keys.bin','membership.bin')})
    inv.write(a.output/'manifest.json',result)
    print(json.dumps({k:result[k] for k in ('resolved','keys','customAssessmentPaths')}));print('remaining',len(remaining))


if __name__=='__main__':main()
