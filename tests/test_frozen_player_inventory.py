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

    def test_reviewed_pc_alias_is_recorded_literally_and_never_followed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / '.local-research').symlink_to('/home/rharris/git/reversi/.local-research')
            rows = module.inventory(root, record_pc_links=True)
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]['kind'], 'symlink')
            self.assertFalse(rows[0]['followed'])
            (root / 'unreviewed').symlink_to('/home/rharris/git/reversi/src')
            with self.assertRaisesRegex(ValueError, 'Symlink'):
                module.inventory(root, record_pc_links=True)


if __name__ == '__main__':
    unittest.main()
