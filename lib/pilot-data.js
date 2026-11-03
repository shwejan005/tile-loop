import { calculatePlan, minimumTilesByArea } from "./planner.js";

export const PILOT_STORAGE_KEY = "tileloop-pilot-v3";
export const LEGACY_PILOT_STORAGE_KEY = "tileloop-pilot-v2";
export const PILOT_BACKUP_SCHEMA = "tileloop-pilot-backup/v1";
export const MAX_PILOT_ENTRIES = 5;

function parseDimensions(value) {
  return (String(value || "").match(/[\d.]+/g) || []).map(Number);
}

function validTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? value
    : new Date().toISOString();
}

/** Convert persisted or imported data to a trusted, recalculated comparison. */
export function normalizePilotEntry(entry, { legacy = false, allowInvalidEstimate = false } = {}) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;

  const id = typeof entry.id === "string" ? entry.id.trim() : "";
  const roomPair = parseDimensions(entry.room);
  const tilePair = parseDimensions(entry.tile);
  if (entry.orientation != null && !["standard", "rotated"].includes(entry.orientation)) return null;
  const orientation = entry.orientation === "rotated" ? "rotated" : "standard";
  let tileWidth = Number(entry.tileWidth ?? tilePair[0]);
  let tileLength = Number(entry.tileLength ?? tilePair[1]);

  // v2 stored the already-rotated dimensions, then stored "rotated" too.
  // Undo that historical double-rotation before recalculating the saved plan.
  const isLegacyRotation = (legacy || Number(entry.storageVersion || 2) < 3) && orientation === "rotated";
  if (isLegacyRotation) [tileWidth, tileLength] = [tileLength, tileWidth];

  const form = {
    planId: id,
    roomWidth: Number(entry.roomWidth ?? roomPair[0]),
    roomLength: Number(entry.roomLength ?? roomPair[1]),
    tileWidth,
    tileLength,
    grout: Number(entry.grout),
    kerf: Number(entry.kerf ?? 0),
    orientation,
    reserve: Number(entry.reserve),
  };
  const plan = calculatePlan(form);
  if (plan.error) return null;

  const usual = Number(entry.usual);
  const minimumByArea = minimumTilesByArea(plan);
  if (!Number.isInteger(usual) || usual < 1 || usual > 100000) return null;
  if (!allowInvalidEstimate && usual < minimumByArea) return null;

  return {
    storageVersion: 3,
    id: plan.planId,
    room: `${plan.roomWidth} × ${plan.roomLength} mm`,
    tile: `${form.tileWidth} × ${form.tileLength} mm`,
    roomWidth: plan.roomWidth,
    roomLength: plan.roomLength,
    tileWidth: form.tileWidth,
    tileLength: form.tileLength,
    orientation,
    grout: plan.grout,
    kerf: plan.kerf,
    base: plan.stockTiles,
    order: plan.orderQuantity,
    usual,
    delta: usual - plan.orderQuantity,
    minimumByArea,
    reserve: plan.reserve,
    createdAt: validTimestamp(entry.createdAt),
    isDemo: entry.isDemo === true,
  };
}

export function createPilotBackup(entries, exportedAt = new Date().toISOString()) {
  return {
    schema: PILOT_BACKUP_SCHEMA,
    exportedAt,
    entries: entries.map((entry) => {
      const normalized = normalizePilotEntry(entry, { allowInvalidEstimate: true });
      if (!normalized) throw new Error(`Could not include room ${entry?.id || "(unknown)"} in the backup.`);
      return normalized;
    }),
  };
}

export function parsePilotBackup(contents) {
  let backup;
  try {
    backup = JSON.parse(contents);
  } catch {
    throw new Error("This file is not valid JSON.");
  }

  if (backup?.schema !== PILOT_BACKUP_SCHEMA) {
    throw new Error("This is not a TileLoop pilot backup.");
  }
  if (!Array.isArray(backup.entries) || backup.entries.length > MAX_PILOT_ENTRIES) {
    throw new Error(`A backup must contain no more than ${MAX_PILOT_ENTRIES} room plans.`);
  }

  const normalized = backup.entries.map((entry, index) => {
    if (entry?.storageVersion !== 3) throw new Error(`Room ${index + 1} is not a supported backup record.`);
    const result = normalizePilotEntry(entry, { allowInvalidEstimate: true });
    if (!result) throw new Error(`Room ${index + 1} has invalid plan or estimate data.`);
    return result;
  });
  const ids = normalized.map((entry) => entry.id.toLocaleLowerCase());
  if (new Set(ids).size !== ids.length) throw new Error("The backup contains duplicate room IDs.");
  return normalized;
}

function csvCell(value) {
  let text = String(value ?? "");
  if (typeof value === "string" && /^[\u0000-\u0020]*[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function pilotLogToCsv(entries) {
  const headers = [
    "record_type", "plan_id", "room_width_mm", "room_length_mm", "tile_width_mm", "tile_length_mm",
    "orientation", "grout_mm", "kerf_mm", "cut_plan_tiles", "order_buffer_percent", "tileloop_order_tiles",
    "installer_estimate_tiles", "area_only_minimum_tiles", "difference_usual_minus_tileloop", "logged_at",
  ];
  const rows = entries.map((entry) => [
    entry.isDemo ? "illustrative_demo" : "pilot_comparison",
    entry.id,
    entry.roomWidth,
    entry.roomLength,
    entry.tileWidth,
    entry.tileLength,
    entry.orientation,
    entry.grout,
    entry.kerf,
    entry.base,
    entry.reserve,
    entry.order,
    entry.usual,
    entry.minimumByArea,
    entry.delta,
    entry.createdAt,
  ]);
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}
