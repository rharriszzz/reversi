#!/usr/bin/env python3
"""Separate Python rules, source admission, receipts, paired inference and exact RNG audit."""
import collections, datetime, hashlib, json, math, mmap, pathlib, statistics, sys, time
from functools import lru_cache
ROOT=pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from scripts.native.verify import children, critical, tail
OUT=pathlib.Path(sys.argv[2]) if len(sys.argv)>2 else ROOT/'.local-research/native-v2-20261030'
MODE=sys.argv[1] if len(sys.argv)>1 else 'reservation'
def read(p):return json.loads(pathlib.Path(p).read_text())
def sha(p):
    h=hashlib.sha256()
    with pathlib.Path(p).open('rb') as f:
        for b in iter(lambda:f.read(1048576),b''):h.update(b)
    return h.hexdigest()
def checked(p):
    raw=pathlib.Path(p).read_bytes().strip();r=json.loads(raw)
    assert hashlib.sha256(raw[:raw.rindex(b',"checksum":')]+b'}').hexdigest()==r['checksum'],str(p)
    return r
@lru_cache(maxsize=100000)
def keys(b):
    out=[]
    for p in (1,-1):
        forms=[]
        for reflect in (False,True):
            for rotation in range(4):
                s=[]
                for r in range(8):
                    for c in range(8):
                        rr,cc=r,7-c if reflect else c
                        for _ in range(rotation):rr,cc=cc,7-rr
                        s.append(str(b[rr*8+cc]*p+1))
                forms.append(''.join(s))
        out.append(hashlib.sha256(min(forms).encode()).digest())
    return out

def replay(b,p,moves,complete=True):
    b=list(b);passes=0
    for m in moves:
        assert passes<2 and m['player']==p
        cs=children(b,p)
        if m['move'] is None:assert not cs;passes+=1
        else:assert m['move'] in cs;b=cs[m['move']];passes=0
        p=-p
    if complete:assert passes==2 and not children(b,1) and not children(b,-1)
    return b,p,passes

def registration():
    reg=checked(OUT/'registration.json')
    for p,d in reg['sources'].items():assert sha(ROOT/p)==d and sha(OUT/'snapshot'/p)==d,p
    assert sha(reg['receipt']['executable'])==reg['receipt']['executableSha256']
    assert len(reg['openings'])==768 and len(reg['schedule'])==2048
    assert reg['receipt']['models']==reg['protocol']['models']|{'L':'ecf3fd376c680ced77d0b002ea2efb9fa4385737c4fffff734b901ab2968d97f'}
    pairs=collections.defaultdict(list)
    for c in reg['schedule']:pairs[c['family'],c['timeMs']].append(c['color'])
    for f in range(768):
        assert sorted(pairs[f,80])==[-1,1]
        assert sorted(pairs[f,300])==([-1,1] if f//16%3==0 else [])
    return reg

def reservation_audit(reg):
    h=checked(OUT/'history.json');old=ROOT/'.local-research/p-independent-confirmation-v1-20261029'
    paths=[(ROOT/'.local-research/frozen-player-screen-v1-20261029/history-v2/membership.bin',h['baseDigest']),
           (ROOT/'.local-research/frozen-player-screen-v1-20261029/preflight-final/engineering-keys.bin',h['engineeringDigest']),
           (old/'added-keys.bin',h['addedDigest']),(OUT/'history-extra.bin',h['extraDigest'])]
    files=[];maps=[]
    for path,digest in paths:
        assert sha(path)==digest
        f=path.open('rb');files.append(f);maps.append(mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ))
    def member(mm,k):
        lo,hi=0,len(mm)//32
        while lo<hi:
            m=(lo+hi)//2;v=mm[m*32:m*32+32]
            if v==k:return True
            if v<k:lo=m+1
            else:hi=m
        return False
    owners={};seen_seeds=set(h['seeds']);states=0
    for f,r in enumerate(reg['openings']):
        assert r['family']==f and r['cell']==f%16 and r['cycle']==f//16
        assert r['occupied']==12+((f%16>>1)&1) and r['policy']==('B4-2%' if f&1 else 'B1-12%')
        assert r['seed'] not in seen_seeds;seen_seeds.add(r['seed'])
        path=OUT/'trajectories'/f"{r['id']}.json";tr=read(path)
        assert hashlib.sha256(path.read_bytes().strip()).hexdigest()==r['trajectoryHash']
        b=[0]*64;b[27]=b[36]=-1;b[28]=b[35]=1;p=1;history=[];found=False;passes=0
        for m in tr['moves']:
            if sum(x!=0 for x in b)>=12:history.append(dict(board=b.copy(),player=p))
            if tr['root']==dict(board=b,player=p):found=True
            cs=children(b,p);assert m['player']==p and passes<2
            if m['move'] is None:assert not cs;passes+=1
            else:assert m['move'] in cs;b=cs[m['move']];passes=0
            p=-p
        assert found and passes==2 and b==tr['terminal'] and history==tr['history']
        assert r['board']==([-v for v in tr['root']['board']] if r['reverse'] else tr['root']['board'])
        assert r['player']==(-tr['root']['player'] if r['reverse'] else tr['root']['player'])
        boards=[s['board'] for s in history]+[tr['root']['board']]+list(children(tr['root']['board'],tr['root']['player']).values())
        ks=set()
        for b in boards:
            if children(b,1) or children(b,-1):ks.update(keys(tuple(b)))
        for k in ks:
            assert k not in owners and not any(member(mm,k) for mm in maps),(f,k.hex())
            owners[k]=f
        states+=len(boards)
    for mm in maps:mm.close()
    for f in files:f.close()
    return dict(passed=True,registration=reg['checksum'],families=768,games=2048,sourceStateOccurrences=states,distinctBothTurnKeys=len(owners),independentRules=True,independentSymmetry=True,allHistoricalIndexDigestsVerified=True)

