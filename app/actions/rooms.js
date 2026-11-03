"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ALGORITHM_VERSION, calculatePlan, minimumTilesByArea } from "../../lib/planner.js";
import { createRectangularRoomGeometry, validateRoomGeometry } from "../../lib/geometry/room.js";
import { parsePilotBackup } from "../../lib/pilot-data.js";
import { getAuthContext } from "../../lib/supabase/server.js";

const uuidSchema = z.string().uuid();
const inputSchema = z.object({
  planId: z.string().trim().min(1).max(24),
  roomWidth: z.coerce.number().finite(),
  roomLength: z.coerce.number().finite(),
  tileWidth: z.coerce.number().finite(),
  tileLength: z.coerce.number().finite(),
  grout: z.coerce.number().finite(),
  kerf: z.coerce.number().finite(),
  orientation: z.enum(["standard", "rotated"]),
  pattern: z.enum(["straight", "half-offset", "diagonal", "herringbone"]).default("straight"),
  tilesPerCarton: z.union([z.literal(""), z.coerce.number().int().min(1).max(1000)]).default(""),
  roomGeometry: z.unknown().nullable().optional(),
  reserve: z.coerce.number().finite(),
}).strict();

const saveSchema = z.object({
  projectId: uuidSchema,
  roomPlanId: uuidSchema.nullable(),
  catalogItemId: uuidSchema.nullable(),
  form: inputSchema,
  installerEstimate: z.union([z.literal(""), z.coerce.number().int().min(1).max(100000)]),
  installerNote: z.string().trim().max(1000),
});

const optionalPositiveInteger = (maximum) => z.union([
  z.literal(""),
  z.coerce.number().int().min(1).max(maximum),
]).default("");

const outcomeSchema = z.object({
  projectId: uuidSchema,
  roomPlanId: uuidSchema,
  actualTilesUsed: z.coerce.number().int().min(1).max(100000),
  breakageTiles: z.union([z.literal(""), z.coerce.number().int().min(0).max(100000)]).default(""),
  laborMinutes: optionalPositiveInteger(100000),
  practicalityRating: z.union([z.literal(""), z.coerce.number().int().min(1).max(5)]).default(""),
  note: z.string().trim().max(1000).default(""),
}).strict();

function buildResultSummary(plan) {
  return {
    roomAreaMm2: plan.roomAreaMm2,
    pattern: plan.pattern,
    patternStrategyVersion: plan.patternStrategyVersion,
    layoutWarnings: plan.layoutWarnings || [],
    stockTiles: plan.stockTiles,
    orderQuantity: plan.orderQuantity,
    cartonsToOrder: plan.cartonsToOrder,
    tilesToOrder: plan.tilesToOrder,
    fullCount: plan.fullCount,
    cutPieceCount: plan.cutPieces.length,
    totalPieceCount: plan.pieces.length,
    cutEdges: plan.cutEdges,
    remnantCount: plan.remnantCount,
    remnantArea: plan.remnantArea,
    remnants: plan.remnants.map((entry) => ({
      id: entry.id || null,
      w: entry.w,
      h: entry.h,
      qty: entry.qty,
      areaMm2: entry.areaMm2 ?? entry.area,
      shape: entry.shape || "rectangle",
      geometry: entry.geometry || null,
      reuseCandidates: entry.reuseCandidates || [],
    })),
    pieces: plan.pieces.map((piece) => ({
      id: piece.id || `P-${String(piece.number).padStart(4, "0")}`,
      sourceCellId: piece.sourceCellId || null,
      stockTile: piece.stockTile,
      x: piece.x,
      y: piece.y,
      w: piece.w,
      h: piece.h,
      areaMm2: piece.areaMm2 ?? piece.w * piece.h,
      full: piece.full,
      shape: piece.shape || "rectangle",
      location: piece.location,
      geometry: piece.geometry || null,
    })),
    schedule: plan.schedule.map((entry) => ({
      w: entry.w,
      h: entry.h,
      shape: entry.shape || "rectangle",
      full: entry.full,
      qty: entry.qty,
      locations: [...entry.locations],
      pieceIds: entry.pieceIds || [],
    })),
  };
}

