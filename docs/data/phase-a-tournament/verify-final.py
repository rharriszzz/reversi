#!/usr/bin/env python3
"""Read-only verification of the complete compact publication, no bulk archive."""
import importlib.util,json,pathlib,sys
PUBLIC=pathlib.Path(__file__).resolve().parent
ROOT=PUBLIC.parents[2]
sys.argv=['audit-repair.py','public',str(PUBLIC)]
spec=importlib.util.spec_from_file_location('phase_a_public_repair',PUBLIC/'audit-repair.py');repair=importlib.util.module_from_spec(spec);spec.loader.exec_module(repair)
v=repair.v
completion=v.checked(PUBLIC/'completion.json')
for path,digest in completion['publicFiles'].items():assert v.sha(PUBLIC/path)==digest,path
assert v.sha(ROOT/'docs/PHASE_A_MAC_TOURNAMENT_RESULTS.md')==completion['reportSha256']
result=v.public_audit(PUBLIC)
assert result['registration']==completion['registration'] and result['passed']
print(json.dumps(dict(passed=True,completePublicationHashes=True,publicReplay=result,earlyTerminalExactCasesIndependentlySolved=len(repair.records),historicalBulkMembershipRecheck='Use the retained local audit inputs; compact publication alone is not the full historical inventory.')))