def rng(seed):
    a=seed&0xffffffff
    while True:
        a=(a+0x6d2b79f5)&0xffffffff;t=((a^(a>>15))*(a|1))&0xffffffff
        t=(t^((t+(((t^(t>>7))*(t|61))&0xffffffff))&0xffffffff))&0xffffffff
        yield ((t^(t>>14))&0xffffffff)/4294967296

def quantile(x,p):
    a=sorted(x);q=(len(a)-1)*p;lo=int(q);return a[lo]+(a[math.ceil(q)]-a[lo])*(q-lo)
def near(a,b):assert math.isclose(a,b,rel_tol=1e-9,abs_tol=1e-9),(a,b)
def bootstrap(rows,cols,seed):
    random=rng(seed);n=len(rows);out={c:[] for c in cols}
    for _ in range(10000):
        sums=[0.]*len(cols)
        for _ in range(n):
            r=rows[int(next(random)*n)]
            for i,c in enumerate(cols):sums[i]+=r[c]
        for i,c in enumerate(cols):out[c].append(sums[i]/n)
    return {c:[quantile(x,.025),quantile(x,.975)] for c,x in out.items()}

def result_audit(reg,games,summary):
    assert len(games)==2048;seen=set();pairrows={};flat=[]
    for i,g in enumerate(games):
        c=reg['schedule'][i];assert (g['family'],g['timeMs'],g['color'])==(c['family'],c['timeMs'],c['color'])
        key=(g['family'],g['timeMs'],g['color']);assert key not in seen;seen.add(key)
        root=reg['openings'][g['family']];b,_,_=replay(root['board'],root['player'],g['moves'])
        assert b==g['board'];margin=sum(b)*g['color'];outcome=(margin>0)-(margin<0)
        assert margin==g['margin'] and outcome==g['outcome'] and (1+outcome)/2==g['points']
        for m in g['moves']:
            if m['move'] is None:continue
            assert m['model']==('P' if m['player']==g['color'] else 'B')
            assert m['modelIdentity']==reg['receipt']['models'][m['model']]
            assert m['buildIdentity']==reg['receipt']['fingerprint']
            assert 1<=m['depth']<=64-m['occupied'] and m['evaluations']<=m['nodes']
            assert m['ttCutoffs']<=m['ttBoundHits']<=m['ttHits']<=m['ttProbes']<=m['nodes']
            flat.append(dict(m,timeMs=g['timeMs'],phase='opening' if m['occupied']<28 else 'middle' if m['occupied']<52 else 'endgame'))
    for ms,n in [(80,768),(300,256)]:
        rows=[];s=summary['statistics']['conditions'][str(ms)]
        for f in sorted(set(g['family'] for g in games if g['timeMs']==ms)):
            gs=[g for g in games if g['timeMs']==ms and g['family']==f];assert len(gs)==2 and {g['color'] for g in gs}=={-1,1}
            rows.append(dict(family=f,score=statistics.mean(g['points'] for g in gs),margin=statistics.mean(g['margin'] for g in gs)))
        assert len(rows)==n;pairrows[ms]=rows
        xs=[r['score'] for r in rows];m=statistics.mean(xs);variance=statistics.variance(xs);se=math.sqrt(variance/n)
        near(s['mean'],m);near(s['variance'],variance);near(s['standardError'],se)
        near(s['approximateOneSided975Lower'],max(0,m-critical(n-1)*se));near(s['conservativeOneSided975Lower'],max(0,m-math.sqrt(math.log(40)/(2*n))))
        if se:assert math.isclose(s['approximateOneSidedP'],tail((m-.5)/se,n-1),rel_tol=1e-7,abs_tol=1e-300)
        for outcome,name in [(1,'wins'),(0,'draws'),(-1,'losses')]:assert s[name]==sum(g['outcome']==outcome for g in games if g['timeMs']==ms)
        bs=bootstrap(rows,['score','margin'],2026103017+ms)
        for c in bs:
            for a,b in zip(bs[c],s['bootstrap'][c]['interval95']):near(a,b)
        for j in [1,2]:
            bs=bootstrap(rows,['score'],2026103017+ms+j)
            for a,b in zip(bs['score'],s['bootstrapSensitivity'][j-1]['score']['interval95']):near(a,b)
    shorts={r['family']:r['score'] for r in pairrows[80]};matched=[dict(family=r['family'],short=shorts[r['family']],long=r['score'],difference=r['score']-shorts[r['family']]) for r in pairrows[300]]
    d=summary['statistics']['difference'];xs=[r['difference'] for r in matched];near(d['mean'],statistics.mean(xs));near(d['variance'],statistics.variance(xs))
    radius=critical(255)*statistics.stdev(xs)/16
    for a,b in zip(d['interval95'],[statistics.mean(xs)-radius,statistics.mean(xs)+radius]):near(a,b)
    bs=bootstrap(matched,['short','long','difference'],2026103017)
    for c in bs:
        for a,b in zip(bs[c],d['bootstrap'][c]['interval95']):near(a,b)
    for expected in summary['telemetry']:
        rows=[m for m in flat if m['timeMs']==expected['timeMs'] and m['model']==expected['model'] and (expected['phase']=='all' or m['phase']==expected['phase'])];assert len(rows)==expected['moves']
        for k in ['nodes','evaluations','ttProbes','ttHits','ttBoundHits','ttCutoffs','ttCollisions','ttReplacements','ttStores','ttRejectedStores','cutoffs','firstMoveCutoffs']:near(sum(r[k] for r in rows),expected[k])
        near(statistics.mean(r['depth'] for r in rows),expected['meanDepth']);near(statistics.median(r['depth'] for r in rows),expected['medianDepth'])
        near(sum(r['nodes'] for r in rows)*1000/sum(r['elapsedMs'] for r in rows),expected['nodesPerSecond'])
        near(statistics.mean(r['measuredMs'] for r in rows),expected['meanMoveMs']);near(max(r['overrunMs'] for r in rows),expected['maxOverrunMs'])
        for k,predicate in [('exact',lambda r:r['exact']),('above14',lambda r:r['depth']>14),('interrupted',lambda r:r['timedOut']),('overrun1',lambda r:r['overrunMs']>1),('overrun5',lambda r:r['overrunMs']>5)]:assert sum(bool(predicate(r)) for r in rows)==expected[k]
    return dict(passed=True,registration=reg['checksum'],games=2048,pairs80=768,pairs300=256,independentRules=True,exactBootstrap=True,bootstrapSensitivity=True,positiveStudentTail=True,matchedCovariance=True,moveTelemetryVerified=len(flat))

