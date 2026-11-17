import assert from "node:assert/strict";
import test from "node:test";
import { calculateEvaluationMetrics, groupEvaluationOutcomes } from "../lib/evaluation-metrics.js";

test("percentage error uses actual consumed tile count as its denominator", () => {
  const metrics = calculateEvaluationMetrics([
    { plannedStockTiles: 100, actualTilesUsed: 110, breakageTiles: 2, consumptionBasis: "consumed-including-breakage-v1" },
  ]);

  assert.equal(metrics.sampleCount, 1);
  assert.ok(Math.abs(metrics.meanAbsolutePercentageError - (10 / 110 * 100)) < 1e-10);
  assert.ok(Math.abs(metrics.medianAbsolutePercentageError - (10 / 110 * 100)) < 1e-10);
  assert.equal(metrics.within5PercentCount, 0);
  assert.equal(metrics.within10PercentCount, 1);
  assert.ok(Math.abs(metrics.breakageRatePercent - (2 / 110 * 100)) < 1e-10);
});

test("accuracy summary reports median, threshold coverage, and signed bias", () => {
  const metrics = calculateEvaluationMetrics([
    { plannedStockTiles: 100, actualTilesUsed: 100, breakageTiles: null, practicalityRating: 4, laborMinutes: 200, consumptionBasis: "consumed-including-breakage-v1" },
    { plannedStockTiles: 100, actualTilesUsed: 105, breakageTiles: 1, practicalityRating: 5, laborMinutes: 220, consumptionBasis: "consumed-including-breakage-v1" },
    { plannedStockTiles: 100, actualTilesUsed: 120, breakageTiles: 3, practicalityRating: null, laborMinutes: null, consumptionBasis: "consumed-including-breakage-v1" },
  ]);

  assert.equal(metrics.sampleCount, 3);
  assert.equal(metrics.within5PercentCount, 2);
  assert.equal(metrics.within10PercentCount, 2);
  assert.ok(Math.abs(metrics.within5PercentRate - 200 / 3) < 1e-10);
  assert.ok(Math.abs(metrics.within10PercentRate - 200 / 3) < 1e-10);
  assert.ok(Math.abs(metrics.medianAbsolutePercentageError - (5 / 105 * 100)) < 1e-10);
  assert.equal(metrics.meanBiasTiles, 25 / 3);
  assert.equal(metrics.averagePracticalityRating, 4.5);
  assert.equal(metrics.averageLaborMinutes, 210);
  assert.equal(metrics.breakageRatePercent, 4 / 225 * 100);
});

test("empty and unusable outcomes do not produce misleading accuracy percentages", () => {
  const metrics = calculateEvaluationMetrics([
    { plannedStockTiles: 0, actualTilesUsed: 8 },
    { plannedStockTiles: 8, actualTilesUsed: 0 },
    { plannedStockTiles: 100, actualTilesUsed: 110, consumptionBasis: "legacy-unknown" },
  ]);

  assert.equal(metrics.sampleCount, 0);
  assert.equal(metrics.meanAbsolutePercentageError, null);
  assert.equal(metrics.medianAbsolutePercentageError, null);
  assert.equal(metrics.within5PercentRate, null);
  assert.equal(metrics.within10PercentRate, null);
  assert.equal(metrics.breakageRatePercent, null);
});

test("legacy outcomes without an explicit consumption definition are excluded from accuracy metrics", () => {
  const metrics = calculateEvaluationMetrics([
    { plannedStockTiles: 100, actualTilesUsed: 120, consumptionBasis: "legacy-unknown" },
    { plannedStockTiles: 100, actualTilesUsed: 105, consumptionBasis: "consumed-including-breakage-v1" },
  ]);

  assert.equal(metrics.sampleCount, 1);
  assert.ok(Math.abs(metrics.meanAbsolutePercentageError - (5 / 105 * 100)) < 1e-10);
});

test("cohort breakdown keeps patterns separate and reports evidence sample sizes", () => {
  const outcomes = [
    { plannedStockTiles: 100, actualTilesUsed: 105, consumptionBasis: "consumed-including-breakage-v1", pattern: "straight" },
    { plannedStockTiles: 100, actualTilesUsed: 120, consumptionBasis: "consumed-including-breakage-v1", pattern: "straight" },
    { plannedStockTiles: 50, actualTilesUsed: 50, consumptionBasis: "consumed-including-breakage-v1", pattern: "diagonal" },
    { plannedStockTiles: 50, actualTilesUsed: 60, consumptionBasis: "legacy-unknown", pattern: "diagonal" },
  ];
  const groups = groupEvaluationOutcomes(outcomes, "pattern");
  assert.deepEqual(groups.map((group) => [group.label, group.metrics.sampleCount]), [["straight", 2], ["diagonal", 1]]);
  assert.throws(() => groupEvaluationOutcomes(outcomes, "installerId"), /supported/);
});
