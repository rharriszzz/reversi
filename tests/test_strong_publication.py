"""Independent publication audits reject inconsistent results and stopping rules."""
import copy
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('strong_summary', ROOT / 'scripts/summarize-strong-research.py')
summary = importlib.util.module_from_spec(spec)
spec.loader.exec_module(summary)


class StrongPublicationTests(unittest.TestCase):
    def terminal_pair(self):
        games = []
        for color in [1, -1]:
            games.append({'candidateColor': color, 'winner': 1, 'margin': 64, 'outcome': color,
                          'moves': [{'player': 1, 'move': None}, {'player': -1, 'move': None}],
                          'stats': {'black': [], 'white': []}})
        return {'index': 0, 'opening': {'board': [1] * 64, 'player': 1}, 'budget': {'timeMs': 80}, 'games': games, 'point': .5}

    def test_replay_rejects_wrong_color_results_and_unearned_points(self):
        pair = self.terminal_pair()
        self.assertEqual(summary.audit_pair(pair, 0, {'timeMs': 80}), .5)
        for field, value in [('margin', 62), ('outcome', -1), ('winner', -1)]:
            wrong = copy.deepcopy(pair)
            wrong['games'][0][field] = value
            with self.assertRaises(AssertionError):
                summary.audit_pair(wrong, 0, {'timeMs': 80})
        wrong = copy.deepcopy(pair)
        wrong['point'] = .75
        with self.assertRaises(AssertionError):
            summary.audit_pair(wrong, 0, {'timeMs': 80})

    def test_replay_rejects_an_illegal_pass(self):
        pair = self.terminal_pair()
        pair['opening']['board'] = [0] * 64
        for square, value in [(27, -1), (28, 1), (35, 1), (36, -1)]:
            pair['opening']['board'][square] = value
        with self.assertRaisesRegex(AssertionError, 'Illegal pass'):
            summary.audit_pair(pair, 0, {'timeMs': 80})

    def test_fixed_sample_cannot_be_redefined_after_results(self):
        state = {'status': 'complete', 'stage': 'done', 'config': {'smoke': False, 'pilot': False}, 'failures': [],
                 'freeze': {'id': 'candidate', 'path': '/model', 'targets': {'20': 16, '80': 256, '300': 128}},
                 'conditions': [{'stage': 'confirmation', 'candidateId': 'candidate', 'candidate': '/model', 'budget': {'timeMs': ms}, 'target': n, 'tasks': [str(i) for i in range(n)]} for ms, n in summary.EXPECTED.items()]}
        summary.validate_complete(state)
        for action in ['target', 'incomplete', 'model']:
            wrong = copy.deepcopy(state)
            if action == 'target':
                wrong['conditions'][1]['target'] -= 1
            elif action == 'incomplete':
                wrong['conditions'][1]['tasks'].pop()
            else:
                wrong['conditions'][1]['candidate'] = '/changed-model'
            with self.assertRaises(AssertionError):
                summary.validate_complete(wrong)


if __name__ == '__main__':
    unittest.main()
