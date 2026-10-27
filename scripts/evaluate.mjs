// Bounded, reproducible experiment. JSON goes to stdout; no model is installed.
import { DEFAULT_WEIGHTS } from '../src/features.js';
import { randomOpening, seededRandom, playModelMatch, runGeneration } from '../src/learning.js';
import { trainLinearTD } from '../src/td.js';

export function canonicalOpening({ board, player }) {
  const keys = [];
  for (let mirror = 0; mirror < 2; mirror++) for (let rotate = 0; rotate < 4; rotate++) {
    const transformed = Array(64);
    for (let i = 0; i < 64; i++) {
      let r = i >> 3, c = i & 7;
      if (mirror) c = 7 - c;
      for (let n = 0; n < rotate; n++) [r, c] = [c, 7 - r];
      transformed[r * 8 + c] = board[i];
    }
    keys.push(`${player}:${transformed.join(',')}`);
  }
  return keys.sort()[0];
}

export function openingSet(seed, count, excluded = new Set()) {
  const rng = seededRandom(seed), result = [];
  for (let tries = 0; result.length < count; tries++) {
    if (tries > 100000) throw new Error('Could not generate distinct openings');
    const opening = randomOpening(rng, 8), key = canonicalOpening(opening);
    if (excluded.has(key)) continue;
    excluded.add(key); result.push(opening);
  }
  return result;
}

export function benchmark(candidate, baseline, openings, depth) {
  let wins = 0, draws = 0, losses = 0;
  const pairs = openings.map(opening => {
    const outcomes = [1, -1].map(color => {
      const match = playModelMatch(opening, color === 1 ? candidate : baseline,
        color === -1 ? candidate : baseline, depth);
      const outcome = match.result * color;
      if (outcome > 0) wins++; else if (outcome < 0) losses++; else draws++;
      return outcome > 0 ? 1 : outcome < 0 ? 0 : 0.5;
    });
    return (outcomes[0] + outcomes[1]) / 2;
  });
  const mean = pairs.reduce((sum, value) => sum + value, 0) / pairs.length;
  // The unit of sampling is an OPENING PAIR, never an individual color game.
  const radius = Math.sqrt(Math.log(40) / (2 * pairs.length));
  return { wins, draws, losses, games: 2 * pairs.length, openingPairs: pairs.length,
    scoreRate: mean, interval95: [Math.max(0, mean - radius), Math.min(1, mean + radius)],
    uncertainty: 'Conservative Hoeffding bound over sampled opening-pair mean points; exploratory small sample', pairs, depth };
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const pairs = Number(process.argv[2] ?? 8), depth = Number(process.argv[3] ?? 2);
  if (!Number.isInteger(pairs) || pairs < 2 || pairs > 16 || !Number.isInteger(depth) || depth < 1 || depth > 3) {
    throw new Error('Usage: node scripts/evaluate.mjs [opening-pairs 2..16] [search-depth 1..3]');
  }
  const used = new Set(), trainingSeed = 20261026, holdoutSeed = 734917;
  const training = openingSet(trainingSeed, pairs, used);
  const holdout = openingSet(holdoutSeed, pairs, used);
  const mutation = runGeneration(DEFAULT_WEIGHTS, { seed: trainingSeed, depth, openingPairs: pairs, openings: training });
  const td = trainLinearTD(DEFAULT_WEIGHTS, training, { depth: 1 });
  const start = performance.now();
  const report = { format: 'reversi-evaluation-experiment-v1', trainingSeed, holdoutSeed,
    openingPlies: 8, budget: `fixed depth ${depth} for both colors and models; full-window scores for every move`,
    training: training.map(canonicalOpening), holdout: holdout.map(canonicalOpening),
    mutation: { acceptedOnTraining: mutation.accepted, trainingPoints: mutation.points,
      parameterVersion: 'weight-mutation-v1', weights: mutation.candidate,
      holdout: benchmark(mutation.candidate, DEFAULT_WEIGHTS, holdout, depth) },
    td: { ...td, holdout: benchmark(td.weights, DEFAULT_WEIGHTS, holdout, depth) },
    conclusion: 'Neither candidate is installed. No strength claim from this small experiment.' };
  report.holdoutElapsedMs = Math.round(performance.now() - start);
  console.log(JSON.stringify(report, null, 2));
}
