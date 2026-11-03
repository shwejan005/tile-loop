export const ROOM_GEOMETRY_SCHEMA = "tileloop-room-geometry/v2";
const LEGACY_ROOM_GEOMETRY_SCHEMA = "tileloop-room-geometry/v1";

const COORDINATE_LIMIT_MM = 50_000;
const MAX_GEOMETRY_POINTS = 2_000;
const EPSILON = 1e-8;

function samePoint(a, b) {
  return Math.abs(a[0] - b[0]) <= EPSILON && Math.abs(a[1] - b[1]) <= EPSILON;
}

function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(a, b, point) {
  return Math.abs(cross(a, b, point)) <= EPSILON
    && point[0] >= Math.min(a[0], b[0]) - EPSILON
    && point[0] <= Math.max(a[0], b[0]) + EPSILON
    && point[1] >= Math.min(a[1], b[1]) - EPSILON
    && point[1] <= Math.max(a[1], b[1]) + EPSILON;
}

function segmentsIntersect(a, b, c, d) {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  if (((abC > EPSILON && abD < -EPSILON) || (abC < -EPSILON && abD > EPSILON))
    && ((cdA > EPSILON && cdB < -EPSILON) || (cdA < -EPSILON && cdB > EPSILON))) return true;
  return (Math.abs(abC) <= EPSILON && onSegment(a, b, c))
    || (Math.abs(abD) <= EPSILON && onSegment(a, b, d))
    || (Math.abs(cdA) <= EPSILON && onSegment(c, d, a))
    || (Math.abs(cdB) <= EPSILON && onSegment(c, d, b));
}

