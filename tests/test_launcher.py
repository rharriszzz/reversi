"""Standard-library tests of the cross-platform local HTTP launcher.

These tests run in Linux, WSL2 and macOS but do not substitute for a
real Windows-browser/WSL interop test or native Mac graphical test.
"""
import pathlib
import shutil
import signal
import socket
import re
import subprocess
import sys
import tempfile
import unittest
import urllib.request
import urllib.error
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import launch  # noqa: E402


class LauncherTests(unittest.TestCase):
    def test_platform_browser_commands(self):
        with patch.object(launch, 'is_wsl', return_value=False), patch.object(launch.sys, 'platform', 'darwin'), patch.object(launch.subprocess, 'run') as run:
            run.return_value.returncode = 0
            self.assertTrue(launch.open_browser('http://127.0.0.1:8000/'))
            self.assertEqual(run.call_args.args[0], ['open', 'http://127.0.0.1:8000/'])
        with patch.object(launch, 'is_wsl', return_value=True), patch.object(launch.shutil, 'which', return_value='/windows/powershell.exe'), patch.object(launch.Path, 'is_file', return_value=True), patch.object(launch.subprocess, 'run') as run:
            run.return_value.returncode = 0
            self.assertTrue(launch.open_browser('http://127.0.0.1:8000/'))
            self.assertIn("Start-Process 'http://127.0.0.1:8000/'", run.call_args.args[0])

    def test_shell_launcher_spaces_auto_port_logs_and_shutdown(self):
        if sys.platform == 'win32':
            self.skipTest('POSIX shell launcher')
        with tempfile.TemporaryDirectory(prefix='reversi space ') as temp:
            directory = pathlib.Path(temp)
            for file in ['launch.py', 'start.sh', 'index.html']:
                shutil.copy2(ROOT / file, directory / file)
            # Occupy 8000 to exercise default port fallback when available.
            with socket.socket() as occupied:
                try:
                    occupied.bind(('127.0.0.1', 8000)); occupied.listen()
                except OSError:
                    pass  # Already occupied by another application.
                process = subprocess.Popen([str(directory / 'start.sh'), '--no-browser'], cwd='/tmp',
                                           stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                try:
                    line = process.stdout.readline()
                    url = re.search(r'http://127\.0\.0\.1:(\d+)/', line)
                    self.assertIsNotNone(url, line)
                    self.assertNotEqual(int(url.group(1)), 8000)
                    with urllib.request.urlopen(url.group(), timeout=5) as response:
                        self.assertIn(b'src/app.js', response.read())
                    with self.assertRaises(urllib.error.HTTPError):
                        urllib.request.urlopen(url.group() + 'missing', timeout=5)
                    process.send_signal(signal.SIGINT)
                    stdout, stderr = process.communicate(timeout=5)
                    self.assertEqual(process.returncode, 0, stderr)
                    self.assertEqual(stderr, '')
                    self.assertNotIn('GET /', stdout)
                    log = (directory / 'logs/http.log').read_text()
                    self.assertIn('GET / HTTP/1.1', log)
                    self.assertIn('404', log)
                finally:
                    if process.poll() is None:
                        process.kill(); process.communicate(timeout=5)

    def test_wsl_detection_from_environment(self):
        with patch.object(launch.sys, 'platform', 'linux'):
            with patch.dict(launch.os.environ, {'WSL_DISTRO_NAME': 'Ubuntu'}, clear=True):
                self.assertTrue(launch.is_wsl())

    def test_explicit_port_zero_serves_app_outside_repo_cwd(self):
        with tempfile.TemporaryDirectory() as unrelated_dir:
            process = subprocess.Popen(
                [sys.executable, str(ROOT / 'launch.py'), '--no-browser', '--port', '0', '--http-log', str(pathlib.Path(unrelated_dir) / 'requests.log')],
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
