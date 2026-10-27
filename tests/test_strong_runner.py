"""Crash recovery and independent split/inference integration, no platform claims."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import tempfile
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
NODE = shutil.which('node')
spec = importlib.util.spec_from_file_location('strong_launch', ROOT / 'scripts/strong-launch.py')
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


@unittest.skipUnless(NODE, 'Node required for offline integration')
class StrongRunnerTests(unittest.TestCase):
    def run_node(self, output, *args, timeout=40):
        return subprocess.run([NODE, 'scripts/strong/run.mjs', '--output', str(output), *args], cwd=ROOT, capture_output=True, text=True, timeout=timeout)

    def test_complete_smoke_freezes_before_final_and_preserves_split_roles_and_replies(self):
        with tempfile.TemporaryDirectory(prefix='reversi strong ') as folder:
            output = Path(folder)
            p = self.run_node(output, '--smoke', '--seconds', '60', '--workers', '2')
            self.assertEqual(p.returncode, 0, p.stderr)
            s = json.loads((output / 'manifest.json').read_text())
            self.assertEqual(s['status'], 'complete')
            self.assertEqual(s['stage'], 'done')
            self.assertGreater(s['counts']['positions'], 0)
            self.assertGreater(s['counts']['exact'], 0)
            self.assertTrue((output / 'confirmation-assessment.json').exists())
            self.assertFalse(s['failures'])
            keys = {}
            for split, paths in s['data'].items():
                keys[split] = set()
                for path in paths:
                    for game in json.loads(Path(path).read_text())['games']:
                        keys[split].update(state['key'] for state in game['states'])
            for a in keys:
                for b in keys:
                    if a != b:
                        self.assertFalse(keys[a] & keys[b])
            for condition in s['conditions']:
                self.assertEqual(len(condition['tasks']), condition['target'])
                for path in condition['tasks']:
                    pair = json.loads(Path(path).read_text())
                    self.assertEqual(len(pair['games']), 2)
                    self.assertEqual({g['candidateColor'] for g in pair['games']}, {-1, 1})
                    self.assertFalse(set(k for g in pair['games'] for k in g['keys']) & (keys['train'] | keys['development']))
                if condition['stage'] == 'confirmation':
                    for path in condition['tasks']:
                        task = next(t for t in s['tasks'].values() if t['path'] == path)
                        self.assertGreaterEqual(task['startedMs'], s['freeze']['elapsedMs'])
            before = (output / 'selection-freeze.json').read_bytes()
            resumed = self.run_node(output, '--resume')
            self.assertEqual(resumed.returncode, 0, resumed.stderr)
            self.assertEqual(before, (output / 'selection-freeze.json').read_bytes())
            self.assertEqual(len(s['tasks']), len(json.loads((output / 'manifest.json').read_text())['tasks']))
            continued_output = output / 'continuation'
            continued = self.run_node(continued_output, '--smoke', '--seconds', '60', '--seed', '992871', '--continue-from', str(output), timeout=80)
            self.assertEqual(continued.returncode, 0, continued.stderr)
            c = json.loads((continued_output / 'manifest.json').read_text())
            self.assertTrue(c['inherited'])
            self.assertEqual(c['status'], 'complete')
            self.assertGreater(c['counts']['positions'], s['counts']['positions'])
            self.assertEqual(c['data']['development'], s['data']['development'])
            for model, seen in s['modelSeen'].items():
                self.assertGreaterEqual(c['modelSeen'][model], seen)

    def test_sigkill_recovers_completed_receipts_and_stale_boot_lock_without_double_counting(self):
        with tempfile.TemporaryDirectory(prefix='reversi strong crash ') as folder:
            output = Path(folder)
            p = subprocess.Popen([NODE, 'scripts/strong/run.mjs', '--output', folder, '--smoke', '--seconds', '60'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
            try:
                end = time.monotonic() + 20
                while time.monotonic() < end:
                    path = output / 'manifest.json'
                    if path.exists():
                        s = json.loads(path.read_text())
                        if len(s.get('tasks', {})) >= 2 and s['status'] == 'running':
                            break
                    self.assertIsNone(p.poll())
                    time.sleep(.01)
                else:
                    self.fail('No completed shard before interruption')
                preserved = {t['path']: Path(t['path']).read_bytes() for t in s['tasks'].values()}
                p.kill()
                p.communicate(timeout=10)
                # Simulate a Windows reboot even if the old PID has been reused.
                (output / 'run.lock').write_text(json.dumps({'host': socket.gethostname(), 'pid': os.getpid(), 'boot': 'previous-boot', 'identity': 'old'}))
                r = self.run_node(output, '--resume')
                self.assertEqual(r.returncode, 0, r.stderr)
                state = json.loads((output / 'manifest.json').read_text())
                self.assertEqual(state['status'], 'complete')
                for path, content in preserved.items():
                    self.assertEqual(Path(path).read_bytes(), content)
                paths = state['data']['train']
                self.assertEqual(len(paths), len(set(paths)))
                games = [g for path in paths for g in json.loads(Path(path).read_text())['games']]
                self.assertEqual(state['counts']['trainGames'], len(games))
                self.assertEqual(state['counts']['positions'], sum(len(g['states']) for g in games))
                self.assertFalse((output / 'run.lock').exists())
            finally:
                if p.poll() is None:
                    p.kill()
                    p.communicate(timeout=5)

    def test_live_lock_and_source_mismatch_are_refused_without_rewriting_manifest(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            (path / 'run.lock').write_text(json.dumps({'host': socket.gethostname(), 'pid': os.getpid()}))
            r = self.run_node(path, '--smoke', '--seconds', '60')
            self.assertNotEqual(r.returncode, 0)
            self.assertIn('Live research writer', r.stderr)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            r = self.run_node(path, '--smoke', '--seconds', '60')
            self.assertEqual(r.returncode, 0, r.stderr)
            s = json.loads((path / 'manifest.json').read_text())
            s['source'] = 'changed'
            (path / 'manifest.json').write_text(json.dumps(s))
            before = (path / 'manifest.json').read_bytes()
            r = self.run_node(path, '--resume')
            self.assertNotEqual(r.returncode, 0)
            self.assertIn('mismatch', r.stderr)
            self.assertEqual(before, (path / 'manifest.json').read_bytes())

    def test_snapshot_and_detached_launcher_uses_frozen_inputs(self):
        with tempfile.TemporaryDirectory(prefix='reversi frozen ') as folder:
            output = Path(folder)
            resources = {'workers': 1, 'limitingAvailableGiB': 2, 'blockers': []}
            args = ['strong-launch', '--output', folder, '--smoke', '--seconds', '60']
            with patch.object(launcher, 'preflight', return_value=resources), patch('sys.argv', args):
                self.assertEqual(launcher.main(), 0)
            end = time.monotonic() + 30
            while time.monotonic() < end:
                s = json.loads((output / 'manifest.json').read_text())
                if s['status'] != 'running':
                    break
                time.sleep(.1)
            self.assertEqual(s['status'], 'complete')
            self.assertTrue((output / 'source/scripts/strong/run.mjs').exists())
            receipt = json.loads(next(output.glob('launch-*.json')).read_text())
            self.assertIn(str(output / 'source/scripts/strong/run.mjs'), receipt['command'])
            recovery = output / 'resume-after-reboot.cmd'
            if recovery.exists():
                self.assertIn('PATH=' + str(Path(NODE).parent), recovery.read_text())
            # Completion is published just before worker shutdown. Reap the
            # exact child before removing its output directory.
            try:
                os.waitpid(receipt['pid'], 0)
            except ChildProcessError:
                pass


if __name__ == '__main__':
    unittest.main()
