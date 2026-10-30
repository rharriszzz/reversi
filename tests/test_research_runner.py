"""Real subprocess acceptance: completed smoke, atomic resume, locks and SIGTERM."""
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

ROOT = Path(__file__).resolve().parents[1]
NODE = shutil.which('node')


@unittest.skipUnless(NODE, 'Node 20+ needed for offline research')
class ResearchRunnerTests(unittest.TestCase):
    def run_node(self, output, *args, timeout=40):
        return subprocess.run([NODE, 'scripts/research.mjs', '--output', str(output), *args],
                              cwd=ROOT, capture_output=True, text=True, timeout=timeout)

    def test_smoke_freeze_statistics_and_idempotent_resume(self):
        with tempfile.TemporaryDirectory(prefix='reversi-smoke-') as folder:
            output = Path(folder)
            result = self.run_node(output, '--mode', 'smoke', '--seconds', '60', '--workers', '2')
            self.assertEqual(result.returncode, 0, result.stderr)
            state = json.loads((output / 'manifest.json').read_text())
            self.assertEqual(state['status'], 'complete')
            self.assertFalse(state['failures'])
            self.assertEqual(len(state['training']['history']), 17)
            self.assertGreater(state['progress']['accepted']['confirmation-quality'], 0)
            self.assertTrue(state['freeze'])
            for name in ['report.md', 'results.json', 'curves.svg', 'pareto.json', 'selection-freeze.json']:
                self.assertTrue((output / name).is_file())
            for name, task in state['tasks'].items():
                if 'confirmation' in name:
                    self.assertGreaterEqual(task['startedMs'] if 'startedMs' in task else state['freeze']['elapsedMs'], state['freeze']['elapsedMs'])
            summaries = json.loads((output / 'results.json').read_text())['conditions']
            self.assertTrue(all(c['summary']['games'] == c['summary']['pairs'] * 2 for c in summaries))
            self.assertTrue(any(c['stage'] == 'confirmation' and c['summary']['pairs'] for c in summaries))
            # The worker never accesses confirmation before this durable record.
            # WSL/Windows wall clocks can move backwards during adjustment.
            # Durable event order uses the coordinator's monotonic elapsed time.
            self.assertLessEqual(state['freeze']['elapsedMs'],
                                 state['tasks']['confirmation-assessment']['startedMs'])
            paths = {p for files in state['data'].values() for p in files}
            original = {p: Path(p).read_bytes() for p in paths}
            result = self.run_node(output, '--resume')
            self.assertEqual(result.returncode, 0, result.stderr)
            resumed = json.loads((output / 'manifest.json').read_text())
            self.assertEqual(len(resumed['tasks']), len(state['tasks']))
            self.assertEqual(len(resumed['sessions']), 2)
            self.assertEqual(resumed['freeze'], state['freeze'])
            for path, content in original.items():
                self.assertEqual(Path(path).read_bytes(), content)
            # A changed source identity must refuse without corrupting the run.
            resumed['source'] = 'wrong-source'
            (output / 'manifest.json').write_text(json.dumps(resumed))
            before = (output / 'manifest.json').read_bytes()
            refused = self.run_node(output, '--resume')
            self.assertNotEqual(refused.returncode, 0)
            self.assertIn('Source/protocol changed', refused.stderr)
            self.assertEqual((output / 'manifest.json').read_bytes(), before)

    def test_live_writer_lock_is_respected(self):
        with tempfile.TemporaryDirectory(prefix='reversi-lock-') as folder:
            output = Path(folder)
            (output / 'run.lock').write_text(json.dumps({'host': socket.gethostname(), 'pid': os.getpid()}))
            result = self.run_node(output, '--mode', 'smoke')
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('locked', result.stderr)
            self.assertTrue((output / 'run.lock').exists())
            self.assertFalse((output / 'manifest.json').exists())

    def test_detached_smoke_survives_launcher_exit(self):
        with tempfile.TemporaryDirectory(prefix='reversi detached ') as folder:
            launch = subprocess.run([shutil.which('python3'), 'scripts/research-launch.py', '--mode', 'smoke', '--seconds', '60', '--workers', '1', '--output', folder],
                                    cwd=ROOT, capture_output=True, text=True, timeout=20)
            self.assertEqual(launch.returncode, 0, launch.stderr)
            self.assertIn('independent session', launch.stdout)
            end = time.monotonic() + 30
            while time.monotonic() < end:
                state = json.loads((Path(folder) / 'manifest.json').read_text())
                if state['status'] != 'running':
                    break
                time.sleep(0.05)
            # Failure status is checkpointed before final reports/lock release.
            # Preserve the underlying correctness failure in the assertion.
            failure_log = (Path(folder) / 'correctness.log').read_text() if (Path(folder) / 'correctness.log').exists() else ''
            end = time.monotonic() + 5
            while (Path(folder) / 'run.lock').exists() and time.monotonic() < end:
                time.sleep(0.05)
            self.assertEqual(state['status'], 'complete', failure_log[-16000:])
            self.assertEqual(state['stage'], 'done')
            # Completion is checkpointed before the detached process finishes
            # its final reports and releases its writer lock. Wait for that
            # release before TemporaryDirectory removes the output tree.
            end = time.monotonic() + 5
            while (Path(folder) / 'run.lock').exists() and time.monotonic() < end:
                time.sleep(0.05)
            self.assertFalse((Path(folder) / 'run.lock').exists())

    def test_sigterm_checkpoints_and_resumes_without_partial_pairs(self):
        with tempfile.TemporaryDirectory(prefix='reversi-resume-') as folder:
            output = Path(folder)
            command = [NODE, 'scripts/research.mjs', '--mode', 'full', '--hours', '8', '--workers', '2', '--output', folder]
            with subprocess.Popen(command, cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True) as process:
                end = time.monotonic() + 30
                while time.monotonic() < end:
                    manifest = output / 'manifest.json'
                    if manifest.exists() and json.loads(manifest.read_text()).get('stage') == 'data':
                        break
                    if process.poll() is not None:
                        details = (output / 'correctness.log').read_text() if (output / 'correctness.log').exists() else ''
                        self.fail(process.stderr.read() + details[-16000:])
                    time.sleep(0.02)
                else:
                    process.terminate()
                    self.fail('runner did not reach data stage')
                process.send_signal(signal.SIGTERM)
                _, stderr = process.communicate(timeout=10)
                self.assertEqual(process.returncode, 0, stderr)
            state = json.loads((output / 'manifest.json').read_text())
            self.assertEqual(state['status'], 'stopped')
            self.assertIn('SIGTERM', state['stoppingReason'])
            self.assertFalse((output / 'run.lock').exists())
            # This is a cumulative allowance, including correctness on both
            # starts. Leave room for actual-Wasm numerical tests as well as native
            # checks on both starts; this is a test allowance, not research.
            resume = self.run_node(output, '--resume', '--seconds', '30', timeout=45)
            self.assertEqual(resume.returncode, 0, resume.stderr + ((output / 'correctness.log').read_text()[-16000:] if (output / 'correctness.log').exists() else ''))
            state = json.loads((output / 'manifest.json').read_text())
            self.assertEqual(len(state['sessions']), 2)
            self.assertNotEqual(state['status'], 'failed')
            self.assertFalse(any(task['status'] == 'running' for task in state['tasks'].values()))
            for condition in state['conditions']:
                for task in condition['tasks']:
                    pair = json.loads(Path(state['tasks'][task]['path']).read_text())
                    self.assertEqual(len(pair['games']), 2)


if __name__ == '__main__':
    unittest.main()
