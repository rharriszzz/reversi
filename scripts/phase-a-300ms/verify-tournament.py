#!/usr/bin/env python3
"""Independent mailbox, admission, receipt, provenance and family-statistics audit.

No aggregate strength computation in fixture/reservation/integrity modes. Historical
role scans precede analysis; restricted encounters never remove registered games.
"""
import argparse, collections, datetime, functools, gzip, hashlib, importlib.util, json, math, mmap, pathlib, statistics, sys, time
ROOT=pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from scripts.native.verify import children, cdf, tail
spec=importlib.util.spec_from_file_location('phase_inventory',ROOT/'scripts/phase-a-mac/inventory.py')
inv=importlib.util.module_from_spec(spec);spec.loader.exec_module(inv)
read=inv.read;sha=inv.sha;keys=inv.identities

def checked(path):
    raw=pathlib.Path(path).read_bytes().strip();v=json.loads(raw)
    assert hashlib.sha256(raw[:raw.rindex(b',"checksum":')]+b'}').hexdigest()==v['checksum'],f'Checksum {path}'
    return v

def raw_member(path,key):
    text=pathlib.Path(path).read_text().strip();at=text.index('"'+key+'":')+len(key)+3
    _,end=json.JSONDecoder().raw_decode(text,at)
    return text[at:end].encode()

def seal(path,value):
    # Python's serialization is its own audit receipt, checked by raw bytes.
    raw=json.dumps(value,separators=(',',':'),ensure_ascii=False).encode()
    v=raw[:-1]+b',"checksum":'+json.dumps(hashlib.sha256(raw).hexdigest()).encode()+b'}\n'
    with pathlib.Path(path).open('xb') as f:f.write(v)
    return json.loads(v)

def member(mm,text):
    key=bytes.fromhex(text);lo,hi=0,len(mm)//32
    while lo<hi:
        mid=(lo+hi)//2;v=mm[mid*32:(mid+1)*32]
        if v==key:return True
        if v<key:lo=mid+1
        else:hi=mid
    return False

def trajectory(tr):
    b=inv.initial();p=1;history=[];found=False;passes=0
    for m in tr['moves']:
        assert passes<2 and m['player']==p
        if sum(v!=0 for v in b)>=12:history.append(dict(board=b.copy(),player=p))
        if tr['root']==dict(board=b,player=p):found=True
        cs=children(b,p)
        if m['move'] is None:assert not cs;passes+=1
        else:assert m['move'] in cs;b=cs[m['move']];passes=0
        p=-p
    assert passes==2 and b==tr['terminal'] and history==tr['history']
    if tr['root']:
        assert found and tr['root']['player']==tr['spec']['player']
        assert sum(v!=0 for v in tr['root']['board'])==tr['target']==tr['spec']['occupied']
        assert len(children(tr['root']['board'],tr['root']['player']))>=2
    else:
        assert not any(sum(v!=0 for v in s['board'])==tr['target'] and s['player']==tr['spec']['player'] and len(children(s['board'],s['player']))>=2 for s in history)
    boards=[s['board'] for s in history]
    if tr['root']:boards += [tr['root']['board']]+list(children(tr['root']['board'],tr['root']['player']).values())
    return {k for b in boards if children(b,1) or children(b,-1) for k in keys(tuple(b))}

def replay(opening,g,receipt=None):
    b=list(opening['board']);p=opening['player'];passes=0;states=[(b.copy(),p)]
    for m in g['moves']:
        assert passes<2 and m['player']==p;cs=children(b,p)
        if m['move'] is None:assert not cs;passes+=1
        else:
            assert m['move'] in cs
            assert m['occupied']==sum(x!=0 for x in b)
            if receipt:
                assert m['model']==('P' if p==g['color'] else 'B')
                assert m['modelIdentity']==receipt['models'][m['model']]
                assert m['buildIdentity']==receipt['fingerprint'] and m['backend']=='native' and m['budgetMs']==300
                assert 1<=m['depth']<=64-m['occupied'] and m['evaluations']<=m['nodes']
                assert m['ttCutoffs']<=m['ttBoundHits']<=m['ttHits']<=m['ttProbes']<=m['nodes']
                assert m['tableBytes']<=16*1024**2 and m['elapsedMs']>=0 and m['measuredMs']>=0
                assert math.isclose(m['overrunMs'],max(0,m['measuredMs']-300),abs_tol=1e-8)
                if m['exact']:verify_early_terminal_exact(m,b,p)
            b=cs[m['move']];passes=0
        p=-p;states.append((b.copy(),p))
    assert passes==2 and not children(b,1) and not children(b,-1) and b==g['board']
    # Per-game terminal consistency, not aggregate strength inspection.
    margin=sum(b)*g['color'];outcome=(margin>0)-(margin<0)
    assert g['margin']==margin and g['outcome']==outcome and g['points']==(1+outcome)/2
    return states

