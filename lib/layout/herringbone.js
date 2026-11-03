import { nestPieces } from "../cutting/nesting.js";
import {
  intersectWithRectangle,
  multiPolygonArea,
  multiPolygonBounds,
  roomFootprint,
  transformMultiPolygon,
} from "../geometry/operations.js";
import { buildShapeRemnants } from "./polygon.js";

const EPSILON = 1e-7;
const MAX_CANDIDATES = 2_000;

function addDominoBlock(tiles, blockX, blockY, unit) {
  const originX = blockX * 6 * unit;
  const originY = blockY * 4 * unit;
  for (const row of [0, 1]) {
    for (const column of [1, 4]) {
      tiles.push({
        baseX: originX + column * unit,
        baseY: originY + row * unit,
        width: 2 * unit,
        height: unit,
        orientation: "horizontal",
        baseRow: blockY * 4 + row,
      });
    }
  }
  for (const column of [0, 3]) {
    tiles.push({
      baseX: originX + column * unit,
      baseY: originY,
      width: unit,
      height: 2 * unit,
      orientation: "vertical",
      baseRow: blockY * 4,
    });
  }
  for (const row of [2, 3]) {
    for (const column of [0, 3]) {
      tiles.push({
        baseX: originX + column * unit,
        baseY: originY + row * unit,
        width: 2 * unit,
        height: unit,
        orientation: "horizontal",
        baseRow: blockY * 4 + row,
      });
    }
  }
  for (const column of [2, 5]) {
    tiles.push({
      baseX: originX + column * unit,
      baseY: originY + 2 * unit,
      width: unit,
      height: 2 * unit,
      orientation: "vertical",
      baseRow: blockY * 4 + 2,
    });
  }
}

function adjacencyGraph(tiles, axis) {
  const sizeKey = axis === "x" ? "width" : "height";
  const otherPosition = axis === "x" ? "baseY" : "baseX";
  const otherSize = axis === "x" ? "height" : "width";
  const starts = new Map();
  const ends = new Map();
  const keyFor = (value) => String(Math.round(value * 1000) / 1000);
  for (const [index, tile] of tiles.entries()) {
    const start = axis === "x" ? tile.baseX : tile.baseY;
    const end = start + tile[sizeKey];
    const startKey = keyFor(start);
    const endKey = keyFor(end);
    starts.set(startKey, [...(starts.get(startKey) || []), index]);
    ends.set(endKey, [...(ends.get(endKey) || []), index]);
  }
  const outgoing = tiles.map(() => []);
  for (const [edge, leftTiles] of ends) {
    const rightTiles = starts.get(edge) || [];
    for (const leftIndex of leftTiles) {
      for (const rightIndex of rightTiles) {
        if (leftIndex === rightIndex) continue;
        const left = tiles[leftIndex];
        const right = tiles[rightIndex];
        const overlap = Math.min(left[otherPosition] + left[otherSize], right[otherPosition] + right[otherSize])
          - Math.max(left[otherPosition], right[otherPosition]);
        if (overlap > EPSILON) outgoing[leftIndex].push(rightIndex);
      }
    }
  }
  return outgoing;
}

function applyJointSpacing(tiles, axis, grout) {
  const positionKey = axis === "x" ? "baseX" : "baseY";
  const sizeKey = axis === "x" ? "width" : "height";
  const positions = tiles.map((tile) => tile[positionKey]);
  const outgoing = adjacencyGraph(tiles, axis);
  const order = tiles.map((_, index) => index).sort((a, b) => tiles[a][positionKey] - tiles[b][positionKey]);
  for (const source of order) {
    for (const destination of outgoing[source]) {
      positions[destination] = Math.max(positions[destination], positions[source] + tiles[source][sizeKey] + grout);
    }
  }
  return positions;
}

function hasOverlappingTiles(tiles) {
  for (let i = 0; i < tiles.length; i += 1) {
    for (let j = i + 1; j < tiles.length; j += 1) {
      const overlapX = Math.min(tiles[i].x + tiles[i].width, tiles[j].x + tiles[j].width)
        - Math.max(tiles[i].x, tiles[j].x);
      const overlapY = Math.min(tiles[i].y + tiles[i].height, tiles[j].y + tiles[j].height)
        - Math.max(tiles[i].y, tiles[j].y);
      if (overlapX > EPSILON && overlapY > EPSILON) return true;
    }
  }
  return false;
}

