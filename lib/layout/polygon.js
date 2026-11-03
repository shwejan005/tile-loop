import { MIN_REMNANT_SIDE, nestPieces } from "../cutting/nesting.js";
import {
  intersectWithRectangle,
  multiPolygonArea,
  multiPolygonBounds,
  rectanglePolygon,
  roomFootprint,
  rotateMultiPolygon,
  subtractMultiPolygon,
} from "../geometry/operations.js";

const EPSILON = 1e-7;
const MAX_POLYGON_CELLS = 2_000;
const MAX_REUSE_FIT_CHECKS = 500;

function centeredAxis(min, max, tileSize, grout) {
  const extent = max - min;
  const pitch = tileSize + grout;
  const count = Math.max(1, Math.ceil((extent + grout) / pitch));
  const occupied = count * tileSize + (count - 1) * grout;
  return { start: (min + max - occupied) / 2, count, pitch };
}

function isFullCell(geometry, tileWidth, tileLength) {
  return Math.abs(multiPolygonArea(geometry) - tileWidth * tileLength)
    <= Math.max(EPSILON, tileWidth * tileLength * 1e-10);
}

function shapeKind(polygon, full) {
  if (full) return "rectangle";
  if (!polygon || polygon.length !== 1 || polygon[0].length !== 5) return "polygon";
  const bounds = multiPolygonBounds([polygon]);
  const corners = new Set(polygon[0].slice(0, -1).map(([x, y]) => `${x === bounds.minX || x === bounds.maxX ? x : "_"}:${y === bounds.minY || y === bounds.maxY ? y : "_"}`));
  return corners.size === 4 ? "rectangle" : "polygon";
}

function cellColumnRange(axis, min, max, shift, tileSize) {
  const first = Math.floor((min - axis.start - shift - tileSize) / axis.pitch) + 1;
  const last = Math.ceil((max - axis.start - shift) / axis.pitch) - 1;
  return { first, last };
}

function rectangleFits(geometry, width, height, kerf) {
  const packedWidth = width + kerf;
  const packedHeight = height + kerf;
  const bounds = multiPolygonBounds(geometry);
  if (!bounds || packedWidth > bounds.widthMm + EPSILON || packedHeight > bounds.lengthMm + EPSILON) return false;
  const polygon = geometry[0];
  const outer = polygon?.[0] || [];
  const xs = new Set([bounds.minX, bounds.maxX - packedWidth]);
  const ys = new Set([bounds.minY, bounds.maxY - packedHeight]);
  for (const [x, y] of outer.slice(0, 16)) {
    if (xs.size < 18) { xs.add(x); xs.add(x - packedWidth); }
    if (ys.size < 18) { ys.add(y); ys.add(y - packedHeight); }
  }
  for (const x of xs) {
    for (const y of ys) {
      if (x < bounds.minX - EPSILON || y < bounds.minY - EPSILON
        || x + packedWidth > bounds.maxX + EPSILON || y + packedHeight > bounds.maxY + EPSILON) continue;
      const overlap = intersectWithRectangle(geometry, x, y, packedWidth, packedHeight);
      if (Math.abs(multiPolygonArea(overlap) - packedWidth * packedHeight) <= Math.max(EPSILON, packedWidth * packedHeight * 1e-10)) {
        return true;
      }
    }
  }
  return false;
}