@functools.lru_cache(maxsize=100000)
def exact(board,player):
    cs=children(board,player)
    if not cs:
        if not children(board,-player):
            margin=sum(board)*player
            return 0 if margin==0 else (10000 if margin>0 else -10000)+margin
        return -exact(board,-player)
    return max(-exact(tuple(child),-player) for child in cs.values())
EARLY_EXACT=[]
def verify_early_terminal_exact(m,b,p):
    assert m['depth']<=64-m['occupied']
    if m['depth']<64-m['occupied']:
        value=exact(tuple(b),p);chosen=-exact(tuple(children(b,p)[m['move']]),-p)
        assert value==chosen==m['score']
        EARLY_EXACT.append(dict(board=b.copy(),player=p,move=m['move'],depth=m['depth'],occupied=m['occupied'],score=value))

def additional_exclusions(r):
    binding=r['additionalExclusions']
    for p,h in binding['files'].items():assert sha(p)==h,p
    base=ROOT/'docs/data/phase-a-tournament';all_keys=set();seeds=set()
    with gzip.open(base/'admission-attempts.jsonl.gz','rt') as f:
        for line in f:
            tr=json.loads(line)['trajectory'];all_keys.update(trajectory(tr));seeds.add(tr['seed'])
            if tr['root'] is None:
                for state in tr['history']:all_keys.update(keys(tuple(state['board'])))
    fixtures=read(base/'fixtures.json')
    for tr in read(base/'development-test-trajectories.json')+fixtures['attempts']:
        all_keys.update(trajectory(tr));seeds.add(tr['seed'])
    old=read(base/'registration.json')
    with gzip.open(base/'games.json.gz','rt') as f:public=json.load(f)
    games=public['games']
    for g in games:
        game=dict(g,moves=[dict(player=p,move=m) for p,m in g['moves']])
        for row in g['telemetry']:
            move=dict(zip(public['telemetryColumns'],row));ply=move.pop('ply');game['moves'][ply].update(move)
        for b,p in replay(old['literalOpenings'][g['family']],game):all_keys.update(keys(tuple(b)))
    for g in fixtures['games']:
        for b,p in replay(g['opening'],g['result']):all_keys.update(keys(tuple(b)))
    for p in binding['files']:
        if p.endswith(('history.json','history-v2/manifest.json','preflight-final/preflight.json')):seeds.update(read(p).get('seeds',[]))
    digest=hashlib.sha256(b''.join(bytes.fromhex(k) for k in sorted(all_keys))).hexdigest()
    assert digest==binding['indexSha256'] and len(all_keys)==binding['keys']
    assert sorted(seeds)==binding['seeds']
    return all_keys,seeds

def rng(seed):
    a=seed&0xffffffff
    while True:
        a=(a+0x6d2b79f5)&0xffffffff;t=((a^(a>>15))*(a|1))&0xffffffff
        t=(t^((t+(((t^(t>>7))*(t|61))&0xffffffff))&0xffffffff))&0xffffffff
        yield ((t^(t>>14))&0xffffffff)/4294967296

def expected_schedule(protocol):
    families=list(range(256));random=rng(protocol['orderSeed'])
    for i in range(255,0,-1):
        j=int(next(random)*(i+1));families[i],families[j]=families[j],families[i]
    return [dict(family=f,candidate='P',timeMs=300,color=c) for f in families for c in ((-1 if f&8 else 1),(1 if f&8 else -1))]

