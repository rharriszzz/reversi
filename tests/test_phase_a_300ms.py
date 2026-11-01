import importlib.util,pathlib,unittest
P=pathlib.Path(__file__).resolve().parents[1]/'scripts/phase-a-300ms/verify-tournament.py'
spec=importlib.util.spec_from_file_location('verify300',P);v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
class Prospective300Tests(unittest.TestCase):
    def test_early_terminal_exact_and_corruption(self):
        board=[1]*64;board[0]=board[7]=0;board[1]=-1
        m=dict(depth=1,occupied=62,move=0,score=10063)
        v.verify_early_terminal_exact(m,board,1)
        with self.assertRaises(AssertionError):v.verify_early_terminal_exact(dict(m,score=10062),board,1)
        v.EARLY_EXACT.clear()
    def test_new_schedule_and_raw_terminal_passes(self):
        schedule=v.expected_schedule(dict(orderSeed=2026110101))
        self.assertEqual(len(schedule),512);self.assertTrue(all(c['timeMs']==300 for c in schedule))
        board=[1]*64;board[0]=0
        game=dict(color=-1,moves=[dict(player=1,move=None),dict(player=-1,move=None)],board=board,margin=-63,outcome=-1,points=0)
        self.assertEqual(len(v.replay(dict(board=board,player=1),game)),3)
        with self.assertRaises(AssertionError):v.replay(dict(board=v.inv.initial(),player=1),game)
if __name__=='__main__':unittest.main()
