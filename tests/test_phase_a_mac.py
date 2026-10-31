"""Public-fixture checks for the independent historical occurrence decoder."""
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('phase_a_preflight', ROOT/'scripts/phase-a-mac/preflight.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class PhaseAMacAuditTests(unittest.TestCase):
    def test_canonical_identity_against_published_independent_development_proof(self):
        proof = json.loads((ROOT/'docs/data/native-v2-overlap-proof-20261030.json').read_text())
        self.assertEqual(sorted(audit.keys(proof['board'])), sorted(proof['keys']))
        self.assertEqual(sorted(audit.keys(proof['historicalBoard'])), sorted(proof['keys']))
        self.assertEqual(audit.keys([-v for v in proof['board']]), audit.keys(proof['board'])[::-1])

    def test_student_observation_preserves_negative_cell_boundaries(self):
        board = audit.initial()
        encoded = '-1:'+''.join(str(v) for v in board)
        actual, method = audit.occurrence_board({'result': {'observed': [encoded]}}, {'location': '/result/observed/0'})
        self.assertEqual(actual, board)
        self.assertEqual(method, 'encoded student-search observation')

    def test_reserved_child_and_full_behavior_replay_use_independent_rules(self):
        board = audit.initial()
        expected = audit.mailbox.children(board, 1)[19]
        child, _ = audit.occurrence_board({'result': {'root': {'board': board, 'player': 1}}}, {'location': '/result/reserved-root-child-19'})
        self.assertEqual(child, expected)
        replayed, _ = audit.occurrence_board({'games': [{'moves': [{'player': 1, 'move': 19}]}]}, {'location': '/games/0/replayed/0'})
        self.assertEqual(replayed, expected)
        with self.assertRaises(KeyError):
            audit.replay_to({'moves': [{'player': 1, 'move': 0}]}, {'board': board, 'player': 1}, 0)

    def test_forced_pass_teacher_prefix_keeps_same_board_then_applies_move(self):
        board = [1]*64
        board[0], board[1] = 0, -1
        raw = {'state': {'board': board, 'player': -1}, 'teacher': {'rows': [{'move': None, 'pv': [None, 0]}]}}
        first, _ = audit.occurrence_board(raw, {'location': '/state-label/move-null/step-1'})
        second, _ = audit.occurrence_board(raw, {'location': '/state-label/move-null/step-2'})
        self.assertEqual(first, board)
        self.assertEqual(second, [1]*64)
        raw['teacher']['rows'][0]['pv'] = [0]
        with self.assertRaises(KeyError):
            audit.occurrence_board(raw, {'location': '/state-label/move-null/step-1'})

    def test_unsupported_occurrence_is_an_error(self):
        with self.assertRaises(ValueError):
            audit.occurrence_board({'unknown': 42}, {'location': '/unknown'})


if __name__ == '__main__':
    unittest.main()