def registration(out,public=False):
    r=checked(out/'registration.json');assert r['status']=='registered'
    assert len(r['literalOpenings'])==256 and len(r['schedule'])==512 and r['schedule']==expected_schedule(r['protocol'])
    assert r['protocol']['families']==256 and r['protocol']['timeMs']==300 and r['protocol']['alpha']==.05 and r['protocol']['capMinutes']==240
    assert r['protocol']['models']=={k:r['receipt']['models'][k] for k in ('B','P')}
    if not public:
        for p,h in r['sources'].items():assert sha(ROOT/p)==h and sha(out/'snapshot'/p)==h,p
        assert sha(r['receipt']['executable'])==r['executableSha256']==r['receipt']['executableSha256']
    return r

def fixture(out):
    f=checked(out/'fixtures.json');assert f['nonconfirmation']
    for tr in f['attempts']:trajectory(tr)
    for tr in read(out/'development-test-trajectories.json'):trajectory(tr)
    calibration=checked(out/'calibration.json')
    for g in f['games']+calibration['games']:replay(g['opening'],g['result'])
    pair=checked(out/'fixture-pair.json');assert pair['games']==f['games']
    # A real saved complete-pair checkpoint survives a new interpreter invocation;
    # corrupted bytes must fail, independently of the JS receipt implementation.
    raw=(out/'fixture-pair.json').read_bytes();assert hashlib.sha256(raw).hexdigest()==sha(out/'fixture-pair.json')
    return dict(passed=True,fixture=f['checksum'],sourceTrajectories=len(f['attempts'])+4,games=4,calibration=calibration['checksum'],independentMailbox=True,completePairCheckpoint=True)

def reservation(out,r):
    binding=r['historicalInventory'];assert sha(binding['indexPath'])==binding['indexSha256']
    extraction=pathlib.Path(binding['extraction']);manifest=read(extraction/'manifest.json');assert sha(extraction/'manifest.json')==binding['extractionManifestSha256']
    additional_keys,additional_seeds=additional_exclusions(r)
    seeds=set(manifest['seeds'])|additional_seeds|{tr['seed'] for tr in checked(out/'fixtures.json')['attempts']}|{tr['seed'] for tr in read(out/'development-test-trajectories.json')};owners={};fixture_keys=set(r['fixtures']['keys']);accepted=[];rejections=[];cells=collections.Counter()
    with pathlib.Path(binding['indexPath']).open('rb') as f,mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ) as mm:
        assert len(mm)==17321472*32
        for i,digest in r['attemptReceiptInventory']:
            path=out/'attempts'/f'{i}.json';assert sha(path)==digest;a=checked(path);tr=a['trajectory'];assert a['attempt']==i==tr['attempt']
            seed=int.from_bytes(hashlib.sha256(f"{r['protocol']['namespace']}:{a['spec']['role']}:{i}".encode()).digest()[:4],'little')
            assert tr['seed']==a['seed']==seed
            assert tr['spec']==a['spec'];ks=trajectory(tr);reason=None
            if tr['root'] is None:reason='no-root'
            elif seed in seeds:reason='seed-reuse'
            elif any(k in owners or k in fixture_keys or k in additional_keys or member(mm,k) for k in ks):reason='historical-or-mutual-exclusion'
            assert a['reason']==reason and a['decision']==('rejected' if reason else 'accepted')
            if reason:
                rejections.append(i)
                if a['conflict']:
                    k=a['conflict']['key'];assert k in ks and (k in owners or k in fixture_keys or k in additional_keys or member(mm,k))
                continue
            r0=r['literalOpenings'][len(accepted)];spec0=a['spec'];family=len(accepted);cell=family%16
            assert r0['family']==family and r0['cell']==cell and r0['cycle']==family//16
            assert spec0['occupied']==12+((cell>>1)&1) and spec0['policy']==('B4-2%' if cell&1 else 'B1-12%')
            assert spec0['player']==(-1 if (cell>>1)&1 else 1) and spec0['reverse']==bool(cell&4) and spec0['firstColor']==(-1 if cell&8 else 1)
            assert spec0['family']==family and r0['attempt']==i and r0['seed']==seed and r0['attemptReceipt']==a['checksum']
            registered_tr=r['sourceTrajectories'][family];assert registered_tr==dict(family=family,seed=seed,attempt=i,root=tr['root'],moves=tr['moves'],terminal=tr['terminal'],trajectoryHash=r0['trajectoryHash'])
            path=out/'trajectories'/f"{r0['id']}.json";assert read(path)==tr and hashlib.sha256(path.read_bytes().strip()).hexdigest()==r0['trajectoryHash']
            assert r0['board']==([-v for v in tr['root']['board']] if r0['reverse'] else tr['root']['board'])
            assert r0['player']==(-tr['root']['player'] if r0['reverse'] else tr['root']['player'])
            for k in ks:owners[k]=family
            seeds.add(seed);accepted.append(i);cells[cell]+=1
    assert len(accepted)==256 and set(cells.values())=={16} and len(cells)==16
    assert len(rejections)==len(r['rejections'])==r['attempts']-256
    assert [x['attempt'] for x in r['rejections']]==rejections
    return dict(passed=True,registration=r['checksum'],families=256,games=512,attempts=r['attempts'],rejected=len(rejections),distinctAdmissionKeys=len(owners),allHistoricalAndMutualChecks=True,independentMailbox=True,independentCanonicalization=True,allAttemptReceiptsVerified=True)

