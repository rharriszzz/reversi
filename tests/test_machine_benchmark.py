import importlib.util
import copy
from pathlib import Path
import sys
import unittest
import json
import hashlib

HERE = Path(__file__).resolve().parents[1] / 'scripts/machine-benchmark'
sys.path.insert(0, str(HERE))


def module(name):
    spec = importlib.util.spec_from_file_location('machine_' + name, HERE / (name + '.py'))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


runner, comparison = module('run'), module('compare')


class MachineBenchmarkTests(unittest.TestCase):
    def test_portability_exception_binds_exact_files_and_rejects_numerical_changes(self):
        pc = json.loads((HERE.parents[1] / 'docs/data/mac-pc-pc.json').read_text())
        current = runner.source_identity()
        audit = comparison.source_compatibility(pc['source'], current)
        self.assertFalse(audit['identical'])
        self.assertIn('scripts/machine-benchmark/darwin-allocation.h', audit['changedFiles'])
        changed = copy.deepcopy(current)
        changed['files']['src/search.js'] = '0' * 64
        changed['sha256'] = hashlib.sha256(json.dumps(changed['files'], sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        with self.assertRaisesRegex(ValueError, 'source'):
            comparison.source_compatibility(pc['source'], changed)

    def test_memory_uses_actual_probe_cost_and_preserves_headroom(self):
        safe, _ = runner.safe_workers(6, 200 * 2**20, {'availableBytes': 2 * 2**30}, {'availableBytes': 2 * 2**30})
        self.assertFalse(safe)
        safe, _ = runner.safe_workers(1, 200 * 2**20, {'availableBytes': 4 * 2**30}, {'availableBytes': 4 * 2**30})
        self.assertTrue(safe)

    def test_comparison_refuses_smoke_failed_or_changed_work(self):
        base = dict(schema='v1', mode='smoke')
        with self.assertRaisesRegex(ValueError, 'completed full'):
            comparison.compare(base, base)
        with self.assertRaisesRegex(ValueError, 'fixtureIdentity'):
            comparison.compare({**base, 'fixtureIdentity': 'a'}, {**base, 'fixtureIdentity': 'b'})
        with self.assertRaisesRegex(ValueError, 'source'):
            comparison.compare({**base, 'source': 'a'}, {**base, 'source': 'b'})

    def test_matched_comparison_checks_numerical_receipts_and_reports_ratios(self):
        base = dict(schema='v1', mode='full', status='complete', validation={'passed': True},
                    plan={'repetitions': 3}, teacher={k: 'same' for k in ['upstream', 'patchSha256', 'sourceTreeSha256']},
                    trials=[], summary=[])
        for kind in comparison.KINDS:
            for rep in range(3):
                base['trials'].append(dict(kind=kind, workers=1, repetition=rep, tasks=16,
                    elapsedSeconds=10, usefulTasksPerHour=5760, numericalSequenceSha256='same'))
            base['summary'].append(dict(kind=kind, workers=1, elapsedSeconds={'n': 3}, usefulTasksPerHour={'median': 5760}))
        other = copy.deepcopy(base)
        for row in other['trials']:
            row['elapsedSeconds'] = 5
        report = comparison.compare(base, other)
        self.assertEqual(report['rows'][0]['rightSpeedup']['median'], 2)
        other['trials'][0]['numericalSequenceSha256'] = 'changed'
        with self.assertRaisesRegex(ValueError, 'numerical work differs'):
            comparison.compare(base, other)


if __name__ == '__main__':
    unittest.main()
