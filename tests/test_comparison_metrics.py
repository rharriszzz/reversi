"""Check that report aggregation preserves actual work, elapsed time and tails."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('comparison_metrics', Path(__file__).resolve().parents[1] / 'scripts/summarize-comparison.py')
metrics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(metrics)


class ComparisonMetricsTests(unittest.TestCase):
    def test_work_rates_use_actual_time_and_keep_depth_and_overruns_separate(self):
        result = metrics.move_summary([
            {'depth':3, 'nodes':10, 'evaluations':5, 'elapsedMs':20, 'budgetMs':20},
            {'depth':5, 'nodes':40, 'evaluations':20, 'elapsedMs':40, 'budgetMs':20},
        ])
        self.assertEqual(result['depthHistogram'], {3:1, 5:1})
        self.assertEqual(result['medianDepth'], 4)
        self.assertEqual(result['nodes'], 50)
        self.assertEqual(result['evaluations'], 25)
        self.assertAlmostEqual(result['evaluationsPerSecond'], 25/0.060)
        self.assertEqual(result['totalSearchMs'], 60)
        self.assertEqual(result['p95ElapsedMs'], 40)
        self.assertEqual(result['maxOverrunMs'], 20)
        self.assertEqual(result['overrunsAbove1ms'], 1)

    def test_explicit_unsearched_fallbacks_are_counted(self):
        result = metrics.move_summary([
            {'depth':0,'nodes':0,'evaluations':0,'elapsedMs':2,'budgetMs':1},
        ])
        self.assertEqual(result['unsearchedFallbacks'], 1)
        self.assertEqual(result['evaluationsPerSecond'], 0)
        self.assertEqual(result['p95OverrunMs'], 1)


if __name__ == '__main__':
    unittest.main()