async function persistRoomPlan(auth, { projectId, roomPlanId, catalogItemId = null, catalogItem = null, form, installerEstimate, installerNote, sourceNote = "" }) {
  const plan = calculatePlan(form);
  if (plan.error) return { error: plan.error };

  const minimum = minimumTilesByArea(plan);
  if (installerEstimate !== "" && installerEstimate < minimum) {
    return { error: `Installer estimate must be at least the ${minimum}-tile floor-area minimum.` };
  }

  const resultSummary = buildResultSummary(plan);
  const roomGeometry = form.roomGeometry || plan.roomGeometry || createRectangularRoomGeometry(plan.roomWidth, plan.roomLength);
  const geometryError = validateRoomGeometry(roomGeometry);
  if (geometryError) return { error: geometryError };
  const snapshotInput = {
    label: plan.planId,
    roomWidthMm: plan.roomWidth,
    roomLengthMm: plan.roomLength,
    roomGeometry,
    layout: {
      pattern: plan.pattern,
      strategyVersion: plan.patternStrategyVersion,
      alignment: "centered",
      orientation: form.orientation,
    },
    tileWidthMm: Number(form.tileWidth),
    tileLengthMm: Number(form.tileLength),
    effectiveTileWidthMm: plan.tileWidth,
    effectiveTileLengthMm: plan.tileLength,
    groutMm: plan.grout,
    kerfMm: plan.kerf,
    tilesPerCarton: plan.tilesPerCarton,
    cartonsToOrder: plan.cartonsToOrder,
    tilesToOrder: plan.tilesToOrder,
    orientation: form.orientation,
    reservePercent: plan.reserve,
    catalogItem: catalogItem ? {
      id: catalogItem.id,
      supplierKey: catalogItem.supplier_key,
      marketCode: catalogItem.market_code,
      brand: catalogItem.brand,
      supplierCode: catalogItem.supplier_code,
      productName: catalogItem.product_name,
      collectionName: catalogItem.collection_name,
      color: catalogItem.color,
      formatLabel: catalogItem.format_label,
      widthMm: Number(catalogItem.width_mm),
      heightMm: Number(catalogItem.height_mm),
      thicknessMm: catalogItem.thickness_mm == null ? null : Number(catalogItem.thickness_mm),
      qualityFlags: catalogItem.quality_flags,
      sourcePage: catalogItem.source_page_url,
      tilesPerCarton: catalogItem.tiles_per_carton == null ? null : Number(catalogItem.tiles_per_carton),
      priceAmount: catalogItem.price_amount == null ? null : Number(catalogItem.price_amount),
      priceCurrency: catalogItem.price_currency,
      priceUnit: catalogItem.price_unit,
      stockQuantity: catalogItem.stock_quantity == null ? null : Number(catalogItem.stock_quantity),
      stockUnit: catalogItem.stock_unit,
      stockUpdatedAt: catalogItem.stock_updated_at,
      orderingStatus: catalogItem.ordering_status,
      factsSourceReference: catalogItem.facts_source_reference,
      factsVerifiedAt: catalogItem.facts_verified_at,
    } : null,
    ...(sourceNote ? { sourceNote } : {}),
  };
  const inputHash = createHash("sha256")
    .update(JSON.stringify({ algorithmVersion: ALGORITHM_VERSION, inputs: snapshotInput, resultSummary }))
    .digest("hex");

  const { data, error } = await auth.supabase.rpc("save_room_plan_with_snapshot", {
    p_project_id: projectId,
    p_room_plan_id: roomPlanId,
    p_catalog_item_id: catalogItemId,
    p_label: plan.planId,
    p_room_width_mm: plan.roomWidth,
    p_room_length_mm: plan.roomLength,
    p_tile_width_mm: Number(form.tileWidth),
    p_tile_length_mm: Number(form.tileLength),
    p_grout_mm: plan.grout,
    p_kerf_mm: plan.kerf,
    p_orientation: form.orientation,
    p_reserve_pct: plan.reserve,
    p_algorithm_version: ALGORITHM_VERSION,
    p_input_hash: inputHash,
    p_inputs: snapshotInput,
    p_result_summary: resultSummary,
    p_minimum_tiles_by_area: minimum,
    p_installer_estimate_tiles: installerEstimate === "" ? null : installerEstimate,
    p_installer_note: installerNote || null,
  });

  if (error || !data?.[0]?.room_plan_id) {
    if (error?.code === "23505") return { error: "That room ID already exists in this project. Use another ID or open the existing plan." };
    console.error("Room plan save failed:", error?.code || "unknown");
    return { error: "Could not save the plan. Confirm the project is available and try again." };
  }

  return { roomPlanId: data[0].room_plan_id };
}

