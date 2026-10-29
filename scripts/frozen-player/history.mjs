// Availability is not completeness. A legacy membership digest cannot certify
// role-specific independence without the PC inventory/provenance audit.
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
export const REQUIRED_RUNS = [
  'six-hour-20261027','strong-six-hour-20261027','next-frozen-screen-20261028',
  'teacher-audit-v1-20261028','residual-frontier-v1r2-20261028',
  'residual-constraint-pattern-screen-v1-20261029',
];
export function historyAvailability(repository) {
  const local=resolve(repository,'.local-research');
  const archive=resolve(local,'pc-import-20261029');
  const evidenceRoot=existsSync(archive)?archive:local;
  const available=existsSync(evidenceRoot)?readdirSync(evidenceRoot,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name).sort():[];
  const missing=REQUIRED_RUNS.filter(x=>!available.includes(x));
  return {evidenceRoot,readOnlyArchive:existsSync(archive),available,requiredRuns:REQUIRED_RUNS,missing,
    legacyIndexAvailable:existsSync(resolve(evidenceRoot,'residual-constraint-pattern-screen-v1-20261029/historical-index.bin')),
    verifiedRoleIndexAvailable:false,independentLaunchPermitted:false,
    reason:'No audited complete role/source/family provenance bundle has been imported. Directory presence alone does not qualify it.'};
}
