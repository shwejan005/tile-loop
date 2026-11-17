import "server-only";

import { cache } from "react";
import { calculateEvaluationMetrics } from "../evaluation-metrics.js";
import { classifyRoomShape, classifyRoomSize, formatTileCohort } from "../evaluation-cohorts.js";
import { requireAuthContext } from "../supabase/server.js";

function one(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

export const getPilotEvaluation = cache(async function getPilotEvaluation() {
  const { supabase } = await requireAuthContext();
  const { data, error } = await supabase
    .from("installation_outcomes")
    .select(`
      id, actual_tiles_used, actual_tiles_installed, reusable_offcuts, discarded_offcuts,
      installer_label, consumption_basis, breakage_tiles, labor_minutes, practicality_rating, note, completed_at,
      plan_snapshot:plan_snapshots (
        id, algorithm_version, inputs, result_summary,
        room_plan:room_plans (
          id, label, room_width_mm, room_length_mm, tile_width_mm, tile_length_mm, catalog_item_id,
          catalog_item:catalog_items (brand, collection_name, product_name, format_label),
          project:projects (id, name)
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
    const catalogItem = one(roomPlan?.catalog_item);
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
      actualTilesInstalled: outcome.actual_tiles_installed == null ? null : Number(outcome.actual_tiles_installed),
      reusableOffcuts: outcome.reusable_offcuts || [],
      discardedOffcuts: outcome.discarded_offcuts || [],
      installer: outcome.installer_label || "Unlabeled installer",
      pattern: snapshot.result_summary?.pattern || snapshot.inputs?.layout?.pattern || "Unknown pattern",
      roomShape: classifyRoomShape(snapshot.inputs?.roomGeometry),
      roomSize: classifyRoomSize(snapshot.result_summary?.roomAreaMm2),
      tileFormat: formatTileCohort(roomPlan.tile_width_mm, roomPlan.tile_length_mm),
      material: catalogItem
        ? `${catalogItem.brand || "Catalog product"} · ${catalogItem.collection_name || catalogItem.product_name || catalogItem.format_label || "Tile"}`
        : `Custom ${formatTileCohort(roomPlan.tile_width_mm, roomPlan.tile_length_mm)}`,
      consumptionBasis: outcome.consumption_basis,
      accuracyEligible: outcome.consumption_basis === "consumed-including-breakage-v1",
      breakageTiles: outcome.breakage_tiles == null ? null : Number(outcome.breakage_tiles),
      laborMinutes: outcome.labor_minutes == null ? null : Number(outcome.labor_minutes),
      practicalityRating: outcome.practicality_rating == null ? null : Number(outcome.practicality_rating),
      delta,
      absoluteError: Math.abs(delta),
      percentageError: Math.abs(delta) / actualTilesUsed * 100,
      note: outcome.note,
      completedAt: outcome.completed_at,
    }];
  });

  return {
    outcomes,
    metrics: calculateEvaluationMetrics(outcomes),
  };
});
