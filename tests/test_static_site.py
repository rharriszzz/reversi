"""Package isolation, dependency closure, integrity, and project-prefix HTTP."""
import functools
import http.server
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import threading
import unittest
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('static_site', ROOT/'scripts/build-static.py')
site = importlib.util.module_from_spec(spec)
spec.loader.exec_module(site)


class StaticSite(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.old = site.ROOT, site.OUTPUT
        site.ROOT, site.OUTPUT = self.root, self.root/'dist/reversi'
        self.addCleanup(self.restore)
        for name in site.FILES:
            target = self.root/name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT/name, target)

    def restore(self):
        site.ROOT, site.OUTPUT = self.old

    def test_allowlist_and_reproducibility(self):
        (self.root/'.secret').write_text('private')
        first = site.build()
        self.assertEqual(first, site.build())
        self.assertEqual(first['files'], 18)
        self.assertEqual(set(first['sha256']), set(site.FILES))

    def test_missing_or_modified_binary_fails(self):
        site.build()
        binary = next(site.OUTPUT.glob('src/wasm/*.wasm'))
        binary.write_bytes(b'invalid')
        with self.assertRaisesRegex(ValueError, 'differs from source'):
            site.validate()
        binary.unlink()
        with self.assertRaisesRegex(ValueError, 'missing='):
            site.validate()

    def test_output_contamination_fails(self):
        site.build()
        (site.OUTPUT/'private.txt').write_text('private')
        with self.assertRaisesRegex(ValueError, 'unexpected files'):
            site.build()

    def test_runtime_dependency_and_absolute_paths_fail(self):
        for ref in ('./missing.js', '/src/rules.js', 'https://example.com/code.js'):
            with self.subTest(ref=ref):
                (self.root/'src/app.js').write_text((ROOT/'src/app.js').read_text()+f'\nimport {{x}} from "{ref}";')
                with self.assertRaises(ValueError):
                    site.build()

    def test_symlink_fails(self):
        file = self.root/'style.css'
        file.unlink()
        file.symlink_to(ROOT/'style.css')
        with self.assertRaisesRegex(ValueError, 'Symlink'):
            site.build()

    def test_project_prefix_and_http_types(self):
        site.build()
        class Quiet(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *args):
                pass
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(self.root/'dist')))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            for name in site.FILES:
                with urllib.request.urlopen(f'http://127.0.0.1:{server.server_port}/reversi/{name}') as response:
                    self.assertEqual(response.status, 200)
                    self.assertEqual(response.read(), (ROOT/name).read_bytes())
                    if name.endswith('.wasm'):
                        self.assertEqual(response.headers.get_content_type(), 'application/wasm')
                    if name.endswith(('.js', '.mjs')):
                        self.assertIn(response.headers.get_content_type(), ('text/javascript', 'application/javascript'))
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