function signedArea(ring) {
  return ring.reduce((sum, point, index) => {
    const next = ring[(index + 1) % ring.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2;
}

function validCoordinate(point) {
  return Array.isArray(point) && point.length === 2
    && point.every((value) => Number.isFinite(value) && Math.abs(value) <= COORDINATE_LIMIT_MM);
}

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[j];
    const b = ring[i];
    if (onSegment(a, b, point)) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1])
      && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function validateRing(ring, label) {
  if (!Array.isArray(ring) || ring.length < 3 || ring.length > 1000) {
    return `${label} must contain between 3 and 1,000 points.`;
  }
  for (const point of ring) {
    if (!validCoordinate(point)) {
      return `${label} points must be finite [x, y] coordinates within ±50,000 mm.`;
    }
  }
  for (let i = 0; i < ring.length; i += 1) {
    if (samePoint(ring[i], ring[(i + 1) % ring.length])) return `${label} cannot contain a zero-length edge.`;
  }
  if (Math.abs(signedArea(ring)) <= EPSILON) return `${label} must enclose a non-zero area.`;

  for (let i = 0; i < ring.length; i += 1) {
    const nextI = (i + 1) % ring.length;
    for (let j = i + 1; j < ring.length; j += 1) {
      const nextJ = (j + 1) % ring.length;
      if (i === j || nextI === j || nextJ === i) continue;
      if (segmentsIntersect(ring[i], ring[nextI], ring[j], ring[nextJ])) {
        return `${label} cannot cross or touch itself.`;
      }
    }
  }
  return null;
}

function validateExclusionRecords(records, label, outerBoundary, seenIds) {
  if (!Array.isArray(records)) return `${label} must be a list.`;
  for (const [index, record] of records.entries()) {
    if (!record || typeof record !== "object" || typeof record.id !== "string" || !record.id.trim() || record.id.length > 80) {
      return `${label} ${index + 1} needs a unique ID of at most 80 characters.`;
    }
    if (seenIds.has(record.id)) return `Room geometry IDs must be unique; duplicate "${record.id}".`;
    seenIds.add(record.id);
    const ringError = validateRing(record.boundary, `${label} ${record.id}`);
    if (ringError) return ringError;
    if (record.boundary.some((point) => !pointInRing(point, outerBoundary))) {
      return `${label} ${record.id} must be inside the room boundary.`;
    }
    for (let i = 0; i < record.boundary.length; i += 1) {
      const a = record.boundary[i];
      const b = record.boundary[(i + 1) % record.boundary.length];
      for (let j = 0; j < outerBoundary.length; j += 1) {
        if (segmentsIntersect(a, b, outerBoundary[j], outerBoundary[(j + 1) % outerBoundary.length])) {
          return `${label} ${record.id} cannot cross or touch the room boundary.`;
        }
      }
    }
  }
  return null;
}

function validateAccessPoints(accessPoints, boundary, seenIds, label) {
  if (!Array.isArray(accessPoints)) return `${label} access points must be a list.`;
  for (const [index, accessPoint] of accessPoints.entries()) {
    if (!accessPoint || typeof accessPoint.id !== "string" || !accessPoint.id.trim() || accessPoint.id.length > 80) {
      return `${label} access point ${index + 1} needs an ID of at most 80 characters.`;
    }
    if (seenIds.has(accessPoint.id)) return `Room geometry IDs must be unique; duplicate "${accessPoint.id}".`;
    seenIds.add(accessPoint.id);
    if (typeof accessPoint.kind !== "string" || !accessPoint.kind.trim()
      || !Array.isArray(accessPoint.segment) || accessPoint.segment.length !== 2) {
      return `Access point ${accessPoint.id} needs a kind and a two-point boundary segment.`;
    }
    const [start, end] = accessPoint.segment;
    if (!validCoordinate(start) || !validCoordinate(end) || samePoint(start, end)) {
      return `Access point ${accessPoint.id} must use two distinct finite [x, y] coordinates.`;
    }
    const sharesWall = boundary.some((point, edgeIndex) => {
      const next = boundary[(edgeIndex + 1) % boundary.length];
      return onSegment(point, next, start) && onSegment(point, next, end);
    });
    if (!sharesWall) return `Access point ${accessPoint.id} must lie along one room boundary edge.`;
  }
  return null;
}

export function getRoomGeometryZones(geometry) {
  if (geometry?.schema === ROOM_GEOMETRY_SCHEMA) return geometry.zones;
  if (geometry?.schema === LEGACY_ROOM_GEOMETRY_SCHEMA) {
    return [{
      id: "legacy-zone-1",
      boundary: geometry.boundary,
      openings: geometry.openings || [],
      obstacles: geometry.obstacles || [],
      accessPoints: geometry.accessPoints || [],
    }];
  }
  return [];
}

export function normalizeRoomGeometry(geometry) {
  const error = validateRoomGeometry(geometry);
  if (error) throw new TypeError(error);
  return {
    schema: ROOM_GEOMETRY_SCHEMA,
    unit: "mm",
    zones: getRoomGeometryZones(geometry).map((zone) => ({
      id: zone.id,
      boundary: zone.boundary.map(([x, y]) => [x, y]),
      openings: (zone.openings || []).map((item) => ({ ...item, boundary: item.boundary.map(([x, y]) => [x, y]) })),
      obstacles: (zone.obstacles || []).map((item) => ({ ...item, boundary: item.boundary.map(([x, y]) => [x, y]) })),
      accessPoints: (zone.accessPoints || []).map((item) => ({ ...item, segment: item.segment.map(([x, y]) => [x, y]) })),
    })),
  };
}

/** Return a validated, normalized room definition for the currently supported rectangle input. */
export function createRectangularRoomGeometry(widthMm, lengthMm) {
  if (!Number.isFinite(widthMm) || !Number.isFinite(lengthMm)
    || widthMm <= 0 || lengthMm <= 0
    || widthMm > COORDINATE_LIMIT_MM || lengthMm > COORDINATE_LIMIT_MM) {
    throw new RangeError("Room dimensions must be positive finite values no greater than 50,000 mm.");
  }
  return {
    schema: ROOM_GEOMETRY_SCHEMA,
    unit: "mm",
    zones: [{
      id: "zone-1",
      boundary: [[0, 0], [widthMm, 0], [widthMm, lengthMm], [0, lengthMm]],
      openings: [],
      obstacles: [],
      accessPoints: [],
    }],
  };
}

/** Return null for a valid versioned room, or a user-safe validation message. */
export function validateRoomGeometry(geometry) {
  if (!geometry || typeof geometry !== "object"
    || ![ROOM_GEOMETRY_SCHEMA, LEGACY_ROOM_GEOMETRY_SCHEMA].includes(geometry.schema)) {
    return `Room geometry must use the ${ROOM_GEOMETRY_SCHEMA} schema.`;
  }
  if (geometry.unit !== "mm") return "Room geometry coordinates must use millimeters.";
  const ids = new Set();
  const zones = getRoomGeometryZones(geometry);
  if (!Array.isArray(zones) || zones.length < 1 || zones.length > 50) {
    return "A room plan must contain between 1 and 50 room zones.";
  }
  const totalPoints = zones.reduce((count, zone) => count
    + (Array.isArray(zone?.boundary) ? zone.boundary.length : 0)
    + [...(Array.isArray(zone?.openings) ? zone.openings : []), ...(Array.isArray(zone?.obstacles) ? zone.obstacles : [])]
      .reduce((sum, entry) => sum + (Array.isArray(entry?.boundary) ? entry.boundary.length : 0), 0)
    + (Array.isArray(zone?.accessPoints) ? zone.accessPoints.length * 2 : 0), 0);
  if (totalPoints > MAX_GEOMETRY_POINTS) return `Room geometry is limited to ${MAX_GEOMETRY_POINTS} total points.`;
  for (const [index, zone] of zones.entries()) {
    if (!zone || typeof zone.id !== "string" || !zone.id.trim() || zone.id.length > 80) {
      return `Room zone ${index + 1} needs a unique ID of at most 80 characters.`;
    }
    if (ids.has(zone.id)) return `Room geometry IDs must be unique; duplicate "${zone.id}".`;
    ids.add(zone.id);
    const boundaryError = validateRing(zone.boundary, `Room zone ${zone.id} boundary`);
    if (boundaryError) return boundaryError;
    const openingsError = validateExclusionRecords(zone.openings ?? [], `Floor opening in ${zone.id}`, zone.boundary, ids);
    if (openingsError) return openingsError;
    const obstaclesError = validateExclusionRecords(zone.obstacles ?? [], `Obstacle in ${zone.id}`, zone.boundary, ids);
    if (obstaclesError) return obstaclesError;
    const accessError = validateAccessPoints(zone.accessPoints ?? [], zone.boundary, ids, zone.id);
    if (accessError) return accessError;
  }
  return null;
}

/** Gross area of the room boundary only; exclusions are not subtracted. */
export function roomBoundaryArea(geometry) {
  const error = validateRoomGeometry(geometry);
  if (error) throw new TypeError(error);
  return getRoomGeometryZones(geometry).reduce((total, zone) => total + Math.abs(signedArea(zone.boundary)), 0);
}

export function roomGeometryBounds(geometry) {
  const error = validateRoomGeometry(geometry);
  if (error) throw new TypeError(error);
  const points = getRoomGeometryZones(geometry).flatMap((zone) => zone.boundary);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, widthMm: maxX - minX, lengthMm: maxY - minY };
}

