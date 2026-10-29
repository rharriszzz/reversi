"""Protect completed inputs and the fixed authorization before any subprocess."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('next_residual_launch',ROOT/'scripts/next-residual/launch.py')
launch=importlib.util.module_from_spec(spec)
spec.loader.exec_module(launch)

class NextResidualLaunchTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);self.local=self.root/'.local-research';self.local.mkdir();self.output=self.local/'new'
    def cli(self,*args):
        with patch.object(launch,'ROOT',self.root),patch.object(sys,'argv',['launch.py','--output',str(self.output),*args]):return launch.main()
    def test_completed_training_namespace_is_rejected_before_preflight(self):
        with patch.object(launch,'resources') as resource:
            with self.assertRaises(SystemExit):self.cli('--old',str(self.output))
            resource.assert_not_called()
        self.assertFalse(self.output.exists())
    def test_no_resource_blocker_launches_a_process(self):
        with patch.object(launch,'resources',return_value={'blockers':['memory reserve']}),patch.object(launch.subprocess,'Popen') as process:
            self.assertEqual(self.cli(),2);process.assert_not_called()
    def test_finished_scientific_run_is_not_resumed(self):
        self.output.mkdir();(self.output/'manifest.json').write_text(json.dumps({'status':'positional-gate-failed'}))
        with patch.object(launch,'resources',return_value={'blockers':[],'workers':1}),patch.object(launch.subprocess,'Popen') as process:
            self.assertEqual(self.cli('--resume'),0);process.assert_not_called()
    def test_eight_hour_authorization_cannot_be_reset_from_cli(self):
        with patch.object(launch,'resources') as resource:
            with self.assertRaises(SystemExit):self.cli('--hours','16')
            resource.assert_not_called()
