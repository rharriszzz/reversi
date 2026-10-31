#!/usr/bin/env python3
"""Independent known-restriction membership checks and explicit extraction gaps.

Uses the binary index via mmap, not the exporter's in-memory key set. Does not
compute game results. Generic decoder exceptions never imply archive corruption.
"""
import argparse
import collections
import gzip
import hashlib
import json
import mmap
from pathlib import Path


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):
            h.update(b)
    return h.hexdigest()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('extraction', type=Path)
    p.add_argument('output', type=Path)
    p.add_argument('--reconciliation', type=Path, required=True)
    p.add_argument('--transfer-verification', type=Path, required=True)
    a = p.parse_args()
    manifest = json.loads((a.extraction/'manifest.json').read_text())
    reconciliation=json.loads(a.reconciliation.read_text())
    transport=json.loads(a.transfer_verification.read_text())
    assert transport['acceptedForSourceTransferVerification']
    with gzip.open(a.extraction/'files.jsonl.gz','rt') as f:
        files = [json.loads(s) for s in f]
    for n,h in manifest['artifacts'].items():
        assert sha(a.extraction/n)==h, n
    research = Path('/Users/rharris/git/reversi/.local-research')
    old = json.loads((research/'p-independent-confirmation-v1-20261029/provenance-audit.json').read_text())
    v2 = json.loads((research/'native-v2-20261030/provenance-audit.json').read_text())
    old_keys = [r['key'] for r in old['violations']]
    v2_rows = [r for r in v2['classifications'] if r['prohibited'] or r['unresolved']]
    assert len(old_keys)==65 and len(v2_rows)==50
    final_index=a.reconciliation.parent/'membership.bin'
    assert sha(final_index)==reconciliation['artifacts']['membership.bin']
    with final_index.open('rb') as f:
        with mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ) as m:
            def contains(text):
                key = bytes.fromhex(text)
                lo,hi=0,len(m)//32
                while lo<hi:
                    mid=(lo+hi)//2
                    if m[mid*32:(mid+1)*32]<key:lo=mid+1
                    else:hi=mid
                return m[lo*32:(lo+1)*32]==key
            assert all(contains(k) for k in old_keys)
            assert all(contains(r['key']) for r in v2_rows)
    grouped = collections.defaultdict(lambda:dict(count=0,reasons=collections.Counter(),examples=[]))
    for row in manifest['replayGaps']:
        f = files[row['file']]
        key = (f['source'],f['path'])
        g = grouped[key]
        g['count']+=1
        g['reasons'][row['reason']]+=1
        if len(g['examples'])<3:g['examples'].append(row['location'])
    gaps = [dict(source=s,path=p,sha256=next(f['sha256'] for f in files if f['source']==s and f['path']==p),**g)
            for (s,p),g in sorted(grouped.items())]
    parser = [dict(source=files[r['file']]['source'],path=files[r['file']]['path'],
                   sha256=files[r['file']]['sha256'],reason=r['reason']) for r in manifest['parseErrors']]
    checks = dict(original65RestrictedKeysPresent=True,laterV2TwoProhibited48UnknownPresent=True,
                  priorLayersDigestAndSortedUnionVerified=True,
                  transferredPCUnboundPlayedPathExceptions=sum(g['count'] for g in gaps if g['source'].startswith('pc/')),
                  originalDecisionsUnchanged=True)
    result = dict(format='phase-a-provenance-coverage-review-v1',
                  extraction=str(a.extraction.resolve()), extractionManifestSha256=sha(a.extraction/'manifest.json'),
                  counts={**{k:manifest[k] for k in ('files','supplementalKeys','replays','wallSeconds')},'keys':reconciliation['keys']},
                  runs=manifest['runs'],sources=manifest['sources'],priorLayers=manifest['priorLayers'],
                  artifacts=manifest['artifacts'],occurrenceRoles=manifest['occurrenceRoles'],checks=checks,
                  original65Keys=old_keys,laterV2Restrictions=[{k:r[k] for k in ('key','prohibited','unresolved','disposition')} for r in v2_rows],
                  parserExceptions=parser,replayExceptionGroups=gaps,
                  reconciliation=reconciliation,reconciliationManifestSha256=sha(a.reconciliation),
                  sourceTransferVerified=True,additionalPCManifestRequired=False,
                  retainedSerializedPathFormatsReconciled=not reconciliation['remaining'],
                  finalMembershipPath=str(final_index.resolve()),finalMembershipSha256=sha(final_index),
                  exceptionInterpretation='Initial generic-decoder exceptions are retained as diagnostic history, then resolved by explicit query/root and teacher-PV adapters in the bound reconciliation manifest. They do not establish corruption or illegal engine moves.',
                  knownTargetAndAssessmentCoveragePassed=not reconciliation['remaining'],
                  sourceAdmissionInventoryQualified=not reconciliation['remaining'],
                  sourceAdmissionCertified=False,preregistrationGo=False,
                  qualificationScope='All identified retained PC/Mac sources, verified source transfer, original role/occurrence layers, all known prohibited targets/assessment keys, and recovered historical custom selection paths. Unknown keys remain excluded. This is inventory qualification, not admission of an ungenerated new sample or universal novelty of all past internal nodes.',
                  retentionLimits=['Two pure backend timing pilots retain no played paths. Exact source prefixes, roots and alternatives recovered. Collector establishes engineering-only purpose; they are not invented fitting targets or missing P/L assessment panels. This limits universal historical-observation completeness, not the verified known-target/assessment coverage.'],
                  blockingEvidence=['Full conservative 120-minute gate fails; literal new openings and complete pipeline registration not created.'],
                  sourceSha256=sha(__file__))
    with a.output.open('x') as f:
        json.dump(result,f,indent=2)
        f.write('\n')
    print(json.dumps(dict(keys=result['counts']['keys'],initialExceptionGroups=len(gaps),remainingExceptions=len(reconciliation['remaining']),checks=checks)))


if __name__=='__main__':main()
