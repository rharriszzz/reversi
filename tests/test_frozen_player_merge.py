import hashlib
from pathlib import Path
import subprocess
import tempfile
import unittest


class FrozenMergeTests(unittest.TestCase):
    def test_streamed_full_sha_merge_preserves_sort_and_removes_all_duplicates(self):
        script = Path(__file__).resolve().parents[1]/'scripts/frozen-player/merge-index.py'
        keys = sorted(hashlib.sha256(str(i).encode()).digest() for i in range(101))
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); chunks = root/'chunks'; chunks.mkdir()
            (root/'base.bin').write_bytes(b''.join(keys[:80]))
            (chunks/'0.bin').write_bytes(b''.join(keys[40:]))
            (chunks/'1.bin').write_bytes(b''.join(keys[::2]))
            result = subprocess.run(['python3',str(script),str(root/'merged.bin'),str(root/'base.bin'),str(chunks)], capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertEqual((root/'merged.bin').read_bytes(),b''.join(keys))
            self.assertIn('"keys": 101',result.stdout)
