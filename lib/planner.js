import { DEFAULT_LAYOUT_PATTERN, getLayoutStrategy } from "./layout/registry.js";
import { buildCenteredStraightLayout } from "./layout/straight.js";
import { buildPolygonLayout } from "./layout/polygon.js";
import { buildHerringboneLayout } from "./layout/herringbone.js";
import { createRectangularRoomGeometry, roomGeometryBounds, validateRoomGeometry } from "./geometry/room.js";
import { nestPieces } from "./cutting/nesting.js";

export { MIN_REMNANT_SIDE } from "./cutting/nesting.js";

export const DEFAULT_FORM = {
  planId: "UAE-01",
  roomWidth: 4870,
  roomLength: 3620,
  tileWidth: 600,
  tileLength: 600,
  grout: 3,
  kerf: 3,
  orientation: "standard",
  pattern: DEFAULT_LAYOUT_PATTERN,
  tilesPerCarton: "",
  reserve: 10,
};

export const ALGORITHM_VERSION = "tileloop-plan-2";

const round2 = (value) => Math.round(value * 100) / 100;
const DIMENSION_EPSILON = 1e-7;
const nearlyEqual = (a, b) => Math.abs(a - b) < DIMENSION_EPSILON;

export function formatNumber(value) {
  const rounded = round2(value);
  if (Number.isInteger(rounded)) return `${rounded}`;
  return rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatMm(value) {
  return `${formatNumber(value)} mm`;
}

export function formatArea(value) {
  const squareMeters = value / 1_000_000;
  return `${squareMeters < 10 ? squareMeters.toFixed(2) : squareMeters.toFixed(1)} m²`;
}

export function validateForm(form) {
  if (!form || typeof form !== "object") return "Enter room and tile dimensions to calculate a plan.";

  const rules = [
    [form.roomWidth, 300, 50000, "Room width must be between 300 and 50,000 mm."],
    [form.roomLength, 300, 50000, "Room length must be between 300 and 50,000 mm."],
    [form.tileWidth, 50, 3000, "Tile width must be between 50 and 3,000 mm."],
    [form.tileLength, 50, 3000, "Tile length must be between 50 and 3,000 mm."],
    [form.grout, 0, 30, "Grout joint must be between 0 and 30 mm."],
    [form.kerf, 0, 10, "Saw kerf must be between 0 and 10 mm."],
    [form.reserve, 0, 20, "Order buffer must be between 0% and 20%."],
  ];
  const invalid = rules.find(([value, min, max]) => !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max);
  if (invalid) return invalid[3];
  const preciseFields = [form.roomWidth, form.roomLength, form.tileWidth, form.tileLength, form.grout, form.kerf, form.reserve];
  if (preciseFields.some((value) => Math.abs(Number(value) * 100 - Math.round(Number(value) * 100)) > DIMENSION_EPSILON)) {
    return "Measurements, kerf, grout, and buffer support at most two decimal places.";
  }
  if (form.tilesPerCarton !== "" && form.tilesPerCarton != null
    && (!Number.isInteger(Number(form.tilesPerCarton)) || Number(form.tilesPerCarton) < 1 || Number(form.tilesPerCarton) > 1000)) {
    return "Tiles per carton must be a whole number from 1 to 1,000, or left blank.";
  }
  if (Number(form.tileWidth) <= Number(form.grout) || Number(form.tileLength) <= Number(form.grout)) {
    return "Tile dimensions must be larger than the grout joint.";
  }
  const planId = String(form.planId || "").trim();
  if (!planId) return "Add an anonymous plan label, such as UAE-01.";
  if (planId.length > 24) return "Room plan IDs must be 24 characters or fewer.";
  if (/[\u0000-\u001f\u007f]/.test(planId)) return "Room plan IDs cannot contain control characters.";
  const strategy = getLayoutStrategy(form.pattern || DEFAULT_LAYOUT_PATTERN);
  if (!strategy) return "Choose a known installation pattern.";
  if (strategy.availability !== "supported") return `${strategy.label} layout is not supported yet.`;
  if (form.roomGeometry) {
    const geometryError = validateRoomGeometry(form.roomGeometry);
    if (geometryError) return geometryError;
    const bounds = roomGeometryBounds(form.roomGeometry);
    if (bounds.widthMm < 300 || bounds.lengthMm < 300 || bounds.widthMm > 50000 || bounds.lengthMm > 50000) {
      return "Room geometry bounds must be between 300 and 50,000 mm in each direction.";
    }
  }
  if (!["standard", "rotated"].includes(form.orientation || "standard")) return "Choose a valid tile direction.";
  return null;
}

export function calculatePlan(form) {
  const validationError = validateForm(form);
  if (validationError) return { error: validationError };

  const values = {
    planId: String(form.planId).trim(),
    pattern: form.pattern || DEFAULT_LAYOUT_PATTERN,
    patternStrategyVersion: getLayoutStrategy(form.pattern || DEFAULT_LAYOUT_PATTERN).version,
    roomWidth: Number(form.roomWidth),
    roomLength: Number(form.roomLength),
    tileWidth: Number(form.tileWidth),
    tileLength: Number(form.tileLength),
    grout: Number(form.grout),
    kerf: Number(form.kerf),
    reserve: Number(form.reserve),
    tilesPerCarton: form.tilesPerCarton === "" || form.tilesPerCarton == null ? null : Number(form.tilesPerCarton),
  };
  if (form.roomGeometry || values.pattern !== "straight") {
    const roomGeometry = form.roomGeometry || createRectangularRoomGeometry(values.roomWidth, values.roomLength);
    const bounds = roomGeometryBounds(roomGeometry);
    values.roomWidth = bounds.widthMm;
    values.roomLength = bounds.lengthMm;
    if (values.roomWidth < 300 || values.roomLength < 300 || values.roomWidth > 50000 || values.roomLength > 50000) {
      return { error: "Room geometry bounds must be between 300 and 50,000 mm in each direction." };
    }
    if (form.orientation === "rotated") [values.tileWidth, values.tileLength] = [values.tileLength, values.tileWidth];
    return calculatePolygonPlan(values, roomGeometry);
  }
  if (form.orientation === "rotated") [values.tileWidth, values.tileLength] = [values.tileLength, values.tileWidth];

  const layout = buildCenteredStraightLayout({
    roomWidth: values.roomWidth,
    roomLength: values.roomLength,
    tileWidth: values.tileWidth,
    tileLength: values.tileLength,
    grout: values.grout,
  });
  if (layout.error) return layout;
  const { columns, rows, pieces } = layout;

  const kerfConflict = pieces.find((piece) =>
    (piece.w < values.tileWidth - DIMENSION_EPSILON && piece.w + values.kerf > values.tileWidth + DIMENSION_EPSILON)
    || (piece.h < values.tileLength - DIMENSION_EPSILON && piece.h + values.kerf > values.tileLength + DIMENSION_EPSILON));
  if (kerfConflict) {
    return { error: `A ${formatNumber(values.kerf)} mm saw kerf leaves insufficient stock for one or more required cuts. Verify the saw kerf or tile size.` };
  }

  const nesting = nestPieces(pieces, values.tileWidth, values.tileLength, values.kerf);
  const cutPieces = pieces.filter((piece) => !piece.full);
  const cutEdges = cutPieces.reduce((sum, piece) => sum + (piece.w < values.tileWidth - DIMENSION_EPSILON && piece.h < values.tileLength - DIMENSION_EPSILON ? 2 : 1), 0);
  const orderQuantity = Math.ceil(nesting.stockTiles * (1 + values.reserve / 100));
  const scheduleMap = new Map();
  for (const piece of pieces) {
    const key = `${round2(piece.w)}x${round2(piece.h)}:${piece.full}`;
    const entry = scheduleMap.get(key) || { w: piece.w, h: piece.h, full: piece.full, qty: 0, locations: new Set() };
    entry.qty += 1;
    entry.locations.add(piece.location);
    scheduleMap.set(key, entry);
  }
  const schedule = [...scheduleMap.values()].sort((a, b) => a.full === b.full ? b.w * b.h - a.w * a.h : a.full ? -1 : 1);

  return {
    ...values,
    roomAreaMm2: values.roomWidth * values.roomLength,
    columns,
    rows,
    pieces,
    cutPieces,
    fullCount: pieces.length - cutPieces.length,
    cutEdges,
    stockTiles: nesting.stockTiles,
    orderQuantity,
    cartonsToOrder: values.tilesPerCarton ? Math.ceil(orderQuantity / values.tilesPerCarton) : null,
    tilesToOrder: values.tilesPerCarton ? Math.ceil(orderQuantity / values.tilesPerCarton) * values.tilesPerCarton : orderQuantity,
    remnants: nesting.remnants,
    remnantCount: nesting.remnantCount,
    remnantArea: nesting.remnantArea,
    schedule,
  };
}

function calculatePolygonPlan(values, roomGeometry) {
  const buildLayout = values.pattern === "herringbone" ? buildHerringboneLayout : buildPolygonLayout;
  const layout = buildLayout({
    roomGeometry,
    tileWidth: values.tileWidth,
    tileLength: values.tileLength,
    grout: values.grout,
    kerf: values.kerf,
    pattern: values.pattern,
  });
  if (layout.error) return layout;

  const stockTileWidth = layout.stockTileWidth ?? values.tileWidth;
  const stockTileLength = layout.stockTileLength ?? values.tileLength;
  const kerfConflict = layout.cells.find((cell) =>
    (cell.w < stockTileWidth - DIMENSION_EPSILON && cell.w + values.kerf > stockTileWidth + DIMENSION_EPSILON)
    || (cell.h < stockTileLength - DIMENSION_EPSILON && cell.h + values.kerf > stockTileLength + DIMENSION_EPSILON));
  if (kerfConflict) {
    return { error: `A ${formatNumber(values.kerf)} mm saw kerf leaves insufficient stock for one or more required cuts. Verify the saw kerf or tile size.` };
  }

  const orderQuantity = Math.ceil(layout.stockTiles * (1 + values.reserve / 100));
  return {
    ...values,
    ...layout,
    roomAreaMm2: layout.floorAreaMm2,
    orderQuantity,
    cartonsToOrder: values.tilesPerCarton ? Math.ceil(orderQuantity / values.tilesPerCarton) : null,
    tilesToOrder: values.tilesPerCarton ? Math.ceil(orderQuantity / values.tilesPerCarton) * values.tilesPerCarton : orderQuantity,
    geometryMode: true,
    roomGeometry,
  };
}

// A theoretical lower bound based on floor area. Grout occupies part of the
// room, so it must not be counted as area that tiles need to cover.
export function minimumTilesByArea(plan) {
  if (!plan || plan.error) return null;
  const tileArea = Number(plan.tileWidth) * Number(plan.tileLength);
  const roomArea = Number(plan.roomAreaMm2 ?? Number(plan.roomWidth) * Number(plan.roomLength));
  if (!(tileArea > 0) || !(roomArea > 0)) return null;
  return Math.ceil(roomArea / tileArea - 1e-9);
}

export function formatLocation(locations) {
  const list = [...locations];
  if (list.length === 1 && list[0] === "Interior") return "Room interior";
  if (list.length === 1) return list[0].replaceAll("-", " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
  if (list.every((value) => ["Top-Left", "Top-Right", "Bottom-Left", "Bottom-Right"].includes(value))) return "Room corners";
  if (list.includes("Interior")) return "Interior & edges";
  return "Room edges";
}
