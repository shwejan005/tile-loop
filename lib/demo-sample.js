import { createRectangularRoomGeometry } from "./geometry/room.js";
import { DEFAULT_FORM } from "./planner.js";

export function createDemoForm() {
  const roomGeometry = createRectangularRoomGeometry(5200, 4200);
  roomGeometry.zones[0].boundary = [[0, 0], [5200, 0], [5200, 1600], [3200, 1600], [3200, 4200], [0, 4200]];
  roomGeometry.zones[0].obstacles.push({
    id: "demo-column",
    boundary: [[1100, 550], [1500, 550], [1500, 950], [1100, 950]],
  });
  roomGeometry.zones[0].openings.push({
    id: "demo-floor-opening",
    boundary: [[400, 2100], [650, 2100], [650, 2350], [400, 2350]],
  });
  roomGeometry.zones[0].accessPoints.push({ id: "demo-doorway", kind: "doorway", segment: [[1400, 0], [2300, 0]] });
  return {
    ...DEFAULT_FORM,
    planId: "DEMO-01",
    roomWidth: 5200,
    roomLength: 4200,
    tileWidth: 600,
    tileLength: 300,
    kerf: 1,
    pattern: "half-offset",
    tilesPerCarton: 8,
    reserve: 8,
    roomGeometry,
  };
}
