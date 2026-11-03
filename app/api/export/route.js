import { getAuthContext } from "../../../lib/supabase/server.js";

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
        id, label, room_width_mm, room_length_mm, tile_width_mm, tile_length_mm,
        grout_mm, kerf_mm, orientation, reserve_pct, created_at, updated_at,
        plan_snapshots (
          id, algorithm_version, input_hash, inputs, result_summary,
          minimum_tiles_by_area, created_at,
           installer_comparisons (id, installer_estimate_tiles, note, created_at),
           installation_outcomes (id, actual_tiles_used, breakage_tiles, labor_minutes, practicality_rating, note, completed_at, created_at, updated_at)
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
