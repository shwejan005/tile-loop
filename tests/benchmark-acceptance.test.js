import assert from "node:assert/strict";
import test from "node:test";
import polygonClipping from "polygon-clipping";
import { calculatePlan, DEFAULT_FORM } from "../lib/planner.js";
import { nestPieces } from "../lib/cutting/nesting.js";
import {
  createRectangularRoomGeometry,
  roomBoundaryArea,
  roomGeometryBounds,
} from "../lib/geometry/room.js";
import {
  multiPolygonArea,
  roomFootprint,
  subtractMultiPolygon,
} from "../lib/geometry/operations.js";

function room(boundary, { openings = [], obstacles = [], accessPoints = [] } = {}) {
  return {
    schema: "tileloop-room-geometry/v2",
    unit: "mm",
    zones: [{ id: "zone-1", boundary, openings, obstacles, accessPoints }],
  };
}

function rectangle(id, x, y, width, height) {
  return { id, boundary: [[x, y], [x + width, y], [x + width, y + height], [x, y + height]] };
}

const referenceRooms = [
  { name: "rectangle 1", geometry: room([[0, 0], [4000, 0], [4000, 3000], [0, 3000]]), gross: 12_000_000, usable: 12_000_000, bounds: [4000, 3000] },
  { name: "rectangle 2", geometry: room([[0, 0], [4500, 0], [4500, 3200], [0, 3200]]), gross: 14_400_000, usable: 14_400_000, bounds: [4500, 3200] },
  { name: "rectangle 3", geometry: room([[0, 0], [6100, 0], [6100, 2800], [0, 2800]]), gross: 17_080_000, usable: 17_080_000, bounds: [6100, 2800] },
  { name: "L shape 1", geometry: room([[0, 0], [4000, 0], [4000, 1000], [1000, 1000], [1000, 4000], [0, 4000]]), gross: 7_000_000, usable: 7_000_000, bounds: [4000, 4000] },
  { name: "L shape 2", geometry: room([[0, 0], [5000, 0], [5000, 1500], [3000, 1500], [3000, 3000], [0, 3000]]), gross: 12_000_000, usable: 12_000_000, bounds: [5000, 3000] },
  { name: "irregular trapezoid", geometry: room([[0, 0], [4000, 0], [3500, 3000], [500, 3000]]), gross: 10_500_000, usable: 10_500_000, bounds: [4000, 3000] },
  { name: "irregular chamfered room", geometry: room([[0, 0], [4000, 0], [4000, 2000], [2500, 3000], [0, 3000]]), gross: 11_250_000, usable: 11_250_000, bounds: [4000, 3000] },
  { name: "room with pillar", geometry: room([[0, 0], [4000, 0], [4000, 3000], [0, 3000]], { obstacles: [rectangle("pillar", 1000, 1000, 500, 500)] }), gross: 12_000_000, usable: 11_750_000, bounds: [4000, 3000] },
  { name: "room with floor opening", geometry: room([[0, 0], [5000, 0], [5000, 4000], [0, 4000]], { openings: [rectangle("opening", 2000, 1500, 1000, 1000)] }), gross: 20_000_000, usable: 19_000_000, bounds: [5000, 4000] },
  { name: "room with multiple obstacles", geometry: room([[0, 0], [6000, 0], [6000, 4000], [0, 4000]], {
    obstacles: [rectangle("pillar-a", 700, 700, 500, 500), rectangle("pillar-b", 4000, 2400, 600, 600)],
    openings: [rectangle("floor-opening", 2500, 1500, 800, 500)],
    accessPoints: [{ id: "doorway", kind: "doorway", segment: [[0, 500], [0, 1000]] }],
  }), gross: 24_000_000, usable: 22_990_000, bounds: [6000, 4000] },
];

test("the 10 reference geometries preserve millimeter bounds and match independent area totals within 0.5%", () => {
  const results = referenceRooms.map(({ name, geometry, gross, usable, bounds }) => {
    const measuredGross = roomBoundaryArea(geometry);
    const measuredUsable = multiPolygonArea(roomFootprint(geometry));
    const actualBounds = roomGeometryBounds(geometry);
    assert.ok(Math.abs(measuredGross - gross) / gross <= 0.005, `${name}: gross area`);
    assert.ok(Math.abs(measuredUsable - usable) / usable <= 0.005, `${name}: usable area`);
    assert.equal(actualBounds.widthMm, bounds[0], `${name}: width`);
    assert.equal(actualBounds.lengthMm, bounds[1], `${name}: length`);
    return { name, gross, measuredGross, usable, measuredUsable };
  });

  assert.equal(results.length, 10);
});