function classifyShape(polygon, full) {
  if (full) return "rectangle";
  if (polygon.length !== 1 || polygon[0].length !== 5) return "polygon";
  const bounds = multiPolygonBounds([polygon]);
  const corners = new Set(polygon[0].slice(0, -1).map(([x, y]) => `${x === bounds.minX || x === bounds.maxX ? x : "_"}:${y === bounds.minY || y === bounds.maxY ? y : "_"}`));
  return corners.size === 4 ? "rectangle" : "polygon";
}

function scheduleForPieces(pieces) {
  const groups = new Map();
  for (const piece of pieces) {
    const key = `${Math.round(piece.w * 100)}x${Math.round(piece.h * 100)}:${piece.shape}:${piece.full}`;
    const entry = groups.get(key) || { w: piece.w, h: piece.h, shape: piece.shape, full: piece.full, qty: 0, locations: new Set(), pieceIds: [] };
    entry.qty += 1;
    entry.locations.add(piece.location);
    entry.pieceIds.push(piece.id);
    groups.set(key, entry);
  }
  return [...groups.values()].sort((a, b) => a.full === b.full ? b.w * b.h - a.w * a.h : a.full ? -1 : 1);
}

/** 90-degree herringbone for 2:1 rectangular stock using a repeating domino weave. */
export function buildHerringboneLayout({ roomGeometry, tileWidth, tileLength, grout, kerf }) {
  const short = Math.min(tileWidth, tileLength);
  const long = Math.max(tileWidth, tileLength);
  if (Math.abs(long - 2 * short) > short * 0.01) {
    return { error: "Herringbone requires a rectangular tile format with a 2:1 long-to-short-side ratio." };
  }
  const footprint = roomFootprint(roomGeometry);
  if (!footprint.length) return { error: "The room geometry has no installable floor area." };
  const bounds = multiPolygonBounds(footprint);
  const firstBlockX = Math.floor(bounds.minX / (6 * short)) - 2;
  const lastBlockX = Math.ceil(bounds.maxX / (6 * short)) + 2;
  const firstBlockY = Math.floor(bounds.minY / (4 * short)) - 2;
  const lastBlockY = Math.ceil(bounds.maxY / (4 * short)) + 2;
  const candidateCount = (lastBlockX - firstBlockX + 1) * (lastBlockY - firstBlockY + 1) * 12;
  if (candidateCount > MAX_CANDIDATES) return { error: `Herringbone is limited to ${MAX_CANDIDATES} candidate tiles per room.` };

  const tiles = [];
  for (let blockY = firstBlockY; blockY <= lastBlockY; blockY += 1) {
    for (let blockX = firstBlockX; blockX <= lastBlockX; blockX += 1) addDominoBlock(tiles, blockX, blockY, short);
  }
  const xPositions = applyJointSpacing(tiles, "x", grout);
  const yPositions = applyJointSpacing(tiles, "y", grout);
  tiles.forEach((tile, index) => {
    tile.x = xPositions[index];
    tile.y = yPositions[index];
  });
  if (hasOverlappingTiles(tiles)) return { error: "This herringbone joint layout overlaps. Adjust the room or grout settings." };

  const patternMinX = Math.min(...tiles.map((tile) => tile.x));
  const patternMaxX = Math.max(...tiles.map((tile) => tile.x + tile.width));
  const patternMinY = Math.min(...tiles.map((tile) => tile.y));
  const patternMaxY = Math.max(...tiles.map((tile) => tile.y + tile.height));
  const shiftX = (bounds.minX + bounds.maxX - patternMinX - patternMaxX) / 2;
  const shiftY = (bounds.minY + bounds.maxY - patternMinY - patternMaxY) / 2;
  const placements = tiles.map((tile) => ({ ...tile, x: tile.x + shiftX, y: tile.y + shiftY }))
    .filter((tile) => tile.x < bounds.maxX && tile.x + tile.width > bounds.minX
      && tile.y < bounds.maxY && tile.y + tile.height > bounds.minY);

  const cells = [];
  const pieces = [];
  for (const tile of placements) {
    const fragment = intersectWithRectangle(footprint, tile.x, tile.y, tile.width, tile.height);
    if (multiPolygonArea(fragment) <= EPSILON) continue;
    const localGeometry = tile.orientation === "horizontal"
      ? transformMultiPolygon(fragment, ([x, y]) => [x - tile.x, y - tile.y])
      : transformMultiPolygon(fragment, ([x, y]) => [y - tile.y, short - (x - tile.x)]);
    const cellBounds = multiPolygonBounds(localGeometry);
    const full = Math.abs(multiPolygonArea(localGeometry) - long * short) <= Math.max(EPSILON, long * short * 1e-10);
    const cell = {
      id: `cell-${cells.length + 1}`,
      number: cells.length + 1,
      row: tile.baseRow + 1,
      column: Math.round((tile.baseX - (firstBlockX * 6 * short)) / short) + 1,
      orientation: tile.orientation,
      w: cellBounds.widthMm,
      h: cellBounds.lengthMm,
      areaMm2: multiPolygonArea(localGeometry),
      full,
      geometry: localGeometry,
      pieceIds: [],
      stockWidth: long,
      stockLength: short,
    };
    cells.push(cell);

    for (const polygon of fragment) {
      const globalGeometry = [polygon];
      const globalBounds = multiPolygonBounds(globalGeometry);
      const localPolygon = localGeometry[fragment.indexOf(polygon)] ? [localGeometry[fragment.indexOf(polygon)]] : localGeometry;
      const localBounds = multiPolygonBounds(localPolygon);
      const number = pieces.length + 1;
      const edges = [];
      if (Math.abs(globalBounds.minX - bounds.minX) < EPSILON) edges.push("Left");
      if (Math.abs(globalBounds.maxX - bounds.maxX) < EPSILON) edges.push("Right");
      if (Math.abs(globalBounds.minY - bounds.minY) < EPSILON) edges.push("Top");
      if (Math.abs(globalBounds.maxY - bounds.maxY) < EPSILON) edges.push("Bottom");
      const pieceFull = full && fragment.length === 1;
      const piece = {
        id: `P-${String(number).padStart(4, "0")}`,
        number,
        sourceCellId: cell.id,
        row: cell.row,
        column: cell.column,
        x: globalBounds.minX,
        y: globalBounds.minY,
        displayW: globalBounds.widthMm,
        displayH: globalBounds.lengthMm,
        w: localBounds.widthMm,
        h: localBounds.lengthMm,
        full: pieceFull,
        shape: classifyShape(localPolygon[0], pieceFull),
        edges,
        location: edges.length ? edges.join("-") : "Interior",
        areaMm2: multiPolygonArea(globalGeometry),
        geometry: globalGeometry,
        layoutGeometry: localPolygon,
      };
      pieces.push(piece);
      cell.pieceIds.push(piece.id);
    }
  }
  if (!cells.length) return { error: "No herringbone tiles intersect the installable floor area." };

  const packedCells = cells.map((cell) => ({ number: cell.number, w: cell.w, h: cell.h, full: cell.full }));
  const nesting = nestPieces(packedCells, long, short, kerf);
  const packedByNumber = new Map(packedCells.map((cell) => [cell.number, cell]));
  const cellById = new Map();
  cells.forEach((cell) => {
    const packed = packedByNumber.get(cell.number);
    cell.stockTile = packed.stockTile;
    cell.stockX = packed.stockX;
    cell.stockY = packed.stockY;
    cellById.set(cell.id, cell);
  });
  for (const piece of pieces) {
    const cell = cellById.get(piece.sourceCellId);
    piece.stockTile = cell.stockTile;
    piece.stockX = cell.stockX;
    piece.stockY = cell.stockY;
  }

  const remnants = buildShapeRemnants(nesting, long, short, cells, kerf);
  const cutPieces = pieces.filter((piece) => !piece.full);
  const cutPaths = cutPieces.reduce((count, piece) => count + piece.layoutGeometry.reduce((sum, polygon) => sum + polygon.length, 0), 0);
  return {
    columns: Array.from({ length: Math.ceil(bounds.widthMm / short) }, (_, index) => index),
    rows: Array.from({ length: Math.ceil(bounds.lengthMm / short) }, (_, index) => index),
    cells,
    pieces,
    cutPieces,
    fullCount: pieces.filter((piece) => piece.full).length,
    cutPaths,
    cutEdges: cutPaths,
    schedule: scheduleForPieces(pieces),
    stockTiles: nesting.stockTiles,
    stockTileWidth: long,
    stockTileLength: short,
    remnants,
    remnantCount: remnants.length,
    remnantArea: remnants.reduce((sum, remnant) => sum + remnant.areaMm2, 0),
    floorAreaMm2: multiPolygonArea(footprint),
    bounds,
    footprint,
    pattern: "herringbone",
    layoutWarnings: ["Herringbone joints may widen at some T-junctions; verify the set-out and grout gaps with the installer."],
  };
}