export function buildShapeRemnants(nesting, tileWidth, tileLength, cells, kerf) {
  const remnants = [];
  let reuseFitChecks = 0;
  for (const [sheetIndex, sheet] of nesting.sheets.entries()) {
    const occupied = sheet.placements.map((placement) => rectanglePolygon(
      placement.x,
      placement.y,
      placement.width,
      placement.height,
    ));
    const free = subtractMultiPolygon(rectanglePolygon(0, 0, tileWidth, tileLength), ...occupied);
    for (const [polygonIndex, polygon] of free.entries()) {
      const geometry = [polygon];
      const bounds = multiPolygonBounds(geometry);
      const areaMm2 = multiPolygonArea(geometry);
      if (!bounds || bounds.widthMm + EPSILON < MIN_REMNANT_SIDE || bounds.lengthMm + EPSILON < MIN_REMNANT_SIDE) continue;
      const reuseCandidates = [];
      for (const cell of cells) {
        if (cell.full || cell.stockTile === sheetIndex + 1
          || cell.w + kerf > bounds.widthMm + EPSILON
          || cell.h + kerf > bounds.lengthMm + EPSILON) continue;
        if (reuseFitChecks >= MAX_REUSE_FIT_CHECKS) break;
        reuseFitChecks += 1;
        if (rectangleFits(geometry, cell.w, cell.h, kerf)) reuseCandidates.push({ cellId: cell.id, pieceIds: cell.pieceIds });
        if (reuseCandidates.length >= 8) break;
      }
      remnants.push({
        id: `offcut-${sheetIndex + 1}-${polygonIndex + 1}`,
        stockTile: sheetIndex + 1,
        x: bounds.minX,
        y: bounds.minY,
        w: bounds.widthMm,
        h: bounds.lengthMm,
        areaMm2,
        qty: 1,
        geometry,
        shape: polygon.length > 1 || polygon[0]?.length > 5 ? "polygon" : "rectangle",
        reuseCandidates,
        reuseBasis: "cut bounding box plus kerf must fit inside the offcut shape",
      });
    }
  }
  return remnants.sort((a, b) => b.areaMm2 - a.areaMm2);
}

/**
 * Lay axis-aligned tile stock over a polygonal footprint, clipping each tile
 * against room zones, floor openings, and obstacles. Diagonal patterns rotate
 * the room into tile coordinates for calculation and back for display.
 */
