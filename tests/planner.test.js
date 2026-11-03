import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePlan,
  DEFAULT_FORM,
  formatNumber,
  minimumTilesByArea,
  validateForm,
} from "../lib/planner.js";
import { createRectangularRoomGeometry } from "../lib/geometry/room.js";
import {
  createPilotBackup,
  normalizePilotEntry,
  parsePilotBackup,
  pilotLogToCsv,
} from "../lib/pilot-data.js";
import { safeRedirectPath } from "../lib/supabase/config.js";

test("the published default plan is deterministic and keeps its estimate transparent", () => {
  const plan = calculatePlan(DEFAULT_FORM);
  assert.equal(plan.error, undefined);
  assert.equal(plan.stockTiles, 63);
  assert.equal(plan.orderQuantity, 70);
  assert.equal(plan.pieces.length, 63);
  assert.equal(plan.pattern, "straight");
  assert.equal(plan.patternStrategyVersion, "straight-grid-v1");
  assert.deepEqual(calculatePlan(DEFAULT_FORM), plan);
});

test("area-only comparison minimum uses floor area, not grout-excluded tile surface area", () => {
  const plan = calculatePlan({ ...DEFAULT_FORM, grout: 30 });
  const gridAreaMinimum = Math.ceil(
    plan.columns.reduce((sum, width) => sum + width, 0)
      * plan.rows.reduce((sum, length) => sum + length, 0)
      / (plan.tileWidth * plan.tileLength),
  );
  assert.equal(minimumTilesByArea(plan), 49);
  assert.ok(gridAreaMinimum < minimumTilesByArea(plan));
  assert.equal(minimumTilesByArea({ error: "invalid" }), null);
});

test("invalid dimensions, labels, and tile orientations are rejected", () => {
  assert.match(validateForm({ ...DEFAULT_FORM, roomWidth: 0 }), /Room width/);
  assert.match(validateForm({ ...DEFAULT_FORM, planId: "   " }), /anonymous plan label/);
  assert.match(validateForm({ ...DEFAULT_FORM, planId: "a".repeat(25) }), /24 characters/);
  assert.match(validateForm({ ...DEFAULT_FORM, orientation: "diagonal" }), /tile direction/);
  assert.match(validateForm({ ...DEFAULT_FORM, pattern: "herringbone" }), /not supported yet/);
  assert.match(validateForm({ ...DEFAULT_FORM, pattern: "__proto__" }), /known installation pattern/);
  assert.match(validateForm({ ...DEFAULT_FORM, grout: 0.001 }), /two decimal places/);
  assert.match(validateForm(null), /dimensions/);
  assert.match(calculatePlan({ ...DEFAULT_FORM, roomWidth: 50_000, roomLength: 50_000, tileWidth: 50, tileLength: 50 }).error, /more than 10,000 pieces/);
});

test("measurement formatting preserves hundredth-millimeter precision", () => {
  assert.equal(formatNumber(600), "600");
  assert.equal(formatNumber(600.5), "600.5");
  assert.equal(formatNumber(600.01), "600.01");
});

test("rotating rectangular stock changes the plan orientation without losing input dimensions", () => {
  const form = {
    ...DEFAULT_FORM,
    roomWidth: 3600,
    roomLength: 2800,
    tileWidth: 1200,
    tileLength: 600,
    orientation: "rotated",
  };
  const plan = calculatePlan(form);
  assert.equal(plan.tileWidth, 600);
  assert.equal(plan.tileLength, 1200);
  assert.ok(plan.pieces.every((piece) => piece.w <= plan.tileWidth && piece.h <= plan.tileLength));
});

