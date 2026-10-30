#!/usr/bin/env python3
"""Independent Python rules, symmetry, receipt bytes, moments, Student quadrature and resampling."""
import bisect, collections, datetime, hashlib, json, math, mmap, pathlib, random, statistics, sys, time
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'.local-research/p-independent-confirmation-v1-20261029'
OLD=ROOT/'.local-research/frozen-player-screen-v1-20261029'
def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(1048576),b''):h.update(b)
    return h.hexdigest()
def read(p): return json.loads(p.read_text())
def sealed(p):
    raw=p.read_bytes().strip();v=json.loads(raw);prefix=raw[:raw.rindex(b',"checksum":')]+b'}'
    assert hashlib.sha256(prefix).hexdigest()==v['checksum'],str(p)
    return v
def children(b,p):
    # Padded 10x10 mailbox uses different indexing from the JavaScript engine.
    box=[9]*100
    for i,x in enumerate(b):box[11+(i//8)*10+i%8]=x
    result={}
    for i,x in enumerate(b):
        if x:continue
        q=11+(i//8)*10+i%8;flips=[]
        for d in [-11,-10,-9,-1,1,9,10,11]:
            line=[];j=q+d
            while box[j]==-p:line.append(j);j+=d
            if line and box[j]==p:flips.extend(line)
        if flips:
            c=b.copy();c[i]=p
            for j in flips:c[((j//10)-1)*8+(j%10)-1]=p
            result[i]=c
    return result
def replay(board,player,moves,complete=True):
    b=board.copy();p=player;passes=0
    for step in moves:
        who,move=(step['player'],step['move']) if isinstance(step,dict) else step
        assert who==p and passes<2
        cs=children(b,p)
        if move is None:assert not cs;passes+=1
        else:assert move in cs;b=cs[move];passes=0
        p=-p
    if complete:assert passes==2 and not children(b,1) and not children(b,-1)
    return b,p,passes
def key(b,p):
    forms=[]
    for reflect in [False,True]:
        for rotation in range(4):
            s=[]
            for r in range(8):
                for c in range(8):
                    rr,cc=r,7-c if reflect else c
                    for _ in range(rotation):rr,cc=cc,7-rr
                    s.append(str(b[rr*8+cc]*p+1))
            forms.append(''.join(s))
    return hashlib.sha256(min(forms).encode()).digest()
def cdf(t,df):
    # Composite Simpson integration of the normalized t density, independently
    # of the JS trigonometric recurrence. These large sample sizes are fixed.
    if t<0:return 1-cdf(-t,df)
    if not math.isfinite(t):return 1.
    logc=math.lgamma((df+1)/2)-math.lgamma(df/2)-.5*math.log(df*math.pi)
    n=8192;h=t/n
    def f(x):return math.exp(logc-(df+1)/2*math.log1p(x*x/df))
    total=f(0)+f(t)
    total+=sum((4 if j%2 else 2)*f(j*h) for j in range(1,n))
    return min(1.,.5+total*h/3)
def critical(df):
    lo,hi=0.,8.
    for _ in range(45):
        mid=(lo+hi)/2
        if cdf(mid,df)<.975:lo=mid
        else:hi=mid
    return (lo+hi)/2
def quantile(x,p):
    a=sorted(x);q=(len(a)-1)*p;l=math.floor(q);u=math.ceil(q)
    return a[l]+(a[u]-a[l])*(q-l)
def independent_statistics(summary):
    rows=summary['pairRows'];checks={};rng=random.Random(2026102904)
    for b,n in [(80,768),(300,256)]:
        x=[r['score'] for r in rows if r['timeMs']==b];assert len(x)==n
        m=statistics.mean(x);v=statistics.variance(x);se=math.sqrt(v/n);d=summary['statistics']['scores'][str(b)]
        assert abs(m-d['mean'])<1e-14 and abs(v-d['variance'])<1e-12
        p=1-cdf((m-.5)/se,n-1) if se else None
        assert p is None or abs(p-d['approximateOneSidedP'])<1e-9
        lower=max(0,m-critical(n-1)*se);assert abs(lower-d['approximateOneSided975Lower'])<1e-10
        bounded=max(0,m-math.sqrt(math.log(40)/(2*n)));assert abs(bounded-d['conservativeOneSided975Lower'])<1e-14
        samples=[sum(x[rng.randrange(n)] for _ in range(n))/n for _ in range(10000)];ci=[quantile(samples,.025),quantile(samples,.975)];js=summary['statistics']['sensitivity'][str(b)]['interval95']
        assert max(abs(ci[j]-js[j]) for j in [0,1])<.01
        checks[b]=dict(n=n,mean=m,variance=v,p=p,tLower=lower,hoeffdingLower=bounded,independentBootstrap95=ci,jsBootstrap95=js)
    matched=[]
    short={r['family']:r['score'] for r in rows if r['timeMs']==80}
    for r in rows:
        if r['timeMs']==300:matched.append(r['score']-short[r['family']])
    d=summary['statistics']['difference'];assert abs(statistics.mean(matched)-d['mean'])<1e-14;assert abs(statistics.variance(matched)-d['variance'])<1e-12
    bs=[sum(matched[rng.randrange(256)] for _ in range(256))/256 for _ in range(10000)];ci=[quantile(bs,.025),quantile(bs,.975)]
    assert max(abs(ci[j]-d['bootstrap']['difference']['interval95'][j]) for j in [0,1])<.01
    return dict(budgets=checks,matchedDifferenceMean=statistics.mean(matched),matchedVariance=statistics.variance(matched),matchedIndependentBootstrap95=ci,resamplingSeed=2026102904,reps=10000)
def verify_games(summary,reservation):
    pairs=collections.defaultdict(list)
    for g in summary['games']:
        root=reservation['roots'][g['family']];b,_,_=replay(root['board'],root['player'],g['moves'])
        margin=sum(b);points=(1+(0 if margin==0 else (1 if margin>0 else -1))*g['color'])/2
        assert b==g['board'] and margin==g['margin'] and points==g['points'];pairs[g['family'],g['timeMs']].append(g)
    assert len(summary['games'])==2048
    for r in summary['pairRows']:
        gs=pairs[r['family'],r['timeMs']];assert len(gs)==2 and {g['color'] for g in gs}=={-1,1}
        assert statistics.mean(g['points'] for g in gs)==r['score']
        assert statistics.mean(g['margin']*g['color'] for g in gs)==r['meanDiscMargin']
    for budget in [80,300]:
        gs=[g for g in summary['games'] if g['timeMs']==budget];o=summary['outcomes'][str(budget)]
        assert [sum(g['points']==v for g in gs) for v in [1,.5,0]]==[o['wins'],o['draws'],o['losses']]
    return len(pairs)
start=time.monotonic()
if '--evidence' in sys.argv:
    evidence=read(ROOT/sys.argv[sys.argv.index('--evidence')+1]);summary=evidence['summary'];reg=read(ROOT/'docs/data/p-confirmation-registration-20261029.json');verify_games(summary,reg['reservation']);checks=independent_statistics(summary)
    print(json.dumps(dict(passed=True,games=2048,families=768,publicEvidence=True,statistics=checks)));sys.exit()
reservation_only='--reservation-only' in sys.argv
launch=sealed(OUT/'launch.json');reservation=sealed(OUT/'reservation.json');h=sealed(OUT/'history.json');reg=read(ROOT/'docs/data/p-confirmation-registration-20261029.json')
summary=None if reservation_only else sealed(OUT/'summary.json')
provenance=None if reservation_only else sealed(OUT/'provenance-audit.json')
assert reg['launchChecksum']==launch['checksum'] and reservation['checksum']==launch['reservation']
for path,digest in launch['inventory']:
    assert sha(ROOT/path)==digest and sha(OUT/'snapshot'/path)==digest,path
files=[(OLD/'history-v2/membership.bin',h['baseDigest']),(OLD/'preflight-final/engineering-keys.bin',h['engineeringDigest']),(OUT/'added-keys.bin',h['addedDigest'])]
maps=[];streams=[]
for path,digest in files:
    assert sha(path)==digest;f=path.open('rb');streams.append(f);mm=mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ);assert len(mm)%32==0;maps.append(mm)
def contains(mm,k):
    lo,hi=0,len(mm)//32
    while lo<hi:
        mid=(lo+hi)//2;v=mm[mid*32:mid*32+32]
        if v==k:return True
        if v<k:lo=mid+1
        else:hi=mid
    return False
owners={};cells=collections.Counter();dual=collections.Counter();initial=[0]*64
for i,v in [(27,-1),(28,1),(35,1),(36,-1)]:initial[i]=v
for root in reservation['roots']:
    tr=read(OUT/f"trajectories/{root['id']}.json");end,_,_=replay(initial,1,tr['moves']);assert end==tr['terminal'];b=initial.copy();p=1;history=[];found=False
    for m in tr['moves']:
        if sum(x!=0 for x in b)>=12:history.append(dict(board=b.copy(),player=p))
        if b==tr['root']['board'] and p==tr['root']['player']:found=True
        b,p,_=replay(b,p,[m],complete=False)
    assert found and history==tr['history'];assert root['board']==([-x for x in tr['root']['board']] if root['reverse'] else tr['root']['board']);assert root['player']==tr['root']['player']*(-1 if root['reverse'] else 1)
    boards=[s['board'] for s in history]+[tr['root']['board']]+list(children(tr['root']['board'],tr['root']['player']).values());local=set()
    for b in boards:
        if not children(b,1) and not children(b,-1):continue
        for p in [1,-1]:local.add(key(b,p))
    for k in local:
        assert not any(contains(mm,k) for mm in maps),'Historical admission collision';assert k not in owners,'Shared source ancestry';owners[k]=root['family']
    cells[root['cell']]+=1
    if root['dual']:dual[root['cell']]+=1
assert set(cells.values())=={48} and len(cells)==16 and set(dual.values())=={16} and len(dual)==16
if reservation_only:
    result=dict(format='p-confirmation-independent-reservation-audit-v1',passed=True,families=768,dualFamilies=256,sourceKeys=len(owners),launch=launch['checksum'],source=launch['source'],wallSeconds=time.monotonic()-start)
    path=OUT/'independent-reservation-verification.json'
    if not path.exists():path.write_text(json.dumps(result,separators=(',',':'))+'\n')
    else:assert read(path)['launch']==launch['checksum']
    print(json.dumps(result));sys.exit()
for i,condition in enumerate(reservation['schedule']):
    path=OUT/f'games/game-{i}.json';r=sealed(path);assert r['condition']==condition and r['launch']==launch['checksum'];assert sha(path)==provenance['receiptInventory'][i][1];assert r['committed']>launch['at']
    ms=[m for m in r['result']['moves'] if m['move'] is not None];public=summary['games'][i]['telemetry']
    assert sum(m['nodes'] for m in ms)==public['nodes'] and sum(m['evaluations'] for m in ms)==public['evaluations']
    assert dict(collections.Counter(str(m['depth']) for m in ms))==public['depthHistogram']
    assert abs(sum(m['measuredMs'] for m in ms)-public['totalMs'])<1e-6
assert verify_games(summary,reservation)==1024;checks=independent_statistics(summary)
for mm in maps:mm.close()
for f in streams:f.close()
certificate=dict(format='p-confirmation-independent-python-audit-v1',passed=True,at=datetime.datetime.now(datetime.timezone.utc).isoformat(),games=2048,families=768,completeColorPairs=1024,launch=launch['checksum'],source=launch['source'],summarySha=sha(OUT/'summary.json'),provenanceSha=sha(OUT/'provenance-audit.json'),independentClaim=provenance['independentClaim'],statistics=checks,wallSeconds=time.monotonic()-start,note='Separate 10x10 mailbox rules, symmetry identities, binary index admission, every game/receipt, numerical t quadrature, bounded-score inference and independently seeded complete-family bootstrap. No moves treated as strength samples.')
path=OUT/'independent-verification.json'
if path.exists():
    old=read(path)
    for k in ['at','wallSeconds']:certificate[k]=old[k]
    assert old==certificate
else:path.write_text(json.dumps(certificate,separators=(',',':'))+'\n')
print(json.dumps(certificate))