def game_integrity(out,r):
    previous=None;receipts=[];prefixes=[];pairs=[];states=[];move_count=0;process_ids=set()
    for pair in range(256):
        pp=out/'pairs'/f'pair-{pair}.json';p=checked(pp);assert p['registration']==r['checksum'] and p['pair']==pair and p['previous']==previous
        assert p['family']==r['schedule'][pair*2]['family'] and sorted(p['colors'])==[-1,1]
        for j in range(2):
            i=pair*2+j;path=out/'games'/f'game-{i}.json';g=checked(path);condition=r['schedule'][i];opening=r['literalOpenings'][condition['family']]
            assert p['games'][j]==g['checksum'] and g['registration']==r['checksum'] and g['index']==i and g['condition']==condition
            assert hashlib.sha256(raw_member(path,'result')).hexdigest()==g['resultHash']
            assert g['openingHash']==hashlib.sha256(json.dumps(opening,separators=(',',':')).encode()).hexdigest()
            assert g['result']['color']==condition['color'] and g['result']['timeMs']==300
            assert g['committed']>r['at']
            publication=read(out/'registration-publication.json')
            assert publication['remoteVerified'] and publication['registration']==r['checksum']
            assert g['committed']>publication['at']
            # JS's inner identity is audited independently using the registered literal inner protocol.
            inner=r['innerGameProtocol']
            identity_body=dict(opening=opening,color=condition['color'],timeMs=300,protocol=inner,build=r['receipt']['fingerprint'])
            inner_hash=hashlib.sha256(json.dumps(identity_body,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
            assert g['result']['identity']==inner_hash
            assert g['processIds']['B']!=g['processIds']['P'] and all(type(pid) is int and pid>0 for pid in g['processIds'].values())
            process_ids.update(g['processIds'].values())
            for model,h in g['hello'].items():assert h['cpuBackend']=='single-target' and h['models']==list(r['receipt']['models'].values())
            path_states=replay(opening,g['result'],r['receipt']);move_count+=len(g['result']['moves'])
            states.extend((b,turn,condition['family'],i,ply) for ply,(b,turn) in enumerate(path_states))
            prefix=out/'prefix'/f'prefix-{i}.json';v=read(prefix)
            assert v['registration']==r['checksum'] and v['index']==i and v['condition']==condition
            assert v['game']['identity']==g['result']['identity']
            assert v['game']['moves']==g['result']['moves'] and v['game']['board']==g['result']['board'] and v['game']['passes']==2
            nested=raw_member(prefix,'game');n=json.loads(nested);assert hashlib.sha256(nested[:nested.rindex(b',"checksum":')]+b'}').hexdigest()==n['checksum']
            receipts.append([i,sha(path)]);prefixes.append([i,sha(prefix)])
        pairs.append([pair,sha(pp)]);previous=p['checksum']
    done=checked(out/'execution-complete.json');assert done['registration']==r['checksum'] and done['lastPair']==previous and done['games']==512
    assert len(process_ids)==1024
    return dict(passed=True,registration=r['checksum'],games=512,families=256,freshProcessIds=1024,innerIdentitiesAndPublicationTemporalOrder=True,moveRecords=move_count,receipts=receipts,prefixes=prefixes,pairs=pairs,legalReplay=True,terminalOutcomes=True,modelBuildAndTimeControlVerified=True,earlyTerminalExactCasesIndependentlySolved=len(EARLY_EXACT),earlyTerminalExactRecords=EARLY_EXACT.copy()),states

def provenance(out,r,states):
    b=r['historicalInventory'];hits={};overlaps=[];owners={};convergence=[]
    additional_keys,_=additional_exclusions(r)
    fixture_keys=set(r['fixtures']['keys'])
    with pathlib.Path(b['indexPath']).open('rb') as f,mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ) as mm:
        for board,turn,family,game,ply in states:
            terminal=not children(board,1) and not children(board,-1);occupied=sum(v!=0 for v in board)
            for k in keys(tuple(board)):
                loc=dict(key=k,family=family,game=game,ply=ply,occupied=occupied,terminal=terminal)
                if k in owners and owners[k]!=family:convergence.append(dict(loc,otherFamily=owners[k]))
                else:owners[k]=family
                if member(mm,k) or k in fixture_keys or k in additional_keys:
                    hits.setdefault(k,[]);overlaps.append(loc)
    extraction=pathlib.Path(b['extraction']);reconciled=pathlib.Path(b['indexPath']).parent
    # Original occurrence IDs refer to the retained original import inventory.
    oldroot=pathlib.Path('/Users/rharris/git/reversi/.local-research');screen=oldroot/'frozen-player-screen-v1-20261029';old=oldroot/'p-independent-confirmation-v1-20261029';v2=oldroot/'native-v2-20261030'
    inv0=read(screen/'pc-inventory-before.json')['files'];m0=checked(screen/'history-v2/manifest.json')
    with gzip.open(extraction/'files.jsonl.gz','rt') as f:catalog=[json.loads(line) for line in f]
    scan=[]
    streams=[(screen/'history-v2/occurrences.jsonl.gz',next(x['sha256'] for x in b['priorLayers'] if x['path'].endswith('history-v2/occurrences.jsonl.gz')),'original'),(extraction/'occurrences.jsonl.gz',b['artifacts']['occurrences.jsonl.gz'],'extraction'),(reconciled/'occurrences.jsonl.gz',b['reconciledArtifacts']['occurrences.jsonl.gz'],'reconciled')]
    for path,digest,layer in streams:
        assert sha(path)==digest;count=0
        with gzip.open(path,'rt') as f:
            for line in f:
                o=json.loads(line);count+=1
                for k in o.get('keys',[]):
                    if k not in hits:continue
                    record=dict(o,layer=layer)
                    if layer=='original':
                        file=o.get('file');record['path']=inv0[file]['path'] if file<len(inv0) else m0['localInputs'][file-len(inv0)]
                    elif isinstance(o.get('file'),int):record['fileIdentity']=catalog[o['file']]
                    hits[k].append(record)
        scan.append(dict(path=str(path),sha256=digest,rows=count))
        print(json.dumps(dict(stage='historical-occurrence-audit',layer=layer,rows=count)),flush=True)
    for path in (old/'added-occurrences.json',v2/'history-extra-occurrences.json'):
        for o in read(path):
            for k in o.get('keys',[]):
                if k in hits:hits[k].append(dict(o,layer=str(path)))
    prior={}
    for path in (old/'provenance-audit.json',v2/'provenance-audit.json'):
        for c in read(path)['classifications']:
            if c['key'] in hits:prior.setdefault(c['key'],[]).append(dict(path=str(path),prohibited=c['prohibited'],unresolved=c.get('unknown',c.get('unresolved',False))))
    direct_path=old/'known-direct-keys.bin';assert sha(direct_path)==next(x['sha256'] for x in b['priorLayers'] if x['path']==str(direct_path))
    proven=set(x['key'] for x in read(old/'historical-target-audit.json')['confirmedDirectHistoricalTargetKeys'])
    for k in hits:
        if k in additional_keys:hits[k].append(dict(layer='previous-80ms-M4-study',role='previously reserved source or played research path; not P/L fitting',provenPLFit=False))
    classifications=[]
    with direct_path.open('rb') as f,mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ) as direct:
        for k,evidence in hits.items():
            locs=[v for v in overlaps if v['key']==k];nonterminal=any(not v['terminal'] for v in locs)
            known_direct=nonterminal and member(direct,k);older=nonterminal and k in proven
            prior_restrict=any(v['prohibited'] or v['unresolved'] for v in prior.get(k,[]))
            prohibited=nonterminal and (known_direct or older or any(v['prohibited'] for v in prior.get(k,[])))
            unresolved=nonterminal and prior_restrict and not prohibited
            decisions=[]
            for o in evidence:
                role=o.get('role','');allowed=role in {'previous-played-path','played-game-state','teacher-internal-PV','internal-PV','declared-source-ancestry','played path','played engineering acceptance path','internal student-search observation','returned search continuation; no fitting inferred'}
                restricted=role in {'direct','direct-scored-child','previous-reserved-root','previous-reserved-child','reserved/query alternative; restrict'} or 'custom-model selection assessment' in role
                decisions.append(dict(role=role,permittedIncidental=allowed,prohibited=restricted,unresolved=not allowed and not restricted))
                if nonterminal:prohibited=prohibited or restricted;unresolved=unresolved or not allowed and not restricted
            if nonterminal and not evidence:unresolved=True
            if nonterminal and k in fixture_keys:unresolved=True
            classifications.append(dict(key=k,nonterminal=nonterminal,knownDirectPanel=known_direct,provenOlderDirect=older,prohibited=bool(prohibited),unresolved=bool(unresolved),priorRestrictions=prior.get(k,[]),evidence=evidence,roleDecisions=decisions,newLocations=locs))
    violations=[c['key'] for c in classifications if c['prohibited'] or c['unresolved']]
    return dict(registration=r['checksum'],auditCompleted=True,sourceAdmissionPassed=True,prospectivePolicyPassed=True,historicalNoveltyRequired=False,legacyStrictNoveltyWouldPass=not violations,scoreSummariesOpened=False,allOutcomesRetained=True,legacyStrictRestrictedKeys=violations,legacyClassificationMeaning='Old broad role flags, not proof of P/L leakage and not this experiment admission criteria.',classifications=classifications,overlaps=overlaps,crossFamilyPlayedConvergences=convergence,occurrenceScans=scan,policy=r['protocol']['independence'],verifiedPLPanelEncounterKeys=[c['key'] for c in classifications if c['knownDirectPanel']],verifiedPLPanelScope='Verified combined fitting/development/selection direct-state index; membership alone does not identify a fitted coefficient or causal influence. Other historical roles stay separately disclosed.',provenUnrelatedOlderFitKeys=[c['key'] for c in classifications if c['provenOlderDirect']],unresolvedHistoricalKeys=[c['key'] for c in classifications if c['unresolved']])

