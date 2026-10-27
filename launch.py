"""Start a local Reversi HTTP server on Windows, WSL2, macOS, or Linux.

Python 3 standard library only; no extra packages or online resources needed.
"""

from argparse import ArgumentParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import shutil
import subprocess
import sys
import webbrowser

ROOT = Path(__file__).resolve().parent
DEFAULT_PORTS = range(8000, 8010)


def is_wsl():
    """Recognize WSL1/WSL2 without requiring a Linux package."""
    if sys.platform != 'linux':
        return False
    if os.environ.get('WSL_DISTRO_NAME'):
        return True
    try:
        return 'microsoft' in Path('/proc/sys/kernel/osrelease').read_text().lower()
    except OSError:
        return False


def open_browser(url):
    """WSL uses the Windows browser; macOS uses its native browser."""
    if is_wsl():
        candidates = [shutil.which('powershell.exe'),
                      '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe']
        for candidate in candidates:
            if candidate and Path(candidate).is_file():
                try:
                    result = subprocess.run(
                        [candidate, '-NoProfile', '-NonInteractive', '-Command',
                         f"Start-Process '{url}'"],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                        timeout=8, check=False)
                    if result.returncode == 0:
                        return True
                except (OSError, subprocess.TimeoutExpired):
                    pass
        return False
    if sys.platform == 'darwin':
        try:
            result = subprocess.run(['open', url], stdout=subprocess.DEVNULL,
                                    stderr=subprocess.DEVNULL, timeout=8,
                                    check=False)
            return result.returncode == 0
        except (OSError, subprocess.TimeoutExpired):
            return False
    return bool(webbrowser.open(url))


def main(argv=None):
    parser = ArgumentParser(description='Launch the Reversi learning app on localhost')
    parser.add_argument('--no-browser', action='store_true',
                        help='Print the URL without opening a browser')
    parser.add_argument('--port', type=int, default=None,
                        help='Explicit port (default: first available 8000–8009; 0: OS picks port)')
    args = parser.parse_args(argv)
    if args.port is not None and not 0 <= args.port <= 65535:
        parser.error('--port must be between 0 and 65535')

    os.chdir(ROOT)  # Serve files from repo, regardless of caller's working dir.
    server = None
    ports = (args.port,) if args.port is not None else DEFAULT_PORTS
    for port in ports:
        try:
            server = ThreadingHTTPServer(('127.0.0.1', port), SimpleHTTPRequestHandler)
            break
        except OSError:
            continue
    if server is None:
        raise SystemExit('Unable to bind the requested localhost port(s).')
    url = f'http://127.0.0.1:{server.server_port}/'
    print(f'Reversi is running at {url}', flush=True)
    print('Keep this terminal open while playing; Ctrl+C stops the server.', flush=True)
    print('On WSL2, open the URL in your Windows browser if it does not open automatically.', flush=True)
    if not args.no_browser and not open_browser(url):
        print(f'Could not open a browser automatically. Visit {url}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
