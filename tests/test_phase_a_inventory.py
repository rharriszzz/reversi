import gzip
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('retained_inventory', ROOT/'scripts/phase-a-mac/inventory.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
catalog_spec = importlib.util.spec_from_file_location('pc_catalog', ROOT/'scripts/phase-a-mac/pc-catalog.py')
pc_catalog = importlib.util.module_from_spec(catalog_spec)
catalog_spec.loader.exec_module(pc_catalog)


class InventoryTests(unittest.TestCase):
    def test_independent_public_identity_and_color_reversal(self):
        proof = json.loads((ROOT/'docs/data/native-v2-overlap-proof-20261030.json').read_text())
        self.assertEqual(sorted(audit.identities(tuple(proof['board']))), sorted(proof['keys']))
        self.assertEqual(audit.identities(tuple(-x for x in proof['board'])),
                         audit.identities(tuple(proof['board']))[::-1])

    def test_forced_pass_and_illegal_pass(self):
        b = [1]*64
        b[0], b[1] = 0, -1
        states = list(audit.replay(b, -1, [None, 0]))
        self.assertEqual(states[-1], ([1]*64, -1))
        with self.assertRaises(ValueError):
            list(audit.replay(audit.initial(), 1, [None]))
        with self.assertRaises(ValueError):
            list(audit.replay(audit.initial(), 1, [0]))

    def test_bound_game_replay_ignores_results_and_does_not_infer_training(self):
        stream = io.StringIO()
        e = audit.Extractor(stream)
        b = [1]*64
        b[0], b[1] = 0, -1
        e.visit({'opening': {'board': b, 'player': 1},
                 'result': {'moves': [{'player': 1, 'move': 0}],
                            'board': [1]*64, 'points': 999, 'margin': 'do not inspect'}})
        self.assertEqual(e.replays, 1)
        self.assertEqual(e.errors, [])
        self.assertNotIn('999', stream.getvalue())
        self.assertNotIn('actual training target', stream.getvalue())

    def test_unbound_path_remains_a_gap(self):
        e = audit.Extractor(io.StringIO())
        e.visit({'moves': [19]})
        self.assertEqual(e.errors[0]['reason'], 'unbound move path')

    def test_browser_identity_object_is_not_a_game_identity(self):
        e = audit.Extractor(io.StringIO())
        e.visit({'identity': {'fingerprint': 'build'}, 'condition': 'diagnostic'})
        with tempfile.TemporaryDirectory() as temp:
            self.assertIsNone(audit.bound_root(Path(temp)/'diagnostic.json', {'condition':'diagnostic'}))

    def test_opaque_key_membership_stays_restricted(self):
        e = audit.Extractor(io.StringIO())
        e.visit({'keys': ['a'*64], 'sourceSha256': 'b'*64})
        self.assertEqual(e.keys, {'a'*64})

    def test_source_catalog_binds_literal_targets_and_full_directory_listing(self):
        with tempfile.TemporaryDirectory() as temp:
            p = Path(temp)
            (p/'run').mkdir()
            (p/'run'/'a').write_text('evidence')
            (p/'run'/'alias').symlink_to('/not/followed')
            (p/'other-run').mkdir()
            result = pc_catalog.collect(p, ['run'])
            self.assertEqual(result['count'], 2)
            self.assertEqual(result['topLevelEntries'], ['other-run','run'])
            self.assertEqual(result['files'][1]['kind'], 'symlink')
            mac = [dict(source='pc/run', path=r['path'].split('/',1)[1], **{k:r[k] for k in ('kind','bytes','sha256','target') if k in r}) for r in result['files']]
            self.assertTrue(pc_catalog.compare(result, mac)['equal'])
            mac[0]['sha256'] = '0'*64
            self.assertFalse(pc_catalog.compare(result, mac)['equal'])
            with self.assertRaises(ValueError):
                pc_catalog.collect(p, ['../run'])

    def test_sorted_unique_union_and_reject_unsorted_input(self):
        with tempfile.TemporaryDirectory() as temp:
            p = Path(temp)
            (p/'a').write_bytes(b'a'*32+b'c'*32)
            (p/'b').write_bytes(b'b'*32+b'c'*32)
            self.assertEqual(audit.merge([p/'a', p/'b'], p/'union'), 3)
            self.assertEqual((p/'union').read_bytes(), b'a'*32+b'b'*32+b'c'*32)
            (p/'bad').write_bytes(b'c'*32+b'a'*32)
            with self.assertRaises(ValueError):
                audit.merge([p/'bad'], p/'refused')

    def test_literal_symlink_identity_without_following_target(self):
        with tempfile.TemporaryDirectory() as temp:
            p = Path(temp)
            (p/'outside').mkdir()
            (p/'outside'/'unrelated').write_text('never enter')
            (p/'source').mkdir()
            (p/'source'/'alias').symlink_to(p/'outside', target_is_directory=True)
            rows, _ = audit.inventory([{'id':'fixture', 'path':str(p/'source'), 'originalPath':'PC'}])
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]['kind'], 'symlink')
            self.assertFalse(rows[0]['followed'])


if __name__ == '__main__':
    unittest.main()