def quantile(xs,p):
    a=sorted(xs);q=(len(a)-1)*p;i=int(q);return a[i]+(a[math.ceil(q)]-a[i])*(q-i)

def critical(df,p):
    lo,hi=0.,8.
    for _ in range(45):
        mid=(lo+hi)/2
        if cdf(mid,df)<p:lo=mid
        else:hi=mid
    return (lo+hi)/2

def analyze(out,r):
    integrity=checked(out/'integrity-verification.json');p=checked(out/'provenance-verification.json');assert integrity['passed'] and p['auditCompleted'] and integrity['registration']==p['registration']==r['checksum']
    games=[checked(out/'games'/f'game-{i}.json')['result'] for i in range(512)];rows=[]
    for family,root in enumerate(r['literalOpenings']):
        gs=[g for i,g in enumerate(games) if r['schedule'][i]['family']==family];assert len(gs)==2 and {g['color'] for g in gs}=={-1,1}
        rows.append(dict(family=family,cell=root['cell'],score=statistics.mean(g['points'] for g in gs),margin=statistics.mean(g['margin'] for g in gs)))
    xs=[x['score'] for x in rows];mean=statistics.mean(xs);variance=statistics.variance(xs);se=math.sqrt(variance/256);student=mean-critical(255,.95)*se;hoeffding=mean-math.sqrt(math.log(20)/512)
    random=rng(r['protocol']['bootstrapSeed']);groups=[[v for v in rows if v['cell']==cell] for cell in range(16)];bs=[];bm=[]
    for _ in range(10000):
        chosen=[g[int(next(random)*16)] for g in groups for _ in range(16)];bs.append(statistics.mean(v['score'] for v in chosen));bm.append(statistics.mean(v['margin'] for v in chosen))
    telemetry=[]
    for model in ('B','P'):
        for phase in ('all','opening','middle','endgame'):
            ms=[m for g in games for m in g['moves'] if m['move'] is not None and m['model']==model and (phase=='all' or phase==('opening' if m['occupied']<28 else 'middle' if m['occupied']<52 else 'endgame'))]
            ds=[m['depth'] for m in ms];elapsed=sum(m['elapsedMs'] for m in ms)
            telemetry.append(dict(model=model,phase=phase,moves=len(ms),depthHistogram=dict(sorted(collections.Counter(ds).items())),meanDepth=statistics.mean(ds),medianDepth=statistics.median(ds),nodes=sum(m['nodes'] for m in ms),evaluations=sum(m['evaluations'] for m in ms),searchMs=elapsed,interfaceMs=sum(m['measuredMs'] for m in ms),meanMoveMs=statistics.mean(m['measuredMs'] for m in ms),maxOverrunMs=max(m['overrunMs'] for m in ms),overrun1=sum(m['overrunMs']>1 for m in ms),overrun5=sum(m['overrunMs']>5 for m in ms),exact=sum(m['exact'] for m in ms),interruptedIterations=sum(m['timedOut'] for m in ms),depthZeroFallbacks=sum(m['depth']==0 for m in ms)))
    return dict(registration=r['checksum'],descriptiveOnly=not p['prospectivePolicyPassed'],independentConfirmation=p['prospectivePolicyPassed'] and hoeffding>.5 and student>.5,nFamilies=256,games=512,wins=sum(g['outcome']==1 for g in games),draws=sum(g['outcome']==0 for g in games),losses=sum(g['outcome']==-1 for g in games),mean=mean,variance=variance,standardError=se,meanMargin=statistics.mean(g['margin'] for g in games),studentOneSided95Lower=student,studentTwoSided95=[mean-critical(255,.975)*se,mean+critical(255,.975)*se],studentP=tail((mean-.5)/se,255) if se else None,hoeffdingOneSided95Lower=hoeffding,hoeffdingThreshold=.5+math.sqrt(math.log(20)/512),studentGate=student>.5,hoeffdingGate=hoeffding>.5,bootstrap=dict(reps=10000,seed=r['protocol']['bootstrapSeed'],stratifiedWholeFamilyScore95=[quantile(bs,.025),quantile(bs,.975)],stratifiedWholeFamilyMargin95=[quantile(bm,.025),quantile(bm,.975)]),strata=[dict(cell=c,n=16,score=statistics.mean(v['score'] for v in g),margin=statistics.mean(v['margin'] for v in g)) for c,g in enumerate(groups)],pairRows=rows,telemetry=telemetry,historicalComparison=dict(old80Score=.6064453125,older300Score=.6171875,newMinusOldPercentagePoints=100*(mean-.6064453125),pooled=False,oldProvenanceFailuresUnchanged=True),analysisAfterIntegrityAndProvenance=True)

