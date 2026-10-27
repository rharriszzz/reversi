"""Actual Windows Chrome -> WSL2 localhost check, run from WSL2.

Uses a disposable Chrome profile in Windows TEMP. Also exercises the launcher's
PowerShell Start-Process route to the Windows default browser. This does not
replace the interactive acceptance check or test native Windows Python.
"""
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import launch


def main():
    powershell = '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'
    windows_temp = subprocess.check_output([powershell, '-NoProfile', '-NonInteractive',
                                            '-Command', '[System.IO.Path]::GetTempPath()'], text=True).strip()
    profile = windows_temp.rstrip('\\') + '\\reversi-browser-' + uuid.uuid4().hex
    wsl_profile = Path(subprocess.check_output(['wslpath', '-u', profile], text=True).strip())
    with tempfile.TemporaryDirectory(prefix='reversi-windows-') as temp:
        server = subprocess.Popen([sys.executable, str(ROOT / 'launch.py'), '--no-browser', '--port', '0',
                                   '--http-log', str(Path(temp) / 'http.log')],
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            url = re.search(r'http://127\.0\.0\.1:\d+/', server.stdout.readline()).group()
            assert launch.is_wsl()
            assert launch.open_browser(url), 'PowerShell Windows default-browser launch failed'
            script = subprocess.check_output(['wslpath', '-w', str(ROOT / 'tests/windows_browser_check.ps1')], text=True).strip()
            result = subprocess.run([powershell, '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
                                     '-File', script, '-Url', url, '-Profile', profile],
                                    capture_output=True, text=True, timeout=60)
            assert result.returncode == 0, result.stderr[-2000:]
            assert 'PASS:' in result.stdout, result.stdout
            print(result.stdout.strip())
            print('PASS: launcher PowerShell Start-Process returned success for the Windows default browser')
        finally:
            server.terminate(); server.communicate(timeout=5)
            if wsl_profile.exists():
                shutil.rmtree(wsl_profile)


if __name__ == '__main__':
    main()
