import assert from "node:assert/strict";
import test from "node:test";
import { parseAccountBackup } from "../lib/account-backup.js";

const baseSnapshot = {
  algorithm_version: "tileloop-plan-3",
  input_hash: "a".repeat(64),
  inputs: { layout: { pattern: "straight", alignment: "centered" } },
  result_summary: { stockTiles: 4 },
  minimum_tiles_by_area: 3,
  installer_comparisons: { installer_estimate_tiles: 5, note: null },
  installation_outcomes: [{ actual_tiles_used: 5, breakage_tiles: 1 }],
};

function backup(snapshot = baseSnapshot) {
  return {
    schema: "tileloop-account-export/v1",
    exportedAt: "2026-11-16T00:00:00.000Z",
    projects: [{
      id: "ignored-old-id",
      name: "Bathroom",
      room_plans: [{
        id: "ignored-old-plan-id",
        label: "Floor",
        room_width_mm: 3000,
        room_length_mm: 2400,
        tile_width_mm: 600,
        tile_length_mm: 600,
        grout_mm: 3,
        kerf_mm: 3,
        orientation: "standard",
        reserve_pct: 10,
        plan_snapshots: [snapshot],
      }],
    }],
  };
}

test("account backup parser normalizes relations and defaults legacy outcomes safely", () => {
  const parsed = parseAccountBackup(JSON.stringify(backup()));
  const [snapshot] = parsed.projects[0].room_plans[0].plan_snapshots;

  assert.deepEqual(snapshot.installer_comparisons, [{
    installer_estimate_tiles: 5,
    note: null,
  }]);
  assert.equal(snapshot.installation_outcomes[0].consumption_basis, "legacy-unknown");
  assert.equal(snapshot.installation_outcomes[0].breakage_tiles, 1);
});

test("account backup parser preserves the explicit consumption definition", () => {
  const source = structuredClone(baseSnapshot);
  source.installation_outcomes = [{
    actual_tiles_used: 5,
    breakage_tiles: 1,
    consumption_basis: "consumed-including-breakage-v1",
  }];
  const parsed = parseAccountBackup(JSON.stringify(backup(source)));

  assert.equal(parsed.projects[0].room_plans[0].plan_snapshots[0].installation_outcomes[0].consumption_basis, "consumed-including-breakage-v1");
});

test("account backups preserve structured field materials and installer cohort labels", () => {
  const source = structuredClone(baseSnapshot);
  source.installation_outcomes = [{
    actual_tiles_used: 7,
    actual_tiles_installed: 6,
    breakage_tiles: 1,
    installer_label: "Crew A",
    reusable_offcuts: [{ widthMm: 300, lengthMm: 150, quantity: 2 }],
    discarded_offcuts: [{ widthMm: 80, lengthMm: 70, quantity: 1 }],
    consumption_basis: "consumed-including-breakage-v1",
  }];
  const outcome = parseAccountBackup(JSON.stringify(backup(source))).projects[0].room_plans[0].plan_snapshots[0].installation_outcomes[0];
  assert.equal(outcome.installer_label, "Crew A");
  assert.equal(outcome.actual_tiles_installed, 6);
  assert.deepEqual(outcome.reusable_offcuts, [{ widthMm: 300, lengthMm: 150, quantity: 2 }]);
  assert.deepEqual(outcome.discarded_offcuts, [{ widthMm: 80, lengthMm: 70, quantity: 1 }]);
});

test("account backup parser rejects invalid hashes, incompatible schemas, and impossible outcomes", () => {
  assert.throws(() => parseAccountBackup("not json"), /valid JSON/);
  assert.throws(() => parseAccountBackup(JSON.stringify({ schema: "other", projects: [] })), /TileLoop account backup/);
  assert.throws(() => parseAccountBackup(JSON.stringify(backup({ ...baseSnapshot, input_hash: "nope" }))), /64/);

  const invalidOutcome = structuredClone(baseSnapshot);
  invalidOutcome.installation_outcomes = [{ actual_tiles_used: 5, breakage_tiles: 6 }];
  assert.throws(() => parseAccountBackup(JSON.stringify(backup(invalidOutcome))), /breakage greater/);
  const invalidInstalled = structuredClone(baseSnapshot);
  invalidInstalled.installation_outcomes = [{ actual_tiles_used: 5, actual_tiles_installed: 5, breakage_tiles: 1 }];
  assert.throws(() => parseAccountBackup(JSON.stringify(backup(invalidInstalled))), /installed plus broken/);
});
