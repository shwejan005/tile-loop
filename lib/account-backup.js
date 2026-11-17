import { z } from "zod";

const timestamp = z.string().datetime({ offset: true }).optional();
const nullableText = (max = 1000) => z.string().max(max).nullable().optional();
const objectRecord = z.record(z.string(), z.unknown());

function asList(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

const comparisonSchema = z.object({
  installer_estimate_tiles: z.number().int().min(1).max(100000),
  note: nullableText(),
  created_at: timestamp,
});

const outcomeSchema = z.object({
  installer_label: nullableText(80),
  actual_tiles_used: z.number().int().min(1).max(100000),
  actual_tiles_installed: z.number().int().min(0).max(100000).nullable().optional(),
  reusable_offcuts: z.array(z.object({ widthMm: z.number().min(1).max(3000), lengthMm: z.number().min(1).max(3000), quantity: z.number().int().min(1).max(100000) })).max(100).default([]),
  discarded_offcuts: z.array(z.object({ widthMm: z.number().min(1).max(3000), lengthMm: z.number().min(1).max(3000), quantity: z.number().int().min(1).max(100000) })).max(100).default([]),
  consumption_basis: z.enum(["legacy-unknown", "consumed-including-breakage-v1"]).default("legacy-unknown"),
  breakage_tiles: z.number().int().min(0).max(100000).nullable().optional(),
  labor_minutes: z.number().int().min(1).max(100000).nullable().optional(),
  practicality_rating: z.number().int().min(1).max(5).nullable().optional(),
  note: nullableText(),
  completed_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp,
});

const snapshotSchema = z.object({
  algorithm_version: z.string().min(1).max(40),
  input_hash: z.string().regex(/^[a-f0-9]{64}$/),
  inputs: objectRecord,
  result_summary: objectRecord,
  minimum_tiles_by_area: z.number().int().min(1),
  created_at: timestamp,
  installer_comparisons: z.union([z.array(comparisonSchema), comparisonSchema]).nullable().optional(),
  installation_outcomes: z.union([z.array(outcomeSchema), outcomeSchema]).nullable().optional(),
});

const roomPlanSchema = z.object({
  label: z.string().trim().min(1).max(24),
  room_width_mm: z.number().min(300).max(50000),
  room_length_mm: z.number().min(300).max(50000),
  tile_width_mm: z.number().min(50).max(3000),
  tile_length_mm: z.number().min(50).max(3000),
  grout_mm: z.number().min(0).max(30),
  kerf_mm: z.number().min(0).max(10),
  orientation: z.enum(["standard", "rotated"]),
  reserve_pct: z.number().min(0).max(20),
  catalog_item_id: z.string().uuid().nullable().optional(),
  created_at: timestamp,
  updated_at: timestamp,
  plan_snapshots: z.array(snapshotSchema).max(1000).default([]),
}).refine((plan) => plan.tile_width_mm > plan.grout_mm && plan.tile_length_mm > plan.grout_mm, {
  message: "Tile dimensions must be larger than grout spacing.",
});

const backupSchema = z.object({
  schema: z.literal("tileloop-account-export/v1"),
  exportedAt: timestamp,
  projects: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    created_at: timestamp,
    updated_at: timestamp,
    room_plans: z.array(roomPlanSchema).max(500),
  })).max(100),
});

export function parseAccountBackup(contents) {
  let value;
  try {
    value = JSON.parse(contents);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  const parsed = backupSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`This is not a valid TileLoop account backup: ${parsed.error.issues[0]?.message || "invalid data"}`);
  }

  const normalized = structuredClone(parsed.data);
  let roomPlanCount = 0;
  let snapshotCount = 0;
  for (const project of normalized.projects) {
    roomPlanCount += project.room_plans.length;
    for (const plan of project.room_plans) {
      plan.plan_snapshots = plan.plan_snapshots.map((snapshot) => {
        snapshot.installer_comparisons = asList(snapshot.installer_comparisons);
        snapshot.installation_outcomes = asList(snapshot.installation_outcomes);
        snapshotCount += 1;
        for (const outcome of snapshot.installation_outcomes) {
          if (outcome.breakage_tiles != null && outcome.breakage_tiles > outcome.actual_tiles_used) {
            throw new Error("A backup contains breakage greater than the total consumed tiles.");
          }
          if (outcome.actual_tiles_installed != null
            && outcome.actual_tiles_installed + (outcome.breakage_tiles || 0) > outcome.actual_tiles_used) {
            throw new Error("A backup contains installed plus broken tiles greater than the total consumed.");
          }
        }
        return snapshot;
      });
    }
  }
  if (roomPlanCount > 500 || snapshotCount > 2000) throw new Error("This backup exceeds TileLoop's import limits.");
  return normalized;
}
