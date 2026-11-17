import assert from "node:assert/strict";
import test from "node:test";
import { buildPrintableCutListHtml, cutListToCsv } from "../lib/cut-list-export.js";
import { calculatePlan, DEFAULT_FORM } from "../lib/planner.js";

test("cut-list CSV exports each positioned piece, its source stock tile, and cut dimensions", () => {
  const plan = calculatePlan({
    ...DEFAULT_FORM,
    planId: "CSV-01",
    roomWidth: 1600,
    roomLength: 1300,
    tileWidth: 600,
    tileLength: 600,
    grout: 3,
    reserve: 0,
  });
  const csv = cutListToCsv(plan);
  const rows = csv.trimEnd().split("\r\n");

  assert.match(rows[0], /piece_id.*source_stock_tile_id.*piece_width_mm.*position_x_mm.*piece_type/);
  assert.equal(rows.length, plan.pieces.length + 1);
  assert.ok(rows.slice(1).every((row) => /"STOCK-\d{4}"/.test(row)));
  assert.ok(rows.some((row) => row.includes('"cut"')));
  assert.ok(rows.some((row) => row.includes('"full"')));
  assert.ok(rows[0].includes('"room_width_mm"'));
  assert.ok(rows[0].includes('"order_quantity_tiles"'));
  assert.ok(rows.slice(1).every((row) => row.includes("prior-job offcut reuse not modeled")));
});

test("cut-list CSV quotes cells and neutralizes spreadsheet formulas", () => {
  const plan = calculatePlan({
    ...DEFAULT_FORM,
    planId: '=CMD("calc")',
    roomWidth: 600,
    roomLength: 600,
    tileWidth: 600,
    tileLength: 600,
    grout: 3,
    reserve: 0,
  });
  const csv = cutListToCsv(plan);

  assert.match(csv, /"'=CMD\(""calc""\)"/);
  assert.match(csv, /"STOCK-0001"/);
});

test("cut-list export rejects invalid plans", () => {
  assert.throws(() => cutListToCsv({ error: "invalid" }), /calculated tile plan/);
});

test("printable cut schedule includes plan metadata, numbered drawing, and positioned pieces", () => {
  const plan = calculatePlan({ ...DEFAULT_FORM, planId: "PRINT-01", roomWidth: 1600, roomLength: 1300, reserve: 5 });
  const html = buildPrintableCutListHtml(plan);

  assert.match(html, /<title>TileLoop cut list · PRINT-01<\/title>/);
  assert.match(html, /1600 × 1300 mm/);
  assert.match(html, /class="plan"[^>]*aria-label="Numbered tile layout"/);
  assert.match(html, /<th>Source tile<\/th>/);
  assert.match(html, /Prior-job offcut reuse not modeled/);
  assert.equal((html.match(/<tr>/g) || []).length, plan.pieces.length + 1);
});

test("printable cut schedule escapes user-controlled plan labels", () => {
  const plan = calculatePlan({ ...DEFAULT_FORM, planId: "<x>", roomWidth: 600, roomLength: 600 });
  const html = buildPrintableCutListHtml(plan);

  assert.doesNotMatch(html, /<title>[^<]*<x>/);
  assert.match(html, /&lt;x&gt;/);
});
