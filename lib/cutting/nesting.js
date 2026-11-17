export const MIN_REMNANT_SIDE = 150;
const EPSILON = 1e-7;

function splitFreeRect(free, piece) {
  const remainW = free.w - piece.w;
  const remainH = free.h - piece.h;
  if (remainW <= EPSILON && remainH <= EPSILON) return [];
  const result = [];
  if (remainW > remainH) {
    if (remainW > EPSILON) result.push({ x: free.x + piece.w, y: free.y, w: remainW, h: free.h });
    if (remainH > EPSILON) result.push({ x: free.x, y: free.y + piece.h, w: piece.w, h: remainH });
  } else {
    if (remainH > EPSILON) result.push({ x: free.x, y: free.y + piece.h, w: free.w, h: remainH });
    if (remainW > EPSILON) result.push({ x: free.x + piece.w, y: free.y, w: remainW, h: piece.h });
  }
  return result;
}

function compareScore(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function usefulRemnants(sheets) {
  let count = 0;
  let area = 0;
  for (const sheet of sheets) {
    for (const free of sheet.free) {
      if (free.w + EPSILON < MIN_REMNANT_SIDE || free.h + EPSILON < MIN_REMNANT_SIDE) continue;
      count += 1;
      area += free.w * free.h;
    }
  }
  return { count, area };
}

function packInOrder(pieces, tileWidth, tileLength, kerf, allowRotation, sortPieces) {
  const ordered = sortPieces(pieces.map((piece) => ({ ...piece })));
  const sheets = [];
  for (const piece of ordered) {
    const orientations = [{ w: piece.w, h: piece.h, rotated: false }];
    if (allowRotation && piece.rotatable === true && Math.abs(piece.w - piece.h) > EPSILON) {
      orientations.push({ w: piece.h, h: piece.w, rotated: true });
    }
    let best = null;
    for (let sheetIndex = 0; sheetIndex < sheets.length; sheetIndex += 1) {
      const sheet = sheets[sheetIndex];
      for (let freeIndex = 0; freeIndex < sheet.free.length; freeIndex += 1) {
        const free = sheet.free[freeIndex];
        for (const orientation of orientations) {
          const packedWidth = orientation.w + (orientation.w < tileWidth - EPSILON ? kerf : 0);
          const packedHeight = orientation.h + (orientation.h < tileLength - EPSILON ? kerf : 0);
          if (packedWidth > free.w + EPSILON || packedHeight > free.h + EPSILON) continue;
          const slackW = Math.max(0, free.w - packedWidth);
          const slackH = Math.max(0, free.h - packedHeight);
          const score = [Math.min(slackW, slackH), Math.max(slackW, slackH), sheetIndex, freeIndex, orientation.rotated ? 1 : 0];
          if (!best || compareScore(score, best.score) < 0) {
            best = { sheet, sheetIndex, free, freeIndex, score, orientation, packedWidth, packedHeight };
          }
        }
      }
    }
    if (!best) {
      for (const orientation of orientations) {
        const packedWidth = orientation.w + (orientation.w < tileWidth - EPSILON ? kerf : 0);
        const packedHeight = orientation.h + (orientation.h < tileLength - EPSILON ? kerf : 0);
        if (packedWidth > tileWidth + EPSILON || packedHeight > tileLength + EPSILON) continue;
        const sheet = { free: [{ x: 0, y: 0, w: tileWidth, h: tileLength }], placements: [] };
        sheets.push(sheet);
        best = {
          sheet,
          sheetIndex: sheets.length - 1,
          free: sheet.free[0],
          freeIndex: 0,
          orientation,
          packedWidth,
          packedHeight,
        };
        break;
      }
    }
    if (!best) {
      return { error: `Cut ${piece.number} does not fit the stock tile in an allowed orientation.` };
    }
    piece.stockTile = best.sheetIndex + 1;
    piece.stockX = best.free.x;
    piece.stockY = best.free.y;
    piece.stockRotated = best.orientation.rotated;
    piece.stockPackedWidth = best.packedWidth;
    piece.stockPackedHeight = best.packedHeight;
    best.sheet.placements.push({
      number: piece.number,
      x: piece.stockX,
      y: piece.stockY,
      width: best.packedWidth,
      height: best.packedHeight,
      rotated: best.orientation.rotated,
      full: best.packedWidth >= tileWidth - EPSILON && best.packedHeight >= tileLength - EPSILON,
    });
    best.sheet.free.splice(best.freeIndex, 1, ...splitFreeRect(best.free, { w: best.packedWidth, h: best.packedHeight }));
  }

  const remnants = usefulRemnants(sheets);
  return { sheets, stockTiles: sheets.length, usefulRemnantCount: remnants.count, usefulRemnantArea: remnants.area };
}

/** Choose the best result from deterministic guillotine packing orders. */
export function nestPieces(pieces, tileWidth, tileLength, kerf, { allowRotation = false } = {}) {
  const byArea = (items) => items.sort((a, b) => b.w * b.h - a.w * a.h
    || Math.max(b.w, b.h) - Math.max(a.w, a.h) || a.number - b.number);
  const byLongSide = (items) => items.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h)
    || b.w * b.h - a.w * a.h || a.number - b.number);
  const byWidth = (items) => items.sort((a, b) => b.w - a.w || b.h - a.h || a.number - b.number);
  const candidates = [byArea, byLongSide, byWidth]
    .map((sortPieces) => packInOrder(pieces, tileWidth, tileLength, kerf, allowRotation, sortPieces));
  const validCandidates = candidates.filter((candidate) => !candidate.error);
  if (!validCandidates.length) return candidates[0];
  validCandidates.sort((left, right) => left.stockTiles - right.stockTiles
    || right.usefulRemnantArea - left.usefulRemnantArea
    || left.usefulRemnantCount - right.usefulRemnantCount);
  const best = validCandidates[0];
  const packedByNumber = new Map(best.sheets.flatMap((sheet) => sheet.placements.map((placement) => [placement.number, placement])));
  for (const piece of pieces) {
    const placement = packedByNumber.get(piece.number);
    if (placement) Object.assign(piece, {
      stockTile: best.sheets.findIndex((sheet) => sheet.placements.includes(placement)) + 1,
      stockX: placement.x,
      stockY: placement.y,
      stockRotated: placement.rotated,
      stockPackedWidth: placement.width,
      stockPackedHeight: placement.height,
    });
  }

  const remnantsBySize = new Map();
  let remnantArea = 0;
  for (const sheet of best.sheets) {
    for (const free of sheet.free) {
      if (free.w + EPSILON < MIN_REMNANT_SIDE || free.h + EPSILON < MIN_REMNANT_SIDE) continue;
      remnantArea += free.w * free.h;
      const key = `${Math.round(free.w * 100) / 100}x${Math.round(free.h * 100) / 100}`;
      const previous = remnantsBySize.get(key) || { w: free.w, h: free.h, qty: 0, area: 0 };
      previous.qty += 1;
      previous.area += free.w * free.h;
      remnantsBySize.set(key, previous);
    }
  }
  const remnants = [...remnantsBySize.values()].sort((a, b) => b.area - a.area);
  return {
    stockTiles: best.stockTiles,
    sheets: best.sheets,
    remnants,
    remnantCount: remnants.reduce((sum, entry) => sum + entry.qty, 0),
    remnantArea,
  };
}
