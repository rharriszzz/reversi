#!/usr/bin/env python3
"""Compact board-level witnesses for the completed strict provenance audit.

Both conservative turn keys are one symmetry/color board family, not two leaks.
No fitting application or causal strength explanation is inferred from ancestry.
"""
import importlib.util,json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT))
spec=importlib.util.spec_from_file_location('tournament_verify',ROOT/'scripts/phase-a-mac/verify-tournament.py');v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
out=ROOT/'.local-research/phase-a-m4-tournament-v1';r=v.checked(out/'registration.json');p=v.checked(out/'provenance-verification.json');restricted=set(p['violations']);groups={}
for i,c in enumerate(r['schedule']):
    g=v.checked(out/'games'/f'game-{i}.json')['result'];opening=r['literalOpenings'][c['family']]
    for ply,(b,turn) in enumerate(v.inv.replay(opening['board'],opening['player'],g['moves'])):
        ks=tuple(sorted(v.keys(tuple(b))))
        if not restricted.intersection(ks):continue
        group=groups.setdefault(ks,dict(canonicalKeys=list(ks),board=b,occupied=sum(x!=0 for x in b),locations=[]))
        group['locations'].append(dict(family=c['family'],game=i,ply=ply,player=turn))
for ks,g in groups.items():
    cs=[x for x in p['classifications'] if x['key'] in ks]
    g.update(prohibited=any(x['prohibited'] for x in cs),unresolved=any(x['unresolved'] for x in cs),knownDirectPanel=any(x['knownDirectPanel'] for x in cs),provenOlderDirect=any(x['provenOlderDirect'] for x in cs),roles=sorted({o.get('role','') for x in cs for o in x['evidence']}),evidenceExamples=[])
    seen=set()
    for x in cs:
        for index,o in enumerate(x['evidence']):
            path=o.get('path',o.get('fileIdentity',{}).get('path',str(o.get('file'))));identity=(path,o.get('role'))
            if identity in seen:continue
            seen.add(identity);g['evidenceExamples'].append(dict(key=x['key'],provenanceEvidenceIndex=index,path=path,location=o.get('location'),role=o.get('role'),layer=o.get('layer'),fileSha256=o.get('fileIdentity',{}).get('sha256')))
    g['families']=sorted({x['family'] for x in g['locations']});g['games']=sorted({x['game'] for x in g['locations']})
rows=sorted(groups.values(),key=lambda g:(min(g['games']),min(x['ply'] for x in g['locations'])))
result=dict(registration=r['checksum'],provenance=p['checksum'],restrictedKeys=len(restricted),distinctSymmetryColorBoards=len(rows),affectedFamilies=len({f for g in rows for f in g['families']}),affectedGames=len({i for g in rows for i in g['games']}),allGamesRetained=True,knownDirectPanelMatches=sum(g['knownDirectPanel'] for g in rows),provenOlderTargetMatches=sum(g['provenOlderDirect'] for g in rows),inheritedProhibitedBoards=sum(g['prohibited'] for g in rows),unresolvedBoards=sum(g['unresolved'] for g in rows),rows=rows,sourceSha256=v.sha(__file__))
v.seal(out/'restricted-encounters.json',result)
print(json.dumps({k:v for k,v in result.items() if k not in ('rows','sourceSha256','registration','provenance')}))
