#!/usr/bin/env python3
"""Retain every measured timing; repair only the spent-time field lookup.

The first collection read elapsedSpanThroughFinalChecksSeconds instead of the
published elapsedWallSpanThroughFinalChecksSeconds. JS serialized that derived
NaN as null. No root/IO observation or future component is changed or rerun.
"""
import hashlib
import json
from pathlib import Path
import sys

source, prior, output = map(Path,sys.argv[1:])
value = json.loads(source.read_text())
old = json.loads(prior.read_text())
spent = value['preparationAlreadySpent']
assert spent['priorQualifiedPreflightMinutes'] is None
spent['priorQualifiedPreflightMinutes'] = old['elapsedWallSpanThroughFinalChecksSeconds']/60
raw = sum(value['componentsMinutes'].values())
assert abs(raw-value['rawMinutes'])<1e-9
assert abs(1.35*raw+15-value['requiredMinutes'])<1e-9
value['wholeContinuationRequiredMinutes'] = 1.35*(raw+sum(spent.values()))+15
value['correction'] = dict(measuredInputSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                          priorManifestSha256=hashlib.sha256(prior.read_bytes()).hexdigest(),
                          sourceSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                          change='Spent-time manifest key only; all measured observations and remaining components retained.')
with output.open('x') as f:
    json.dump(value,f,indent=2)
    f.write('\n')
print(json.dumps({k:value[k] for k in ('requiredMinutes','wholeContinuationRequiredMinutes')}))
