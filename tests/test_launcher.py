"""Standard-library tests of the cross-platform local HTTP launcher.

These tests run in Linux, WSL2 and macOS but do not substitute for a
real Windows-browser/WSL interop test or native Mac graphical test.
"""
import pathlib
import re
import subprocess
import sys
import tempfile
import unittest
import urllib.request
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import launch  # noqa: E402


class LauncherTests(unittest.TestCase):
    def test_wsl_detection_from_environment(self):
        with patch.object(launch.sys, 'platform', 'linux'):
            with patch.dict(launch.os.environ, {'WSL_DISTRO_NAME': 'Ubuntu'}, clear=True):
                self.assertTrue(launch.is_wsl())

    def test_explicit_port_zero_serves_app_outside_repo_cwd(self):
        with tempfile.TemporaryDirectory() as unrelated_dir:
            process = subprocess.Popen(
                [sys.executable, str(ROOT / 'launch.py'), '--no-browser', '--port', '0'],
                cwd=unrelated_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                text=True,
            )
            try:
                line = process.stdout.readline()
                match = re.search(r'(http://127\.0\.0\.1:\d+/)', line)
                self.assertIsNotNone(match, f'no URL printed by launcher: {line!r}')
                base = match.group(1)
                with urllib.request.urlopen(base, timeout=5) as response:
                    html = response.read().decode('utf-8')
                    self.assertEqual(response.status, 200)
                    self.assertIn('src/app.js', html)
                with urllib.request.urlopen(base + 'src/rules.js', timeout=5) as response:
                    rules = response.read().decode('utf-8')
                    self.assertEqual(response.status, 200)
                    self.assertIn('legalMoves', rules)
                    self.assertIn('javascript', response.headers.get_content_type())
            finally:
                process.terminate()
                try:
                    process.communicate(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.communicate(timeout=5)


if __name__ == '__main__':
    unittest.main()