export async function saveRoomPlanAction(untrustedInput) {
  const auth = await getAuthContext();
  if (auth.status === "unconfigured") return { error: "Account storage is not configured." };
  if (auth.status !== "authenticated") return { error: "Your session expired. Sign in again to save this plan." };

  const parsed = saveSchema.safeParse(untrustedInput);
  if (!parsed.success) return { error: "Check the room, tile, and order inputs before saving." };
  const { catalogItemId, form, ...saveInput } = parsed.data;
  let catalogItem = null;
  let validatedForm = form;
  if (catalogItemId) {
    const { data, error } = await auth.supabase
      .from("catalog_items")
      .select("id, supplier_key, market_code, supplier_code, brand, product_name, collection_name, color, format_label, width_mm, height_mm, thickness_mm, quality_flags, source_page_url, catalog_status, tiles_per_carton, price_amount, price_currency, price_unit, stock_quantity, stock_unit, stock_updated_at, ordering_status, facts_source_reference, facts_verified_at")
      .eq("id", catalogItemId)
      .eq("catalog_status", "published")
      .maybeSingle();
    if (error || !data) return { error: "That catalog format is not currently published. Choose another format or enter a custom size." };
    catalogItem = data;
    // Catalog dimensions are authoritative for a selected SKU; never trust the
    // browser's copied width/length values.
      validatedForm = {
        ...form,
        tileWidth: Number(data.width_mm),
        tileLength: Number(data.height_mm),
        tilesPerCarton: data.tiles_per_carton == null ? form.tilesPerCarton : String(data.tiles_per_carton),
      };
  }

  const result = await persistRoomPlan(auth, { ...saveInput, catalogItemId, catalogItem, form: validatedForm });
  if (result.error) return result;

  revalidatePath("/dashboard");
  revalidatePath(`/projects/${parsed.data.projectId}`);
  revalidatePath(`/projects/${parsed.data.projectId}/rooms/${result.roomPlanId}`);
  return { roomPlanId: result.roomPlanId, success: "Plan and calculation snapshot saved." };
}

