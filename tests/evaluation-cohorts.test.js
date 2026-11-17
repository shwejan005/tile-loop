import assert from "node:assert/strict";
import test from "node:test";
import { classifyRoomShape, classifyRoomSize, formatTileCohort } from "../lib/evaluation-cohorts.js";

test("room cohorts distinguish rectangles, L shapes, and excluded room features", () => {
  const rectangle = { zones: [{ boundary: [[0, 0], [4000, 0], [4000, 3000], [0, 3000], [0, 0]], obstacles: [], openings: [] }] };
  const lShape = { zones: [{ boundary: [[0, 0], [4000, 0], [4000, 1000], [1000, 1000], [1000, 4000], [0, 4000], [0, 0]], obstacles: [], openings: [] }] };
  const withColumn = structuredClone(rectangle);
  withColumn.zones[0].obstacles.push({ boundary: [[100, 100], [300, 100], [300, 300], [100, 300]] });
  assert.equal(classifyRoomShape(rectangle), "Rectangle");
  assert.equal(classifyRoomShape(lShape), "L-shaped");
  assert.equal(classifyRoomShape(withColumn), "Room with obstacles or openings");
});

test("project-size and tile-format cohort labels are deterministic", () => {
  assert.equal(classifyRoomSize(9_000_000), "Under 10 m²");
  assert.equal(classifyRoomSize(10_000_000), "10–30 m²");
  assert.equal(classifyRoomSize(30_000_000), "30 m² and over");
  assert.equal(formatTileCohort(1200, 600), "600 × 1200 mm");
});
