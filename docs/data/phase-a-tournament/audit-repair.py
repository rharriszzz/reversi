#!/usr/bin/env python3
"""Repair one verifier assumption, retaining the preregistered verifier verbatim.

Native exact = full-empty horizon OR no static horizon observations. A shorter
placement depth can be exact when play terminates with empties remaining. Rather
than merely relaxing that assertion, exhaustively solve every such case using
independent Python mailbox rules and check both score and selected move. No
aggregate strength analysis is performed by this correction.
"""
import functools,hashlib,json,pathlib,sys,types
ROOT=pathlib.Path(__file__).resolve().parents[3]
path=ROOT/'scripts/phase-a-mac/verify-tournament.py'
out=pathlib.Path(sys.argv[2]) if len(sys.argv)>2 else ROOT/'.local-research/phase-a-m4-tournament-v1'
reg=json.loads((out/'registration.json').read_text());source=path.read_text()
assert hashlib.sha256(path.read_bytes()).hexdigest()==reg['sources']['scripts/phase-a-mac/verify-tournament.py']
old="if m['exact']:assert m['depth']==64-m['occupied']"
new="if m['exact']:verify_early_terminal_exact(m,b,p)"
assert source.count(old)==1
v=types.ModuleType('repaired_phase_a_verifier');v.__file__=str(path)
exec(compile(source.replace(old,new),str(path),'exec'),v.__dict__)
@functools.lru_cache(maxsize=100000)
def exact(board,player):
    cs=v.children(board,player)
    if not cs:
        if not v.children(board,-player):
            margin=sum(board)*player
            return 0 if margin==0 else (10000 if margin>0 else -10000)+margin
        return -exact(board,-player)
    return max(-exact(tuple(child),-player) for child in cs.values())
records=[]
def verify_early_terminal_exact(m,b,p):
    assert m['depth']<=64-m['occupied']
    if m['depth']<64-m['occupied']:
        value=exact(tuple(b),p);chosen=-exact(tuple(v.children(b,p)[m['move']]),-p)
        assert value==chosen==m['score'],(m['depth'],m['occupied'],value,chosen,m['score'])
        records.append(dict(board=b.copy(),player=p,move=m['move'],occupied=m['occupied'],depth=m['depth'],exactScore=value,selectedMoveExactOptimal=True))
v.verify_early_terminal_exact=verify_early_terminal_exact
# Disclosed synthetic early-terminal positive and negative fixtures.
board=[1]*64;board[0]=board[7]=0;board[1]=-1
verify_early_terminal_exact(dict(depth=1,occupied=62,move=0,score=10063),board,1)
try:verify_early_terminal_exact(dict(depth=1,occupied=62,move=0,score=10062),board,1)
except AssertionError:pass
else:raise AssertionError('Corrupt exact score was not rejected')
records.clear()
if __name__=='__main__':
    v.main()
    if sys.argv[1]=='integrity':
        result=dict(format='phase-a-independent-early-terminal-exact-verification-v1',registration=reg['checksum'],passed=True,originalVerifierSha256=hashlib.sha256(path.read_bytes()).hexdigest(),repairSha256=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),singleAssertionCorrection=dict(original=old,replacement=new),allOtherFrozenChecksUnchanged=True,independentExhaustiveMailbox=True,syntheticPositiveAndCorruptScoreTests=True,shorterExactCases=len(records),records=records)
        v.seal(out/'early-terminal-exact-verification.json',result)
        print(json.dumps(dict(earlyTerminalExactVerification=True,cases=len(records))))