export async function saveInstallationOutcomeAction(untrustedInput) {
  const auth = await getAuthContext();
  if (auth.status === "unconfigured") return { error: "Account storage is not configured." };
  if (auth.status !== "authenticated") return { error: "Your session expired. Sign in again to record an outcome." };

  const parsed = outcomeSchema.safeParse(untrustedInput);
  if (!parsed.success) return { error: "Enter a valid actual tile count and check the optional outcome fields." };
  const { projectId, roomPlanId, actualTilesUsed, breakageTiles, laborMinutes, practicalityRating, note } = parsed.data;
  if (breakageTiles !== "" && breakageTiles > actualTilesUsed) {
    return { error: "Breakage cannot exceed the total tiles used." };
  }

  const { data: roomPlan, error: roomPlanError } = await auth.supabase
    .from("room_plans")
    .select("id")
    .eq("id", roomPlanId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (roomPlanError || !roomPlan) return { error: "That room plan is not available in this project." };

  const { data: snapshot, error: snapshotError } = await auth.supabase
    .from("plan_snapshots")
    .select("id")
    .eq("room_plan_id", roomPlanId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (snapshotError || !snapshot) return { error: "Save a room calculation before recording its installation outcome." };

  const { error } = await auth.supabase
    .from("installation_outcomes")
    .upsert({
      plan_snapshot_id: snapshot.id,
      actual_tiles_used: actualTilesUsed,
      breakage_tiles: breakageTiles === "" ? null : breakageTiles,
      labor_minutes: laborMinutes === "" ? null : laborMinutes,
      practicality_rating: practicalityRating === "" ? null : practicalityRating,
      note: note || null,
      completed_at: new Date().toISOString(),
    }, { onConflict: "plan_snapshot_id" });
  if (error) {
    console.error("Installation outcome save failed:", error.code || "unknown");
    return { error: "Could not save the installation outcome. Try again." };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/rooms/${roomPlanId}`);
  return { success: "Actual installation outcome saved against the latest calculation." };
}

export async function importLegacyPilotBackupAction(contents) {
  const auth = await getAuthContext();
  if (auth.status === "unconfigured") return { error: "Account storage is not configured." };
  if (auth.status !== "authenticated") return { error: "Sign in again before importing local data." };
  if (typeof contents !== "string" || contents.length > 1_000_000) return { error: "The backup must be smaller than 1 MB." };

  let entries;
  try {
    entries = parsePilotBackup(contents).filter((entry) => !entry.isDemo);
  } catch (error) {
    return { error: error.message || "This is not a valid TileLoop pilot backup." };
  }
  if (!entries.length) return { error: "No real room records were found. Illustrative demo rows are not imported as field data." };

  const projectName = `Imported room plans — ${new Date().toISOString().slice(0, 10)}`;
  const { data: project, error: projectError } = await auth.supabase
    .from("projects")
    .insert({ owner_id: auth.claims.sub, name: projectName })
    .select("id")
    .single();
  if (projectError || !project) return { error: "Could not create an import project." };

  try {
    for (const entry of entries) {
      const form = {
        planId: entry.id,
        roomWidth: entry.roomWidth,
        roomLength: entry.roomLength,
        tileWidth: entry.tileWidth,
        tileLength: entry.tileLength,
        grout: entry.grout,
        kerf: Number(entry.kerf ?? 0),
        orientation: entry.orientation,
        reserve: entry.reserve,
      };
      const plan = calculatePlan(form);
      if (plan.error) throw new Error(`Room ${entry.id} could not be recalculated.`);
      const minimum = minimumTilesByArea(plan);
      const estimateIsValid = Number.isInteger(entry.usual) && entry.usual >= minimum;
      const sourceNote = estimateIsValid
        ? "Imported from a previous browser-local TileLoop pilot log. Recalculated using the current algorithm."
        : `Legacy installer estimate: ${entry.usual} tiles. Below the current ${minimum}-tile area-only minimum; preserved here as a note and not treated as a valid comparison.`;
      const result = await persistRoomPlan(auth, {
        projectId: project.id,
        roomPlanId: null,
        catalogItemId: null,
        form,
        installerEstimate: estimateIsValid ? entry.usual : "",
        installerNote: estimateIsValid ? "Imported from a previous browser-local pilot log." : "",
        sourceNote,
      });
      if (result.error) throw new Error(`Room ${entry.id}: ${result.error}`);
    }
  } catch (error) {
    await auth.supabase.from("projects").delete().eq("id", project.id).eq("owner_id", auth.claims.sub);
    return { error: error.message || "Import failed. No partial project was kept; retry from your backup." };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/projects/${project.id}`);
  return { projectId: project.id, importedCount: entries.length };
}
