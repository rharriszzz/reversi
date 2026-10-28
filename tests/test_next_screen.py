"""Portable frozen-screen recovery; fixtures do not require private models."""
import json
import importlib.util
import os
import socket
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]
NODE = shutil.which('node')

@unittest.skipUnless(NODE, 'Node required')
class NextScreenTests(unittest.TestCase):
    def test_frozen_smoke_resume_and_model_identity(self):
        with tempfile.TemporaryDirectory(prefix='reversi screen ') as folder:
            root = Path(folder)
            previous = root / 'previous'
            previous.mkdir()
            script = "import {createModel,pack} from './scripts/strong/model.mjs';import {atomic} from './scripts/research/io.mjs';const dir=process.argv[1];const best={};for(const objective of ['margin','rank']){const m=createModel('long',objective);const path=dir+'/'+m.id+'.json';atomic(path,pack(m));best[m.id]={path};}atomic(dir+'/manifest.json',{best});"
            subprocess.run([NODE, '--input-type=module', '-e', script, str(previous)], cwd=ROOT, check=True)
            output = root / 'screen'
            launch_spec = importlib.util.spec_from_file_location('screen_launch', ROOT / 'scripts/strong-launch.py')
            launcher = importlib.util.module_from_spec(launch_spec)
            launch_spec.loader.exec_module(launcher)
            frozen_root = root / 'frozen source'
            frozen_root.mkdir()
            frozen = launcher.snapshot(frozen_root)
            args = [NODE, str(frozen / 'scripts/next/screen.mjs'), '--smoke', '--repository', str(root), '--previous', str(previous), '--output', str(output)]
            result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=30)
            self.assertEqual(result.returncode, 0, result.stderr)
            state = json.loads((output / 'manifest.json').read_text())
            self.assertEqual(state['status'], 'complete')
            self.assertTrue(all(len(c['pairs']) == c['target'] for c in state['conditions']))
            self.assertFalse((output / 'screen.lock').exists())
            receipts = {p: p.read_bytes() for p in (output / 'tasks').glob('*.json')}
            (output / 'screen.lock').write_text(json.dumps({'pid': os.getpid(), 'host': socket.gethostname(), 'boot': 'previous-boot'}))
            resumed = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=10)
            self.assertEqual(resumed.returncode, 0, resumed.stderr)
            self.assertTrue(all(p.read_bytes() == content for p, content in receipts.items()))
            path = Path(state['models'][0]['path'])
            path.write_text(path.read_text() + '\n')
            changed = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=10)
            self.assertNotEqual(changed.returncode, 0)
            self.assertIn('Frozen model mismatch', changed.stderr)
