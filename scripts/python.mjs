// Select one supported interpreter for Node -> Python development subprocesses.
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

export function selectPython(env=process.env) {
  const root=fileURLToPath(new URL('../',import.meta.url));
  const executable=directory=>resolve(directory,process.platform==='win32'?'Scripts/python.exe':'bin/python');
  const python=env.REVERSI_PYTHON || (env.VIRTUAL_ENV ? executable(env.VIRTUAL_ENV) :
    existsSync(executable(resolve(root,'.venv'))) ? executable(resolve(root,'.venv')) : 'python3');
  const check=spawnSync(python,['-c','import sys; print(sys.executable); sys.exit(sys.version_info < (3, 13))'],{encoding:'utf8'});
  if(check.status!==0)throw Error(`Reversi requires Python 3.13+: ${python}. Select REVERSI_PYTHON or activate a supported environment. ${check.stderr??check.error??''}`);
  return check.stdout.trim();
}

export const python=selectPython();
