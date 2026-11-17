function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Summarize planned practical stock against actual stock consumed. */
export function calculateEvaluationMetrics(outcomes) {
  const usable = outcomes.filter((outcome) => outcome.consumptionBasis === "consumed-including-breakage-v1"
    && Number.isFinite(outcome.plannedStockTiles)
    && outcome.plannedStockTiles > 0
    && Number.isFinite(outcome.actualTilesUsed)
    && outcome.actualTilesUsed > 0);
  const deltas = usable.map((outcome) => outcome.actualTilesUsed - outcome.plannedStockTiles);
  const absoluteErrors = deltas.map(Math.abs);
  const percentageErrors = usable.map((outcome) => Math.abs(outcome.actualTilesUsed - outcome.plannedStockTiles)
    / outcome.actualTilesUsed * 100);
  const within = (limit) => percentageErrors.filter((error) => error <= limit).length;
  const rate = (count) => percentageErrors.length ? count / percentageErrors.length * 100 : null;
  const ratings = usable.map((outcome) => outcome.practicalityRating).filter(Number.isFinite);
  const laborValues = usable.map((outcome) => outcome.laborMinutes).filter(Number.isFinite);
  const breakageBase = usable.filter((outcome) => Number.isFinite(outcome.breakageTiles) && outcome.breakageTiles >= 0);
  const breakageCount = breakageBase.reduce((sum, outcome) => sum + outcome.breakageTiles, 0);
  const consumedCount = breakageBase.reduce((sum, outcome) => sum + outcome.actualTilesUsed, 0);
  const within5PercentCount = within(5);
  const within10PercentCount = within(10);

  return {
    sampleCount: usable.length,
    meanAbsoluteErrorTiles: mean(absoluteErrors),
    meanAbsolutePercentageError: mean(percentageErrors),
    medianAbsolutePercentageError: median(percentageErrors),
    within5PercentCount,
    within5PercentRate: rate(within5PercentCount),
    within10PercentCount,
    within10PercentRate: rate(within10PercentCount),
    meanBiasTiles: mean(deltas),
    averagePracticalityRating: mean(ratings),
    averageLaborMinutes: mean(laborValues),
    breakageRatePercent: consumedCount > 0 ? breakageCount / consumedCount * 100 : null,
  };
}

const COHORT_FIELDS = new Set(["pattern", "roomShape", "roomSize", "tileFormat", "material", "installer"]);

export function groupEvaluationOutcomes(outcomes, dimension) {
  if (!COHORT_FIELDS.has(dimension)) throw new TypeError("Choose a supported project cohort dimension.");
  const groups = new Map();
  for (const outcome of outcomes) {
    const label = outcome[dimension] || "Unknown / not recorded";
    const group = groups.get(label) || [];
    group.push(outcome);
    groups.set(label, group);
  }
  return [...groups.entries()]
    .map(([label, entries]) => ({ label, metrics: calculateEvaluationMetrics(entries) }))
    .sort((left, right) => right.metrics.sampleCount - left.metrics.sampleCount || left.label.localeCompare(right.label));
}
