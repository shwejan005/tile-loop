import "server-only";

import { cache } from "react";
import { requireAuthContext } from "../supabase/server.js";

const PLAN_SELECT = `
  id, project_id, catalog_item_id, label, room_width_mm, room_length_mm,
  tile_width_mm, tile_length_mm, grout_mm, kerf_mm, orientation,
  reserve_pct, created_at, updated_at,
  catalog_item:catalog_items (
    id, brand, supplier_code, product_name, collection_name, color,
    format_label, width_mm, height_mm, thickness_mm, quality_flags,
    source_page_url, catalog_status
  ),
  plan_snapshots (
    id, algorithm_version, input_hash, result_summary, minimum_tiles_by_area, created_at,
    installer_comparisons (id, installer_estimate_tiles, note, created_at),
    installation_outcomes (id, actual_tiles_used, breakage_tiles, labor_minutes, practicality_rating, note, completed_at, created_at, updated_at)
  )
`;

function latestSnapshot(plan) {
  return [...(plan.plan_snapshots || [])]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] || null;
}

export const getDashboardProjects = cache(async function getDashboardProjects() {
  const { supabase } = await requireAuthContext();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, created_at, updated_at, room_plans(id)")
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Could not load projects.");
  return (data || []).map((project) => ({
    id: project.id,
    name: project.name,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    roomCount: project.room_plans?.length || 0,
  }));
});

export const getProjectWithPlans = cache(async function getProjectWithPlans(projectId) {
  const { supabase } = await requireAuthContext();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, created_at, updated_at")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) throw new Error("Could not load this project.");
  if (!project) return null;

  const { data: plans, error: plansError } = await supabase
    .from("room_plans")
    .select(PLAN_SELECT)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });
  if (plansError) throw new Error("Could not load room plans.");

  return {
    ...project,
    plans: (plans || []).map((plan) => ({ ...plan, latestSnapshot: latestSnapshot(plan) })),
  };
});

export const getRoomPlan = cache(async function getRoomPlan(projectId, roomPlanId) {
  const { supabase } = await requireAuthContext();
  const { data, error } = await supabase
    .from("room_plans")
    .select(PLAN_SELECT)
    .eq("project_id", projectId)
    .eq("id", roomPlanId)
    .maybeSingle();
  if (error) throw new Error("Could not load this room plan.");
  if (!data) return null;
  const snapshots = [...(data.plan_snapshots || [])]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  if (snapshots[0]) {
    const { data: latestInputs, error: inputsError } = await supabase
      .from("plan_snapshots")
      .select("inputs")
      .eq("id", snapshots[0].id)
      .maybeSingle();
    if (inputsError) throw new Error("Could not load the latest room geometry.");
    snapshots[0] = { ...snapshots[0], inputs: latestInputs?.inputs || null };
  }
  return { ...data, latestSnapshot: snapshots[0] || null, snapshots };
});