test("polygon rooms produce numbered cut shapes, shape-aware offcuts, and multiple real layout patterns", () => {
  const lRoom = createRectangularRoomGeometry(4000, 4000);
  lRoom.zones[0].boundary = [[0, 0], [4000, 0], [4000, 1000], [1000, 1000], [1000, 4000], [0, 4000]];
  lRoom.zones[0].obstacles.push({ id: "column-1", boundary: [[200, 200], [400, 200], [400, 400], [200, 400]] });
  lRoom.zones[0].openings.push({ id: "drain-1", boundary: [[100, 1500], [300, 1500], [300, 1700], [100, 1700]] });
  lRoom.zones[0].accessPoints.push({ id: "door-1", kind: "doorway", segment: [[0, 500], [0, 800]] });

  const plan = calculatePlan({ ...DEFAULT_FORM, roomWidth: 4000, roomLength: 4000, reserve: 0, roomGeometry: lRoom });
  assert.equal(plan.error, undefined);
  assert.equal(plan.geometryMode, true);
  assert.equal(plan.roomAreaMm2, 6_920_000);
  assert.ok(plan.pieces.length > 0);
  assert.ok(plan.pieces.every((piece) => /^P-\d{4}$/.test(piece.id) && piece.geometry.length > 0));
  assert.ok(plan.pieces.some((piece) => piece.shape === "polygon"));
  assert.ok(plan.remnants.some((remnant) => remnant.geometry?.length));
  assert.ok(plan.remnants.some((remnant) => remnant.reuseCandidates));

  const rectangle = createRectangularRoomGeometry(3000, 2700);
  const straight = calculatePlan({ ...DEFAULT_FORM, roomWidth: 3000, roomLength: 2700, reserve: 0, roomGeometry: rectangle, pattern: "straight" });
  const offset = calculatePlan({ ...DEFAULT_FORM, roomWidth: 3000, roomLength: 2700, reserve: 0, roomGeometry: rectangle, pattern: "half-offset" });
  const diagonal = calculatePlan({ ...DEFAULT_FORM, roomWidth: 3000, roomLength: 2700, reserve: 0, roomGeometry: rectangle, pattern: "diagonal" });
  assert.equal(straight.error, undefined);
  assert.equal(offset.error, undefined);
  assert.equal(diagonal.error, undefined);
  assert.equal(offset.patternStrategyVersion, "half-offset-grid-v1");
  assert.equal(diagonal.patternStrategyVersion, "diagonal-grid-v1");
  assert.notDeepEqual(offset.pieces.map((piece) => [piece.x, piece.y]), straight.pieces.map((piece) => [piece.x, piece.y]));
  assert.ok(diagonal.pieces.some((piece) => piece.shape === "polygon"));
});

test("carton rounding is opt-in and remains separate from the tile estimate", () => {
  const tileEstimate = calculatePlan({ ...DEFAULT_FORM, reserve: 0 });
  const cartonEstimate = calculatePlan({ ...DEFAULT_FORM, reserve: 0, tilesPerCarton: 8 });
  assert.equal(cartonEstimate.orderQuantity, tileEstimate.orderQuantity);
  assert.equal(cartonEstimate.cartonsToOrder, Math.ceil(tileEstimate.orderQuantity / 8));
  assert.equal(cartonEstimate.tilesToOrder, cartonEstimate.cartonsToOrder * 8);
  assert.match(validateForm({ ...DEFAULT_FORM, tilesPerCarton: 0 }), /Tiles per carton/);
});

test("saw kerf is reserved in stock nesting and impossible cuts are rejected", () => {
  const form = {
    ...DEFAULT_FORM,
    roomWidth: 900,
    roomLength: 2407,
    tileWidth: 200,
    tileLength: 600,
    grout: 2,
    kerf: 0,
    reserve: 0,
  };
  const withoutKerf = calculatePlan(form);
  const withKerf = calculatePlan({ ...form, kerf: 3 });
  assert.equal(withoutKerf.stockTiles, 20);
  assert.equal(withKerf.stockTiles, 25);
  assert.match(calculatePlan({ ...form, roomWidth: 599, tileWidth: 600, kerf: 3 }).error, /insufficient stock/);
});