if __name__=='__main__':
    start=time.monotonic()
    if MODE=='reservation':
        reg=registration();certificate=reservation_audit(reg);target=OUT/'reservation-verification.json'
    elif MODE=='final':
        reg=registration();summary=read(OUT/'summary.json');games=[]
        for i,c in enumerate(reg['schedule']):
            r=checked(OUT/'games'/f'game-{i}.json');assert r['registration']==reg['checksum'] and r['condition']==c
            games.append(dict(r['result'],family=c['family']))
        certificate=result_audit(reg,games,summary);target=OUT/'independent-verification.json'
    elif MODE=='public':
        data=ROOT/'docs/data';reg=checked(data/'native-v2-registration-20261030.json');public=read(data/'native-v2-games-20261030.json');summary=read(data/'native-v2-results-20261030.json');assert public['registration']==reg['checksum'];games=[]
        for g in public['games']:
            moves=[dict(player=p,move=m) for p,m in g['moves']]
            for row in g['telemetry']:
                m=dict(zip(public['telemetryColumns'],row));ply=m.pop('ply');model='P' if moves[ply]['player']==g['color'] else 'B'
                moves[ply].update(m,model=model,modelIdentity=reg['receipt']['models'][model],buildIdentity=reg['receipt']['fingerprint'])
            games.append(dict(g,moves=moves))
        certificate=result_audit(reg,games,summary);target=OUT/'public-verification.json'
    else:raise SystemExit('Use reservation, final or public')
    certificate.update(wallSeconds=time.monotonic()-start,at=datetime.datetime.now(datetime.timezone.utc).isoformat())
    if target.exists():
        old=read(target)
        for k in ['wallSeconds','at']:certificate[k]=old[k]
        assert old==certificate
    else:target.write_text(json.dumps(certificate,separators=(',',':'))+'\n')
    print(json.dumps(certificate))
