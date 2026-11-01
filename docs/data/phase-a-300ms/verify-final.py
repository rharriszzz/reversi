#!/usr/bin/env python3
"""Read-only independent replay of the complete compact 300-ms publication."""
import importlib.util,json,pathlib,sys
PUBLIC=pathlib.Path(__file__).resolve().parent
ROOT=PUBLIC.parents[2]
spec=importlib.util.spec_from_file_location('phase300',ROOT/'scripts/phase-a-300ms/verify-tournament.py');v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
completion=v.checked(PUBLIC/'completion.json')
for path,digest in completion['publicFiles'].items():assert v.sha(PUBLIC/path)==digest,path
assert v.sha(ROOT/'docs/PHASE_A_300MS_TOURNAMENT_RESULTS.md')==completion['reportSha256']
result=v.public_audit(PUBLIC)
assert result['registration']==completion['registration'] and result['passed']
print(json.dumps(dict(passed=True,completePublicationHashes=True,publicReplay=result,earlyTerminalExactCasesIndependentlySolved=len(v.EARLY_EXACT),historicalBulkMembershipRecheck='Retained local audit certificate; complete historical index is not bundled.')))
