import importlib.util
import pathlib
import tempfile
import unittest
P=pathlib.Path(__file__).resolve().parents[1]/'scripts/phase-a-mac/verify-tournament.py'
spec=importlib.util.spec_from_file_location('tournament_verify',P)
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
class TournamentTests(unittest.TestCase):
    def test_independent_terminal_replay_and_illegal_pass(self):
        b=[1]*64
        g=dict(color=1,moves=[dict(player=1,move=None),dict(player=-1,move=None)],board=b,margin=64,outcome=1,points=1)
        self.assertEqual(len(v.replay(dict(board=b,player=1),g)),3)
        bad=dict(g,moves=g['moves']+[dict(player=1,move=None)])
        with self.assertRaises(AssertionError):v.replay(dict(board=b,player=1),bad)
        with self.assertRaises(AssertionError):v.replay(dict(board=v.inv.initial(),player=1),g)
    def test_receipt_tamper_detection(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'pair.json';v.seal(p,dict(pair=0,games=['a','b']))
            self.assertEqual(v.checked(p)['pair'],0)
            p.write_text(p.read_text().replace('"a"','"tamper"'))
            with self.assertRaises(AssertionError):v.checked(p)
    def test_schedule_rng_and_student_reference(self):
        schedule=v.expected_schedule(dict(orderSeed=2026103191))
        self.assertEqual(len(schedule),512)
        self.assertEqual(len({x['family'] for x in schedule}),256)
        for i in range(0,512,2):
            self.assertEqual(schedule[i]['family'],schedule[i+1]['family'])
            self.assertEqual(schedule[i]['color'],-schedule[i+1]['color'])
        self.assertAlmostEqual(v.critical(255,.95),1.6508510925,places=7)
    def test_python_symmetry_preserves_both_turn_keys(self):
        b=v.inv.initial();b=next(iter(v.children(b,1).values()))
        self.assertEqual(set(v.keys(tuple(b))),set(v.keys(tuple(-x for x in b))))
if __name__=='__main__':unittest.main()
