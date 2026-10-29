import json,hashlib,collections,datetime
from pathlib import Path
base=Path('.local-research/frozen-player-screen-v1-20261029');run=base/'scientific'
read=lambda p:json.loads(Path(p).read_text())
d=read('docs/data/frozen-player-screen-20261029.json');role=read(run/'prospective-role-audit-v2.json');first=read(run/'prospective-role-audit.json');repair=read(run/'analysis-repair.json');verification=read(run/'verification.json');extra=read(run/'descriptive-diagnostics.json')
events=[json.loads(x) for x in (run/'events.jsonl').read_text().splitlines()]
phase={k:next(x for x in events if x['event']==k)['elapsedMs'] for k in ['all-identities-frozen','all-games-complete','all-fixed-and-label-tasks-complete','all-timed-roots-complete']}
label_start=min(x['elapsedMs'] for x in events if x['event']=='task-start' and x.get('type')=='label');label_end=max(x['elapsedMs'] for x in events if x['event']=='task-complete' and x.get('type')=='label')
search_start=min(x['elapsedMs'] for x in events if x['event']=='task-start' and x.get('type')=='search');search_end=max(x['elapsedMs'] for x in events if x['event']=='task-complete' and x.get('type')=='search')
d['resources'].update(phaseElapsedMs=phase,labelWindowSeconds=(label_end-label_start)/1000,completeQueriesPerHour=560*3600000/(label_end-label_start),fixedSearchWindowSeconds=(search_end-search_start)/1000,completeFixedSearchesPerHour=1440*3600000/(search_end-search_start),admittedSourcesPerSecond=256/(phase['all-identities-frozen']/1000),generationAttemptsPerSecond=1152/(phase['all-identities-frozen']/1000),mixedTaskMeanOccupiedSlots=d['resources']['completeTaskSeconds']/((phase['all-fixed-and-label-tasks-complete']-phase['all-games-complete'])/1000))
d.update(analysisRepair=repair,separateProcessVerification=verification,prospectiveRoleAdjudication=role,preScoreRoleAdjudication={'checksum':first['checksum'],'sameRoleDecisionsAsFinal':True,'laterCorrection':'Raw-file hashes originally hashed the JSON Buffer wrapper; corrected to actual file-byte SHA-256. Role decisions and every numerical outcome unchanged.'},finalIndependence={'reservedSourcesAndFamiliesDisjoint':True,'prospectiveDirectTargetSeparation':role['prospectiveDirectStateSeparation'],'initialAutomaticConservativeGameFlag':False,'initialArtifactPreserved':True,'scope':'Source/family-disjoint new assessment under the frozen prospective policy. Historical rejected-generation/played convergence and incidental internal/terminal overlaps remain disclosed; no universal-state-novelty claim.'},descriptiveSourceDiagnostics=extra,accountingNote='49.02 minutes is checkpointed scientific coordinator time including analysis repair; engineering import/qualification and separate verification, forensic provenance, tests, plotting and reporting are disclosed separately. All wall time after reservation also remains below four hours.')
source_inventory=read(base/'pc-inventory-before.json');assert source_inventory==read(base/'pc-inventory-qualified.json')==read(base/'pc-inventory-after.json')
d['archivePreservation']={'entries':source_inventory['fileCount'],'bytes':source_inventory['bytes'],'threeInventoriesIdentical':True,'inventorySha256':hashlib.sha256((base/'pc-inventory-before.json').read_bytes()).hexdigest()}
Path('docs/data/frozen-player-screen-20261029.json').write_text(json.dumps(d,separators=(',',':'))+'\n')
Path('docs/data/frozen-player-overlap-role-audit-20261029.json').write_text(json.dumps(role,separators=(',',':'))+'\n')
print(json.dumps({'resources':d['resources'],'archive':d['archivePreservation'],'evidenceBytes':Path('docs/data/frozen-player-screen-20261029.json').stat().st_size},indent=2))

# Matplotlib emits insignificant trailing spaces in SVG path coordinates.
svg = Path('docs/frozen-player-screen-20261029.svg')
svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines())+'\n')