test("legacy rotated records recover their original stock dimensions", () => {
  const form = {
    ...DEFAULT_FORM,
    planId: "ROT-01",
    roomWidth: 3600,
    roomLength: 2800,
    tileWidth: 1200,
    tileLength: 600,
    orientation: "rotated",
  };
  const plan = calculatePlan(form);
  const migrated = normalizePilotEntry({
    id: form.planId,
    roomWidth: form.roomWidth,
    roomLength: form.roomLength,
    tileWidth: plan.tileWidth,
    tileLength: plan.tileLength,
    grout: form.grout,
    orientation: "rotated",
    reserve: form.reserve,
    usual: Math.max(minimumTilesByArea(plan), plan.orderQuantity),
  }, { legacy: true });

  assert.equal(migrated.tileWidth, 1200);
  assert.equal(migrated.tileLength, 600);
  assert.equal(migrated.orientation, "rotated");
  assert.equal(migrated.storageVersion, 3);
});

test("legacy comparisons below the corrected area minimum remain recoverable and flagged", () => {
  const plan = calculatePlan({ ...DEFAULT_FORM, planId: "OLD-01", grout: 30 });
  const oldEntry = {
    id: plan.planId,
    roomWidth: plan.roomWidth,
    roomLength: plan.roomLength,
    tileWidth: plan.tileWidth,
    tileLength: plan.tileLength,
    grout: plan.grout,
    orientation: "standard",
    reserve: plan.reserve,
    usual: minimumTilesByArea(plan) - 1,
  };

  assert.equal(normalizePilotEntry(oldEntry), null);
  const recoverable = normalizePilotEntry(oldEntry, { allowInvalidEstimate: true });
  assert.ok(recoverable.usual < recoverable.minimumByArea);
  assert.equal(parsePilotBackup(JSON.stringify(createPilotBackup([recoverable])))[0].usual, recoverable.usual);
});

test("pilot backups round-trip validated entries and recalculate derived values", () => {
  const plan = calculatePlan({ ...DEFAULT_FORM, planId: "BACKUP-01" });
  const entry = normalizePilotEntry({
    id: plan.planId,
    roomWidth: plan.roomWidth,
    roomLength: plan.roomLength,
    tileWidth: plan.tileWidth,
    tileLength: plan.tileLength,
    grout: plan.grout,
    orientation: "standard",
    reserve: plan.reserve,
    usual: Math.max(minimumTilesByArea(plan), plan.orderQuantity),
    createdAt: "2026-11-02T00:00:00.000Z",
  });
  const backup = createPilotBackup([entry], "2026-11-02T00:00:00.000Z");
  const restored = parsePilotBackup(JSON.stringify(backup));

  assert.equal(restored.length, 1);
  assert.equal(restored[0].id, "BACKUP-01");
  assert.equal(restored[0].base, plan.stockTiles);
  assert.equal(restored[0].order, plan.orderQuantity);
  assert.throws(() => parsePilotBackup(JSON.stringify({ schema: "wrong", entries: [] })), /not a TileLoop/);
});

test("CSV export quotes values and prevents spreadsheet formula execution", () => {
  const entry = {
    isDemo: false,
    id: '=HYPERLINK("https://example.invalid")',
    roomWidth: 1000,
    roomLength: 1000,
    tileWidth: 500,
    tileLength: 500,
    orientation: "standard",
    grout: 3,
    base: 4,
    reserve: 10,
    order: 5,
    usual: 5,
    minimumByArea: 4,
    delta: 0,
    createdAt: "2026-11-02T00:00:00.000Z",
  };
  const csv = pilotLogToCsv([entry]);
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example\.invalid""\)"/);
  assert.match(csv, /area_only_minimum_tiles/);
});

test("auth redirects remain on the TileLoop origin", () => {
  assert.equal(safeRedirectPath("/projects/123?tab=plans"), "/projects/123?tab=plans");
  assert.equal(safeRedirectPath("https://attacker.invalid"), "/dashboard");
  assert.equal(safeRedirectPath("//attacker.invalid"), "/dashboard");
  assert.equal(safeRedirectPath("/\\attacker.invalid"), "/dashboard");
});
