// Reserved before tuning or inspecting final results. Changing these seeds
// creates a NEW experiment; rerunning disclosed holdouts is not confirmation.
export const PROTOCOL = Object.freeze({
  version:'reversi-evaluator-comparison-v1',
  developmentSeed:31027011, selectionSeed:31027103,
  qualitySeed:31027991, gamesSeed:31028033, costSeed:31028517,
  developmentPositions:64, selectionPairs:16, qualityPositionsPerEarlyPhase:12,
  qualityLatePositions:64, finalPairs:32, timedBudgetsMs:[20,80],
  timedTotalSeconds:720, stableWeights:[15,30,60,90],
  decision:'Do not promote C unless its pair-level conservative 95% lower bound exceeds 0.5 against B at BOTH budgets, with at least 32 completed pairs per condition. Treat multiple comparisons as exploratory; independent confirmation and Mac acceptance still required.',
});
