"""Descriptive diagnostics only, callable after independent audit and analysis."""
import collections,importlib.util,pathlib,statistics,sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('verify300',pathlib.Path(__file__).with_name('verify-tournament.py'));v=importlib.util.module_from_spec(s);s.loader.exec_module(v)
out=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'.local-research/phase-a-300ms-m4-v1'
r=v.registration(out);integrity=v.checked(out/'integrity-verification.json');a=v.checked(out/'analysis.json');assert integrity['passed'] and a['analysisAfterIntegrityAndProvenance']
games=[v.checked(out/'games'/f'game-{i}.json') for i in range(512)]
family_dist=dict(sorted(collections.Counter(str(p['score']) for p in a['pairRows']).items()))
margins=[g['result']['margin'] for g in games]
splits=[]
for name,key in [('policy',lambda x:x['policy']),('occupied',lambda x:sum(bool(b) for b in x['board'])),('actualTurn',lambda x:x['player']),('firstColor',lambda x:x['firstColor'])]:
    values=sorted({key(root) for root in r['literalOpenings']})
    for value in values:
        rows=[p for p in a['pairRows'] if key(r['literalOpenings'][p['family']])==value]
        splits.append(dict(split=name,value=value,families=len(rows),score=statistics.mean(p['score'] for p in rows),margin=statistics.mean(p['margin'] for p in rows)))
# Root mobility is a descriptive view of the selected opening distribution.
for lo,hi in [(2,5),(6,8),(9,64)]:
    rows=[p for p in a['pairRows'] if lo<=len(v.children(r['literalOpenings'][p['family']]['board'],r['literalOpenings'][p['family']]['player']))<=hi]
    if rows:splits.append(dict(split='rootLegalMoves',value=[lo,hi],families=len(rows),score=statistics.mean(p['score'] for p in rows),margin=statistics.mean(p['margin'] for p in rows)))
cost=v.checked(out/'evaluation-cost.json');costs=[]
for phase in ('opening','middle','endgame'):
    selected=[x for x in cost['rows'] if phase==('opening' if x['occupied']<28 else 'middle' if x['occupied']<52 else 'endgame')]
    b=[x['elapsedMs']/x['evaluations']*1e6 for x in selected if x['model']=='B'];p=[x['elapsedMs']/x['evaluations']*1e6 for x in selected if x['model']=='P']
    costs.append(dict(phase=phase,BmedianNanoseconds=statistics.median(b),PmedianNanoseconds=statistics.median(p),ratio=statistics.median(p)/statistics.median(b)))
# Fully preserved illustrative continuations. Selecting large B wins is explicitly
# post hoc; it is not evidence of minimax mistakes or a causal feature attribution.
examples=[]
for game in sorted(games,key=lambda g:g['result']['margin'])[:3]:
    root=r['literalOpenings'][game['condition']['family']];b=root['board'];turn=root['player'];corners=[]
    for ply,m in enumerate(game['result']['moves']):
        if m['move'] in (0,7,56,63):corners.append(dict(ply=ply,model=m['model'],move=m['move'],depth=m['depth'],occupied=m['occupied']))
        if m['move'] is not None:b=v.children(b,turn)[m['move']]
        turn=-turn
    examples.append(dict(index=game['index'],family=root['family'],cell=root['cell'],Pcolor=game['condition']['color'],Pmargin=game['result']['margin'],opening=root,corners=corners,moves=game['result']['moves']))
result=dict(registration=r['checksum'],descriptiveOnly=True,noAdditionalConfirmationTests=True,familyScoreCounts=family_dist,familiesAboveHalf=sum(p['score']>.5 for p in a['pairRows']),familiesAtHalf=sum(p['score']==.5 for p in a['pairRows']),familiesBelowHalf=sum(p['score']<.5 for p in a['pairRows']),gameMarginSummary=dict(min=min(margins),median=statistics.median(margins),max=max(margins),q25=v.quantile(margins,.25),q75=v.quantile(margins,.75)),splits=splits,matchedStaticCost=costs,BsuccessExamples=examples)
v.seal(out/'diagnostics.json',result)
print(__import__('json').dumps({k:val for k,val in result.items() if k!='BsuccessExamples'}))