/** Scale every room feature with the bounding box when a user edits its dimensions. */
export function resizeRoomGeometry(geometry, widthMm, lengthMm) {
  const error = validateRoomGeometry(geometry);
  if (error) throw new TypeError(error);
  if (!Number.isFinite(widthMm) || !Number.isFinite(lengthMm)
    || widthMm < 300 || lengthMm < 300 || widthMm > COORDINATE_LIMIT_MM || lengthMm > COORDINATE_LIMIT_MM) {
    throw new RangeError("Room dimensions must be between 300 and 50,000 mm.");
  }
  const bounds = roomGeometryBounds(geometry);
  const scaleX = widthMm / bounds.widthMm;
  const scaleY = lengthMm / bounds.lengthMm;
  const scalePoint = ([x, y]) => [(x - bounds.minX) * scaleX, (y - bounds.minY) * scaleY];
  const zones = getRoomGeometryZones(geometry).map((zone) => ({
    id: zone.id,
    boundary: zone.boundary.map(scalePoint),
    openings: (zone.openings || []).map((entry) => ({ ...entry, boundary: entry.boundary.map(scalePoint) })),
    obstacles: (zone.obstacles || []).map((entry) => ({ ...entry, boundary: entry.boundary.map(scalePoint) })),
    accessPoints: (zone.accessPoints || []).map((entry) => ({ ...entry, segment: entry.segment.map(scalePoint) })),
  }));
  return { schema: ROOM_GEOMETRY_SCHEMA, unit: "mm", zones };
}
