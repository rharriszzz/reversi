"""Start a local Reversi HTTP server on Windows, WSL2, macOS, or Linux.

Python 3 standard library only; no extra packages or online resources needed.
"""

from argparse import ArgumentParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import logging
from logging.handlers import RotatingFileHandler
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
    if sys.version_info < (3, 13):
        raise SystemExit('Reversi requires Python 3.13 or newer; select REVERSI_PYTHON or activate a supported environment.')
    parser = ArgumentParser(description='Launch the Reversi learning app on localhost')
    parser.add_argument('--no-browser', action='store_true',
                        help='Print the URL without opening a browser')
    parser.add_argument('--port', type=int, default=None,
                        help='Explicit port (default: first available 8000–8009; 0: OS picks port)')
    parser.add_argument('--http-log', type=Path, default=ROOT / 'logs' / 'http.log',
                        help='HTTP access/error log (default: logs/http.log in the repository)')
    args = parser.parse_args(argv)
    if args.port is not None and not 0 <= args.port <= 65535:
        parser.error('--port must be between 0 and 65535')

    log_path = args.http_log.resolve()
    try:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_handler = RotatingFileHandler(log_path, maxBytes=1_000_000, backupCount=3,
                                         encoding='utf-8')
    except OSError as error:
        parser.error(f'Cannot open HTTP log {log_path}: {error}')
    logger = logging.Logger('reversi.http', level=logging.INFO)
    log_handler.setFormatter(logging.Formatter('%(asctime)s %(message)s'))
    logger.addHandler(log_handler)

    class Handler(SimpleHTTPRequestHandler):
        extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".wasm": "application/wasm", ".mjs": "text/javascript"}

        def __init__(self, *handler_args, **kwargs):
            super().__init__(*handler_args, directory=str(ROOT), **kwargs)

        def log_message(self, message, *values):
            # Keep request-controlled control characters out of the log.
            line = (message % values).encode('unicode_escape').decode('ascii')
            logger.info('%s %s', self.client_address[0], line)

    server = None
    ports = (args.port,) if args.port is not None else DEFAULT_PORTS
    for port in ports:
        try:
            server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
            break
        except OSError:
            continue
    if server is None:
        log_handler.close()
        raise SystemExit('Unable to bind the requested localhost port(s).')
    url = f'http://127.0.0.1:{server.server_port}/'
    print(f'Reversi is running at {url}', flush=True)
    print(f'HTTP log: {log_path}', flush=True)
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
        log_handler.close()


if __name__ == '__main__':
    main()
