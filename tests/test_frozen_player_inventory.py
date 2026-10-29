import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

path = Path(__file__).resolve().parents[1] / 'scripts/frozen-player/inventory.py'
spec = importlib.util.spec_from_file_location('frozen_inventory', path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FrozenInventoryTests(unittest.TestCase):
    def test_inventory_retains_relative_paths_and_real_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'source.json').write_bytes(b'{"raw":"private"}')
            rows = module.inventory(root)
            self.assertEqual(rows, [{'path': 'source.json', 'bytes': 17,
                                    'sha256': hashlib.sha256(b'{"raw":"private"}').hexdigest()}])

    def test_missing_and_symlinked_inputs_cannot_certify_inventory(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaisesRegex(ValueError, 'Empty'):
                module.inventory(root)
            (root / 'source').write_text('data')
            (root / 'alias').symlink_to(root / 'source')
            with self.assertRaisesRegex(ValueError, 'Symlink'):
                module.inventory(root)


if __name__ == '__main__':
    unittest.main()