export function buildPolygonLayout({ roomGeometry, tileWidth, tileLength, grout, kerf, pattern = "straight" }) {
  let footprint = roomFootprint(roomGeometry);
  if (!footprint.length) return { error: "The room geometry has no installable floor area." };
  const originalBounds = multiPolygonBounds(footprint);
  const diagonal = pattern === "diagonal";
  const angle = diagonal ? Math.PI / 4 : 0;
  if (diagonal) {
    const centerX = (originalBounds.minX + originalBounds.maxX) / 2;
    const centerY = (originalBounds.minY + originalBounds.maxY) / 2;
    footprint = rotateMultiPolygon(footprint, -angle, centerX, centerY);
  }
  const layoutBounds = multiPolygonBounds(footprint);
  const columnGrid = centeredAxis(layoutBounds.minX, layoutBounds.maxX, tileWidth, grout);
  const rowGrid = centeredAxis(layoutBounds.minY, layoutBounds.maxY, tileLength, grout);
  const maxCandidates = rowGrid.count * (columnGrid.count + (pattern === "half-offset" ? 2 : 0));
  if (maxCandidates > MAX_POLYGON_CELLS) {
    return { error: `This geometry would create more than ${MAX_POLYGON_CELLS} tile positions. Increase the tile size or simplify the room outline.` };
  }

  const cells = [];
  const pieces = [];
  const minColumn = -1;
  let maxColumn = columnGrid.count;
  let cellIndex = 0;
  for (let row = 0; row < rowGrid.count; row += 1) {
    const tileY = rowGrid.start + row * rowGrid.pitch;
    const shift = pattern === "half-offset" && row % 2 === 1 ? columnGrid.pitch / 2 : 0;
    const range = cellColumnRange(columnGrid, layoutBounds.minX, layoutBounds.maxX, shift, tileWidth);
    maxColumn = Math.max(maxColumn, range.last);
    for (let column = range.first; column <= range.last; column += 1) {
      const tileX = columnGrid.start + shift + column * columnGrid.pitch;
      const fragment = intersectWithRectangle(footprint, tileX, tileY, tileWidth, tileLength);
      const areaMm2 = multiPolygonArea(fragment);
      if (areaMm2 <= EPSILON) continue;
      cellIndex += 1;
      const bounds = multiPolygonBounds(fragment);
      const full = isFullCell(fragment, tileWidth, tileLength);
      const cell = {
        id: `cell-${cellIndex}`,
        number: cellIndex,
        row: row + 1,
        column: column + 1,
        tileX,
        tileY,
        w: bounds.widthMm,
        h: bounds.lengthMm,
        areaMm2,
        full,
        geometry: fragment,
        pieceIds: [],
      };
      cells.push(cell);

      for (const polygon of fragment) {
        const geometry = [polygon];
        const pieceBounds = multiPolygonBounds(geometry);
        const pieceFull = fragment.length === 1 && full;
        const number = pieces.length + 1;
        const displayGeometry = diagonal
          ? rotateMultiPolygon(geometry, angle, (originalBounds.minX + originalBounds.maxX) / 2, (originalBounds.minY + originalBounds.maxY) / 2)
          : geometry;
        const displayBounds = multiPolygonBounds(displayGeometry);
        const edges = [];
        if (Math.abs(displayBounds.minX - originalBounds.minX) < EPSILON) edges.push("Left");
        if (Math.abs(displayBounds.maxX - originalBounds.maxX) < EPSILON) edges.push("Right");
        if (Math.abs(displayBounds.minY - originalBounds.minY) < EPSILON) edges.push("Top");
        if (Math.abs(displayBounds.maxY - originalBounds.maxY) < EPSILON) edges.push("Bottom");
        const piece = {
          id: `P-${String(number).padStart(4, "0")}`,
          number,
          sourceCellId: cell.id,
          row: cell.row,
          column: cell.column,
          x: displayBounds.minX,
          y: displayBounds.minY,
          displayW: displayBounds.widthMm,
          displayH: displayBounds.lengthMm,
          w: pieceBounds.widthMm,
          h: pieceBounds.lengthMm,
          full: pieceFull,
          shape: shapeKind(polygon, pieceFull),
          edges,
          location: edges.length ? edges.join("-") : "Interior",
          areaMm2: multiPolygonArea(geometry),
          geometry: displayGeometry,
          layoutGeometry: geometry,
        };
        pieces.push(piece);
        cell.pieceIds.push(piece.id);
      }
    }
  }
  if (!cells.length) return { error: "No tile positions intersect the installable floor area." };

  const packedCells = cells.map((cell) => ({ number: cell.number, w: cell.w, h: cell.h, full: cell.full }));
  const nesting = nestPieces(packedCells, tileWidth, tileLength, kerf);
  const byNumber = new Map(packedCells.map((cell) => [cell.number, cell]));
  for (const cell of cells) {
    const packed = byNumber.get(cell.number);
    cell.stockTile = packed.stockTile;
    cell.stockX = packed.stockX;
    cell.stockY = packed.stockY;
  }
  const cellById = new Map(cells.map((cell) => [cell.id, cell]));
  for (const piece of pieces) {
    const cell = cellById.get(piece.sourceCellId);
    piece.stockTile = cell.stockTile;
    piece.stockX = cell.stockX;
    piece.stockY = cell.stockY;
  }

  const cutPieces = pieces.filter((piece) => !piece.full);
  const scheduleMap = new Map();
  for (const piece of pieces) {
    const key = `${Math.round(piece.w * 100)}x${Math.round(piece.h * 100)}:${piece.shape}:${piece.full}`;
    const entry = scheduleMap.get(key) || {
      w: piece.w,
      h: piece.h,
      shape: piece.shape,
      full: piece.full,
      qty: 0,
      locations: new Set(),
      pieceIds: [],
    };
    entry.qty += 1;
    entry.locations.add(piece.location);
    entry.pieceIds.push(piece.id);
    scheduleMap.set(key, entry);
  }
  const schedule = [...scheduleMap.values()].sort((a, b) => a.full === b.full ? b.w * b.h - a.w * a.h : a.full ? -1 : 1);
  const remnants = buildShapeRemnants(nesting, tileWidth, tileLength, cells, kerf);
  const cutPaths = cutPieces.reduce((sum, piece) => sum + piece.layoutGeometry.reduce((ringCount, polygon) => ringCount + polygon.length, 0), 0);
  const displayFootprint = diagonal
    ? rotateMultiPolygon(footprint, angle, (originalBounds.minX + originalBounds.maxX) / 2, (originalBounds.minY + originalBounds.maxY) / 2)
    : footprint;

  return {
    columns: Array.from({ length: Math.max(1, maxColumn - minColumn + 1) }, (_, index) => index),
    rows: Array.from({ length: rowGrid.count }, (_, index) => index),
    cells,
    pieces,
    cutPieces,
    fullCount: pieces.filter((piece) => piece.full).length,
    cutPaths,
    cutEdges: cutPaths,
    schedule,
    stockTiles: nesting.stockTiles,
    remnants,
    remnantCount: remnants.length,
    remnantArea: remnants.reduce((sum, remnant) => sum + remnant.areaMm2, 0),
    floorAreaMm2: multiPolygonArea(displayFootprint),
    bounds: originalBounds,
    footprint: displayFootprint,
    pattern,
  };
}