def public_audit(out):
    manifest=checked(out/'manifest.json')
    for name,h in manifest['files'].items():assert sha(out/name)==h,name
    r=registration(out,public=True);a=checked(out/'analysis.json');provenance=checked(out/'provenance-verification.json')
    with gzip.open(out/'games.json.gz','rt') as f:public=json.load(f)
    assert public['registration']==r['checksum'] and len(public['games'])==512
    games=[]
    for i,g in enumerate(public['games']):
        c=r['schedule'][i];assert all(g[k]==v for k,v in c.items())
        moves=[dict(player=p,move=m) for p,m in g['moves']]
        for row in g['telemetry']:
            m=dict(zip(public['telemetryColumns'],row));ply=m.pop('ply');model='P' if moves[ply]['player']==g['color'] else 'B'
            moves[ply].update(m,model=model,modelIdentity=r['receipt']['models'][model],buildIdentity=r['receipt']['fingerprint'],budgetMs=300,backend='native')
        reconstructed=dict(g,moves=moves);replay(r['literalOpenings'][c['family']],reconstructed,r['receipt']);games.append(reconstructed)
    rows=[]
    for f,root in enumerate(r['literalOpenings']):
        gs=[g for g in games if g['family']==f];assert len(gs)==2 and {g['color'] for g in gs}=={-1,1}
        rows.append(dict(family=f,cell=root['cell'],score=statistics.mean(g['points'] for g in gs),margin=statistics.mean(g['margin'] for g in gs)))
    assert rows==a['pairRows'];mean=statistics.mean(x['score'] for x in rows);se=statistics.stdev(x['score'] for x in rows)/16
    assert abs(a['mean']-mean)<1e-12 and abs(a['studentOneSided95Lower']-(mean-critical(255,.95)*se))<1e-10
    assert abs(a['hoeffdingOneSided95Lower']-(mean-math.sqrt(math.log(20)/512)))<1e-12
    assert a['independentConfirmation']==(provenance['prospectivePolicyPassed'] and a['studentGate'] and a['hoeffdingGate'])
    with gzip.open(out/'admission-attempts.jsonl.gz','rb') as f:
        attempts=[line for line in f]
    assert len(attempts)==r['attempts']
    admitted=[]
    for (i,h),raw in zip(r['attemptReceiptInventory'],attempts):
        assert hashlib.sha256(raw).hexdigest()==h;v=json.loads(raw);tr=v['trajectory'];trajectory(tr)
        if v['decision']=='accepted':admitted.append(v)
    assert len(admitted)==256
    for root,v in zip(r['literalOpenings'],admitted):assert root['attempt']==v['attempt'] and root['attemptReceipt']==v['checksum']
    return dict(passed=True,registration=r['checksum'],games=512,families=256,independentMailbox=True,publicManifestHashes=True,allAdmissionTrajectoriesReplayed=True,statisticsRecomputed=True,historicalMembershipRechecked=False,historicalScope='Local audit certificate and retained inventory identities; full historical index not bundled in compact publication.')

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('mode',choices=['fixture','reservation','integrity','analyze','public']);parser.add_argument('out',nargs='?',type=pathlib.Path,default=ROOT/'.local-research/phase-a-300ms-m4-v1');a=parser.parse_args();start=time.monotonic()
    if a.mode=='public':
        print(json.dumps(public_audit(a.out)));return
    if a.mode=='fixture':v=fixture(a.out);target='development-verification.json'
    else:
        r=registration(a.out)
        if a.mode=='reservation':v=reservation(a.out,r);target='reservation-verification.json'
        elif a.mode=='integrity':
            source=reservation(a.out,r);assert source['passed'];v,states=game_integrity(a.out,r);prov=provenance(a.out,r,states);prov.update(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),wallSeconds=time.monotonic()-start);seal(a.out/'provenance-verification.json',prov);target='integrity-verification.json'
        else:v=analyze(a.out,r);target='analysis.json'
    v.update(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),wallSeconds=time.monotonic()-start);seal(a.out/target,v)
    print(json.dumps({k:v[k] for k in ('passed','fixture','registration','games','families','wallSeconds','mean','studentGate','hoeffdingGate','independentConfirmation') if k in v}),flush=True)
if __name__=='__main__':main()
