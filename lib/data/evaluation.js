import "server-only";

import { cache } from "react";
import { requireAuthContext } from "../supabase/server.js";

function one(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

export const getPilotEvaluation = cache(async function getPilotEvaluation() {
  const { supabase } = await requireAuthContext();
  const { data, error } = await supabase
    .from("installation_outcomes")
    .select(`
      id, actual_tiles_used, breakage_tiles, labor_minutes, practicality_rating, note, completed_at,
      plan_snapshot:plan_snapshots (
        id, algorithm_version, result_summary,
        room_plan:room_plans (
          id, label, project:projects (id, name)
        )
      )
    `)
    .order("completed_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error("Could not load pilot evaluation data.");

  const outcomes = (data || []).flatMap((outcome) => {
    const snapshot = one(outcome.plan_snapshot);
    const roomPlan = one(snapshot?.room_plan);
    const project = one(roomPlan?.project);
    const plannedStockTiles = Number(snapshot?.result_summary?.stockTiles);
    if (!snapshot || !roomPlan || !project || !Number.isFinite(plannedStockTiles) || plannedStockTiles < 1) return [];
    const actualTilesUsed = Number(outcome.actual_tiles_used);
    const delta = actualTilesUsed - plannedStockTiles;
    return [{
      id: outcome.id,
      snapshotId: snapshot.id,
      algorithmVersion: snapshot.algorithm_version,
      projectId: project.id,
      projectName: project.name,
      roomPlanId: roomPlan.id,
      roomLabel: roomPlan.label,
      plannedStockTiles,
      actualTilesUsed,
      breakageTiles: outcome.breakage_tiles == null ? null : Number(outcome.breakage_tiles),
      laborMinutes: outcome.labor_minutes == null ? null : Number(outcome.labor_minutes),
      practicalityRating: outcome.practicality_rating == null ? null : Number(outcome.practicality_rating),
      delta,
      absoluteError: Math.abs(delta),
      percentageError: Math.abs(delta) / plannedStockTiles * 100,
      note: outcome.note,
      completedAt: outcome.completed_at,
    }];
  });

  const count = outcomes.length;
  const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const ratings = outcomes.map((outcome) => outcome.practicalityRating).filter((value) => value != null);
  const laborValues = outcomes.map((outcome) => outcome.laborMinutes).filter((value) => value != null);
  const breakageBase = outcomes.filter((outcome) => outcome.breakageTiles != null && outcome.actualTilesUsed > 0);

  return {
    outcomes,
    metrics: {
      sampleCount: count,
      meanAbsoluteErrorTiles: mean(outcomes.map((outcome) => outcome.absoluteError)),
      meanAbsolutePercentageError: mean(outcomes.map((outcome) => outcome.percentageError)),
      meanBiasTiles: mean(outcomes.map((outcome) => outcome.delta)),
      averagePracticalityRating: mean(ratings),
      averageLaborMinutes: mean(laborValues),
      breakageRatePercent: breakageBase.length
        ? breakageBase.reduce((sum, outcome) => sum + outcome.breakageTiles, 0)
          / breakageBase.reduce((sum, outcome) => sum + outcome.actualTilesUsed, 0) * 100
        : null,
    },
  };
});
