"""Session-ledger tests without native searches, resource queries or subprocesses."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('residual_launch', ROOT / 'scripts/residual/launch.py')
launch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launch)


class ResidualSessionTests(unittest.TestCase):
    def setUp(self):
        (ROOT / '.local-research').mkdir(exist_ok=True)
        self.directory = tempfile.TemporaryDirectory(prefix='residual-launch-test-', dir=ROOT / '.local-research')
        self.addCleanup(self.directory.cleanup)
        self.output = Path(self.directory.name) / 'run'
        self.output.mkdir()

    def run_cli(self, *args):
        with patch('sys.argv', ['residual-launch', '--output', str(self.output), *args]), \
                patch.object(launch, 'resources', return_value={'workers': 2, 'blockers': [], 'limitingAvailableGiB': 3}), \
                contextlib.redirect_stderr(io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
            return launch.main()

    def previous(self, *, status='paused', training=0, active=1000):
        manifest = {'status': status, 'elapsedMs': 241000, 'counts': {'reserved': {'pilot': 24, 'training': training}},
                    'sessions': [{'id': 'original-session'}]}
        session = {'id': 'original-session', 'budgetMs': 10800000, 'priorActiveMs': active,
                   'deadlineEpochMs': (time.time() + 10000) * 1000, 'authorizedHours': 3}
        (self.output / 'manifest.json').write_text(json.dumps(manifest))
        (self.output / 'session.json').write_text(json.dumps(session))
        return manifest, session

    def test_resume_cannot_renew_allowance_implicitly(self):
        self.previous()
        before = (self.output / 'session.json').read_bytes()
        with self.assertRaises(SystemExit):
            self.run_cli('--resume', '--session-hours', '3')
        self.assertEqual((self.output / 'session.json').read_bytes(), before)

    def test_exhaustion_is_normal_and_does_not_launch(self):
        self.previous(active=10800000-299999)
        with patch.object(launch.base, 'snapshot') as snapshot:
            self.assertEqual(self.run_cli('--resume'), 0)
            snapshot.assert_not_called()
        self.assertEqual(json.loads((self.output / 'manifest.json').read_text())['status'], 'paused')

    def test_first_session_cannot_request_locked_assessment(self):
        self.previous()
        with self.assertRaises(SystemExit):
            self.run_cli('--resume', '--mode', 'continue', '--open-assessment')

    def test_repeated_resumes_do_not_make_a_new_session(self):
        manifest, _ = self.previous()
        manifest['sessions'] *= 4
        (self.output / 'manifest.json').write_text(json.dumps(manifest))
        with self.assertRaises(SystemExit):
            self.run_cli('--resume', '--mode', 'continue', '--open-assessment')

    def test_completed_run_does_not_launch_again(self):
        self.previous(status='complete')
        with patch.object(launch.base, 'snapshot') as snapshot:
            self.assertEqual(self.run_cli('--resume'), 0)
            snapshot.assert_not_called()

    def test_new_session_needs_explicit_positive_authorized_hours(self):
        self.previous()
        for args in [('--resume', '--new-session'), ('--resume', '--new-session', '--session-hours', '0'),
                     ('--resume', '--new-session', '--session-hours', '9')]:
            with self.subTest(args=args), self.assertRaises(SystemExit):
                self.run_cli(*args)

    def test_engineering_repair_carries_deadline_budget_and_spent_time(self):
        manifest, session = self.previous(active=120000)
        previous = self.output
        self.output = previous.parent / 'repair'
        self.output.mkdir()
        with patch.object(launch.base, 'snapshot', side_effect=RuntimeError('stop after ledger')):
            with self.assertRaisesRegex(RuntimeError, 'stop after ledger'):
                self.run_cli('--repair-from', str(previous), '--mode', 'pilot')
        repaired = json.loads((self.output / 'session.json').read_text())
        for key in ['id', 'budgetMs', 'deadlineEpochMs', 'authorizedHours']:
            self.assertEqual(repaired[key], session[key])
        self.assertGreaterEqual(repaired['priorActiveMs'], session['priorActiveMs'])
        self.assertEqual(repaired['experimentPriorMs'], manifest['elapsedMs'])

    def test_repair_cannot_recast_scientific_data_as_new_engineering(self):
        self.previous(training=1)
        previous = self.output
        self.output = previous.parent / 'repair'
        self.output.mkdir()
        with self.assertRaises(SystemExit):
            self.run_cli('--repair-from', str(previous), '--mode', 'pilot')
        self.assertFalse((self.output / 'session.json').exists())


if __name__ == '__main__':
    unittest.main()