test("adding an obstacle changes the usable layout area immediately", () => {
  const geometry = room([[0, 0], [3000, 0], [3000, 2400], [0, 2400]]);
  const before = calculatePlan({ ...DEFAULT_FORM, roomWidth: 3000, roomLength: 2400, roomGeometry: geometry });
  geometry.zones[0].obstacles.push(rectangle("column", 1000, 800, 400, 500));
  const after = calculatePlan({ ...DEFAULT_FORM, roomWidth: 3000, roomLength: 2400, roomGeometry: geometry });

  assert.equal(before.roomAreaMm2, 7_200_000);
  assert.equal(after.roomAreaMm2, 7_000_000);
  assert.ok(after.pieces.length > 0);
});

test("the 3500 × 2800 mm reference room has the manually derived centered cut schedule", () => {
  const plan = calculatePlan({
    ...DEFAULT_FORM,
    roomWidth: 3500,
    roomLength: 2800,
    tileWidth: 600,
    tileLength: 600,
    grout: 3,
    kerf: 3,
    reserve: 10,
    tilesPerCarton: 4,
  });

  assert.equal(plan.error, undefined);
  assert.deepEqual(plan.columns, [542.5, 600, 600, 600, 600, 542.5]);
  assert.deepEqual(plan.rows, [494, 600, 600, 600, 494]);
  assert.equal(plan.pieces.length, 30);
  assert.equal(plan.fullCount, 12);
  assert.equal(plan.cutPieces.length, 18);
  const referencePieces = [];
  let expectedY = 0;
  for (let row = 0; row < plan.rows.length; row += 1) {
    let expectedX = 0;
    for (let column = 0; column < plan.columns.length; column += 1) {
      referencePieces.push([row, column, expectedX, expectedY, plan.columns[column], plan.rows[row]]);
      expectedX += plan.columns[column] + (column < plan.columns.length - 1 ? 3 : 0);
    }
    expectedY += plan.rows[row] + (row < plan.rows.length - 1 ? 3 : 0);
  }
  assert.deepEqual(
    plan.pieces.map((piece) => [piece.row, piece.column, piece.x, piece.y, piece.w, piece.h]),
    referencePieces,
  );
  assert.deepEqual(
    [plan.pieces[0].x, plan.pieces[0].y, plan.pieces[0].w, plan.pieces[0].h, plan.pieces[0].location],
    [0, 0, 542.5, 494, "Top-Left"],
  );
  assert.deepEqual(
    [plan.pieces.at(-1).x, plan.pieces.at(-1).y, plan.pieces.at(-1).w, plan.pieces.at(-1).h, plan.pieces.at(-1).location],
    [2957.5, 2306, 542.5, 494, "Bottom-Right"],
  );
  assert.equal(new Set(plan.pieces.map((piece) => `${piece.row}:${piece.column}`)).size, 30);
  assert.equal(new Set(plan.pieces.map((piece) => piece.number)).size, 30);
  assert.equal(new Set(plan.pieces.map((piece) => piece.stockTile)).size, plan.stockTiles);
  assert.equal(plan.orderQuantity, Math.ceil(plan.stockTiles * 1.1));
  assert.equal(plan.cartonsToOrder, Math.ceil(plan.orderQuantity / 4));
  assert.equal(plan.tilesToOrder, plan.cartonsToOrder * 4);
});

test("supported patterns keep every generated piece inside the room without overlapping another piece", () => {
  const rectangular = createRectangularRoomGeometry(1800, 1500);
  const lRoom = room([[0, 0], [2400, 0], [2400, 1200], [1200, 1200], [1200, 2400], [0, 2400]]);
  const irregularRoom = room([[0, 0], [2400, 0], [2400, 1400], [1600, 2200], [0, 2200]]);
  const obstacleRoom = room([[0, 0], [2400, 0], [2400, 2200], [0, 2200]], {
    obstacles: [rectangle("pillar", 900, 800, 400, 400)],
  });
  const cases = [
    ...["straight", "half-offset", "third-offset", "two-thirds-offset", "diagonal"].map((pattern) => ({ pattern, geometry: rectangular, tileWidth: 600, tileLength: 600 })),
    { pattern: "herringbone", geometry: rectangular, tileWidth: 600, tileLength: 300 },
    ...["straight", "half-offset", "third-offset", "two-thirds-offset", "diagonal"].map((pattern) => ({ pattern, geometry: lRoom, tileWidth: 600, tileLength: 600 })),
    { pattern: "herringbone", geometry: lRoom, tileWidth: 600, tileLength: 300 },
    ...["straight", "half-offset", "third-offset", "two-thirds-offset", "diagonal"].map((pattern) => ({ pattern, geometry: irregularRoom, tileWidth: 600, tileLength: 600 })),
    { pattern: "herringbone", geometry: irregularRoom, tileWidth: 600, tileLength: 300 },
    ...["straight", "half-offset", "third-offset", "two-thirds-offset", "diagonal"].map((pattern) => ({ pattern, geometry: obstacleRoom, tileWidth: 600, tileLength: 600 })),
    { pattern: "herringbone", geometry: obstacleRoom, tileWidth: 600, tileLength: 300 },
  ];

  for (const { pattern, geometry, tileWidth, tileLength } of cases) {
    const plan = calculatePlan({
      ...DEFAULT_FORM,
      roomWidth: roomGeometryBoundsForTest(geometry).widthMm,
      roomLength: roomGeometryBoundsForTest(geometry).lengthMm,
      tileWidth,
      tileLength,
      grout: 3,
      kerf: 1,
      reserve: 0,
      pattern,
      roomGeometry: geometry,
    });
    const caseName = `${pattern}/${geometry.zones[0].boundary.length}-vertex room`;
    assert.equal(plan.error, undefined, `${caseName} should calculate`);
    assert.ok(plan.pieces.length > 0, `${caseName} should make pieces`);
    assert.equal(new Set(plan.pieces.map((piece) => piece.id)).size, plan.pieces.length, `${caseName} piece IDs should be unique`);

    const footprint = roomFootprint(geometry);
    for (const piece of plan.pieces) {
      const outside = subtractMultiPolygon(piece.geometry, footprint);
      assert.ok(multiPolygonArea(outside) <= 0.01, `${caseName}/${piece.id} must stay inside the room`);
    }
    for (let left = 0; left < plan.pieces.length; left += 1) {
      for (let right = left + 1; right < plan.pieces.length; right += 1) {
        const overlap = polygonClipping.intersection(plan.pieces[left].geometry, plan.pieces[right].geometry);
      assert.ok(multiPolygonArea(overlap) <= 0.01, `${caseName}/${plan.pieces[left].id} overlaps ${plan.pieces[right].id}`);
      }
    }
  }
});

