import { getAuthContext } from "../../../lib/supabase/server.js";
import { parseAccountBackup } from "../../../lib/account-backup.js";

const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

export async function GET() {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") {
    return Response.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const { data, error } = await auth.supabase
    .from("projects")
    .select(`
      id, name, created_at, updated_at,
      room_plans (
        id, catalog_item_id, label, room_width_mm, room_length_mm, tile_width_mm, tile_length_mm,
        grout_mm, kerf_mm, orientation, reserve_pct, created_at, updated_at,
        plan_snapshots (
          id, algorithm_version, input_hash, inputs, result_summary,
          minimum_tiles_by_area, created_at,
           installer_comparisons (id, installer_estimate_tiles, note, created_at),
           installation_outcomes (id, actual_tiles_used, actual_tiles_installed, reusable_offcuts, discarded_offcuts, installer_label, consumption_basis, breakage_tiles, labor_minutes, practicality_rating, note, completed_at, created_at, updated_at)
        )
      )
    `)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Account export failed:", error.code || "unknown");
    return Response.json({ error: "Could not export account data." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }

  const backup = {
    schema: "tileloop-account-export/v1",
    exportedAt: new Date().toISOString(),
    projects: data || [],
  };
  return new Response(`${JSON.stringify(backup, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="tileloop-account-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function readRequestText(request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BACKUP_BYTES) throw new Error("Backup must be smaller than 20 MB.");
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BACKUP_BYTES) {
      await reader.cancel();
      throw new Error("Backup must be smaller than 20 MB.");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function insertRestoredProject(supabase, project) {
  const created = await supabase.from("projects").insert({
    name: project.name,
    ...(project.created_at ? { created_at: project.created_at } : {}),
  }).select("id").single();
  if (created.error) throw created.error;
  const projectId = created.data.id;
  const stats = { roomPlans: 0, snapshots: 0, comparisons: 0, outcomes: 0 };
  try {
    for (const plan of project.room_plans) {
      let catalogItemId = null;
      if (plan.catalog_item_id) {
        const { data: catalogItem } = await supabase.from("catalog_items")
          .select("id")
          .eq("id", plan.catalog_item_id)
          .eq("catalog_status", "published")
          .maybeSingle();
        catalogItemId = catalogItem?.id || null;
      }
      const roomPlan = await supabase.from("room_plans").insert({
        project_id: projectId,
        catalog_item_id: catalogItemId,
        label: plan.label,
        room_width_mm: plan.room_width_mm,
        room_length_mm: plan.room_length_mm,
        tile_width_mm: plan.tile_width_mm,
        tile_length_mm: plan.tile_length_mm,
        grout_mm: plan.grout_mm,
        kerf_mm: plan.kerf_mm,
        orientation: plan.orientation,
        reserve_pct: plan.reserve_pct,
        ...(plan.created_at ? { created_at: plan.created_at } : {}),
      }).select("id").single();
      if (roomPlan.error) throw roomPlan.error;
      stats.roomPlans += 1;

      for (const snapshot of plan.plan_snapshots) {
        const savedSnapshot = await supabase.from("plan_snapshots").insert({
          room_plan_id: roomPlan.data.id,
          algorithm_version: snapshot.algorithm_version,
          input_hash: snapshot.input_hash,
          inputs: snapshot.inputs,
          result_summary: snapshot.result_summary,
          minimum_tiles_by_area: snapshot.minimum_tiles_by_area,
          ...(snapshot.created_at ? { created_at: snapshot.created_at } : {}),
        }).select("id").single();
        if (savedSnapshot.error) throw savedSnapshot.error;
        stats.snapshots += 1;

        for (const comparison of snapshot.installer_comparisons) {
          const inserted = await supabase.from("installer_comparisons").insert({
            plan_snapshot_id: savedSnapshot.data.id,
            installer_estimate_tiles: comparison.installer_estimate_tiles,
            note: comparison.note ?? null,
            ...(comparison.created_at ? { created_at: comparison.created_at } : {}),
          });
          if (inserted.error) throw inserted.error;
          stats.comparisons += 1;
        }
        for (const outcome of snapshot.installation_outcomes) {
          const inserted = await supabase.from("installation_outcomes").insert({
            plan_snapshot_id: savedSnapshot.data.id,
            actual_tiles_used: outcome.actual_tiles_used,
            actual_tiles_installed: outcome.actual_tiles_installed ?? null,
            reusable_offcuts: outcome.reusable_offcuts || [],
            discarded_offcuts: outcome.discarded_offcuts || [],
            installer_label: outcome.installer_label ?? null,
            consumption_basis: outcome.consumption_basis,
            breakage_tiles: outcome.breakage_tiles ?? null,
            labor_minutes: outcome.labor_minutes ?? null,
            practicality_rating: outcome.practicality_rating ?? null,
            note: outcome.note ?? null,
            ...(outcome.completed_at ? { completed_at: outcome.completed_at } : {}),
            ...(outcome.created_at ? { created_at: outcome.created_at } : {}),
            ...(outcome.updated_at ? { updated_at: outcome.updated_at } : {}),
          });
          if (inserted.error) throw inserted.error;
          stats.outcomes += 1;
        }
      }
    }
    return { id: projectId, stats };
  } catch (error) {
    await supabase.from("projects").delete().eq("id", projectId);
    throw error;
  }
}

export async function POST(request) {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") {
    return Response.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return Response.json({ error: "Send a TileLoop JSON account backup." }, { status: 415, headers: { "Cache-Control": "no-store" } });
  }

  let backup;
  try {
    backup = parseAccountBackup(await readRequestText(request));
  } catch (error) {
    const status = /smaller than 20 MB/.test(error.message) ? 413 : 400;
    return Response.json({ error: error.message }, { status, headers: { "Cache-Control": "no-store" } });
  }

  const createdProjectIds = [];
  const imported = [];
  try {
    for (const project of backup.projects) {
      const result = await insertRestoredProject(auth.supabase, project);
      createdProjectIds.push(result.id);
      imported.push(result);
    }
  } catch (error) {
    if (createdProjectIds.length) {
      await auth.supabase.from("projects").delete().in("id", createdProjectIds);
    }
    console.error("Account restore failed:", error.code || "unknown");
    return Response.json({ error: "Restore failed. TileLoop removed the projects created by this import; check that database migrations are applied, then retry." }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json({
    restoredProjects: imported.length,
    restoredRoomPlans: imported.reduce((sum, project) => sum + project.stats.roomPlans, 0),
    restoredSnapshots: imported.reduce((sum, project) => sum + project.stats.snapshots, 0),
    restoredComparisons: imported.reduce((sum, project) => sum + project.stats.comparisons, 0),
    restoredOutcomes: imported.reduce((sum, project) => sum + project.stats.outcomes, 0),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
