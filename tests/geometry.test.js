import assert from "node:assert/strict";
import test from "node:test";
import {
  createRectangularRoomGeometry,
  roomBoundaryArea,
  roomGeometryBounds,
  validateRoomGeometry,
} from "../lib/geometry/room.js";
import {
  intersectWithRectangle,
  multiPolygonArea,
  multiPolygonBounds,
  roomFootprint,
} from "../lib/geometry/operations.js";

test("rectangular inputs produce a versioned geometry snapshot in millimeters", () => {
  const geometry = createRectangularRoomGeometry(4870, 3620);
  assert.equal(validateRoomGeometry(geometry), null);
  assert.equal(roomBoundaryArea(geometry), 17_629_400);
  assert.deepEqual(roomGeometryBounds(geometry), {
    minX: 0,
    minY: 0,
    maxX: 4870,
    maxY: 3620,
    widthMm: 4870,
    lengthMm: 3620,
  });
  assert.equal(geometry.zones.length, 1);
  assert.deepEqual(geometry.zones[0].openings, []);
  assert.deepEqual(geometry.zones[0].obstacles, []);
});

test("the geometry contract validates a concave room and keeps exclusions and doorways distinct", () => {
  const geometry = {
    schema: "tileloop-room-geometry/v2",
    unit: "mm",
    zones: [{
      id: "main",
      boundary: [[0, 0], [4000, 0], [4000, 1000], [1000, 1000], [1000, 4000], [0, 4000]],
      openings: [{ id: "floor-drain", boundary: [[100, 1500], [300, 1500], [300, 1700], [100, 1700]] }],
      obstacles: [{ id: "column-1", boundary: [[200, 200], [400, 200], [400, 400], [200, 400]] }],
      accessPoints: [{ id: "door-1", kind: "doorway", segment: [[0, 500], [0, 800]] }],
    }],
  };

  assert.equal(validateRoomGeometry(geometry), null);
  assert.equal(roomBoundaryArea(geometry), 7_000_000);
  assert.match(validateRoomGeometry({ ...geometry, zones: [{ ...geometry.zones[0], obstacles: [{ id: "outside", boundary: [[2000, 2000], [2200, 2000], [2200, 2200], [2000, 2200]] }] }] }), /inside the room boundary/);
  assert.match(validateRoomGeometry({ ...geometry, zones: [{ ...geometry.zones[0], accessPoints: [{ id: "door-1", kind: "doorway", segment: [[100, 500], [100, 800]] }] }] }), /along one room boundary edge/);
});

test("geometry validation rejects malformed and self-intersecting boundaries", () => {
  const geometry = createRectangularRoomGeometry(1000, 1000);
  const zone = geometry.zones[0];
  assert.match(validateRoomGeometry({ ...geometry, zones: [{ ...zone, boundary: [[0, 0], [1000, 1000], [0, 1000], [800, 0]] }] }), /non-zero area|cross or touch itself/);
  assert.match(validateRoomGeometry({ ...geometry, zones: [{ ...zone, boundary: [[0, 0], [1000, 0], [1000, 0]] }] }), /zero-length edge|non-zero area/);
  assert.throws(() => createRectangularRoomGeometry(0, 1000), /positive finite/);
});

test("version 2 geometry supports multiple zones without breaking saved version 1 rooms", () => {
  const first = createRectangularRoomGeometry(1000, 1000).zones[0];
  const second = { id: "annex", boundary: [[1500, 0], [2500, 0], [2500, 1000], [1500, 1000]] };
  const multiple = { schema: "tileloop-room-geometry/v2", unit: "mm", zones: [first, second] };
  const legacy = {
    schema: "tileloop-room-geometry/v1",
    unit: "mm",
    boundary: first.boundary,
  };
  assert.equal(validateRoomGeometry(multiple), null);
  assert.equal(roomBoundaryArea(multiple), 2_000_000);
  assert.equal(validateRoomGeometry(legacy), null);
  assert.equal(roomBoundaryArea(legacy), 1_000_000);
});

test("polygon booleans subtract columns and floor openings and clip tile cells to an L-shaped room", () => {
  const geometry = {
    schema: "tileloop-room-geometry/v2",
    unit: "mm",
    zones: [{
      id: "l-room",
      boundary: [[0, 0], [4000, 0], [4000, 1000], [1000, 1000], [1000, 4000], [0, 4000]],
      openings: [{ id: "drain", boundary: [[100, 1500], [300, 1500], [300, 1700], [100, 1700]] }],
      obstacles: [{ id: "column", boundary: [[200, 200], [400, 200], [400, 400], [200, 400]] }],
    }],
  };
  const footprint = roomFootprint(geometry);
  const leg = intersectWithRectangle(footprint, 0, 1000, 1000, 1000);
  const emptyCorner = intersectWithRectangle(footprint, 2000, 2000, 1000, 1000);

  assert.equal(multiPolygonArea(footprint), 6_920_000);
  assert.equal(multiPolygonArea(leg), 960_000);
  assert.deepEqual(multiPolygonBounds(leg), { minX: 0, minY: 1000, maxX: 1000, maxY: 2000, widthMm: 1000, lengthMm: 1000 });
  assert.deepEqual(emptyCorner, []);
});