test("kerf-aware nesting reuses one stock tile without overlapping cuts or double-allocating an offcut", () => {
  const pieces = [
    { number: 1, w: 300, h: 250 },
    { number: 2, w: 250, h: 300 },
    { number: 3, w: 350, h: 300 },
  ];
  const result = nestPieces(pieces, 600, 600, 3);

  assert.equal(result.stockTiles, 2);
  const sourceTileFor = (number) => pieces.find((piece) => piece.number === number).stockTile;
  assert.equal(sourceTileFor(1), sourceTileFor(3), "the compatible cut should use a real free rectangle from the first stock tile");
  assert.notEqual(sourceTileFor(2), sourceTileFor(1), "a cut that does not fit must use another stock tile");
  assert.equal(new Set(pieces.map((piece) => piece.number)).size, pieces.length);

  for (const stockTile of new Set(pieces.map((piece) => piece.stockTile))) {
    const placements = pieces.filter((piece) => piece.stockTile === stockTile).map((piece) => ({
      x: piece.stockX,
      y: piece.stockY,
      width: piece.w + 3,
      height: piece.h + 3,
    }));
    for (const placement of placements) {
      assert.ok(placement.x >= 0 && placement.y >= 0);
      assert.ok(placement.x + placement.width <= 600 + 1e-7);
      assert.ok(placement.y + placement.height <= 600 + 1e-7);
    }
    for (let left = 0; left < placements.length; left += 1) {
      for (let right = left + 1; right < placements.length; right += 1) {
        const a = placements[left];
        const b = placements[right];
        const overlapWidth = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
        const overlapHeight = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
        assert.equal(overlapWidth * overlapHeight, 0, `stock tile ${stockTile} placements must not overlap`);
      }
    }
  }
});

test("cut rotation is explicit, applies only to eligible pieces, and still respects stock bounds", () => {
  const fixed = [{ number: 1, w: 400, h: 500, rotatable: true }];
  const withoutRotation = nestPieces(fixed, 600, 400, 0);
  assert.match(withoutRotation.error, /does not fit/);

  const rotatable = [{ number: 1, w: 400, h: 500, rotatable: true }];
  const rotated = nestPieces(rotatable, 600, 400, 3, { allowRotation: true });
  assert.equal(rotated.stockTiles, 1);
  assert.equal(rotatable[0].stockRotated, true);
  assert.equal(rotatable[0].stockPackedWidth, 503);
  assert.equal(rotatable[0].stockPackedHeight, 400);
  assert.ok(rotatable[0].stockX + rotatable[0].stockPackedWidth <= 600);
  assert.ok(rotatable[0].stockY + rotatable[0].stockPackedHeight <= 400);

  const directional = nestPieces([{ number: 1, w: 400, h: 500, rotatable: false }], 600, 400, 0, { allowRotation: true });
  assert.match(directional.error, /does not fit/);
});

function roomGeometryBoundsForTest(geometry) {
  const points = geometry.zones.flatMap((zone) => zone.boundary);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    widthMm: Math.max(...xs) - Math.min(...xs),
    lengthMm: Math.max(...ys) - Math.min(...ys),
  };
}
