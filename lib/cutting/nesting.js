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

/** Deterministic non-rotating guillotine packing by conservative piece bounds. */
export function nestPieces(pieces, tileWidth, tileLength, kerf) {
  const ordered = [...pieces].sort((a, b) => {
    const areaDifference = b.w * b.h - a.w * a.h;
    if (Math.abs(areaDifference) > 0.01) return areaDifference;
    return Math.max(b.w, b.h) - Math.max(a.w, a.h) || a.number - b.number;
  });
  const sheets = [];
  for (const piece of ordered) {
    const packedWidth = piece.w + (piece.w < tileWidth - EPSILON ? kerf : 0);
    const packedHeight = piece.h + (piece.h < tileLength - EPSILON ? kerf : 0);
    let best = null;
    for (let sheetIndex = 0; sheetIndex < sheets.length; sheetIndex += 1) {
      const sheet = sheets[sheetIndex];
      for (let freeIndex = 0; freeIndex < sheet.free.length; freeIndex += 1) {
        const free = sheet.free[freeIndex];
        if (packedWidth > free.w + EPSILON || packedHeight > free.h + EPSILON) continue;
        const slackW = Math.max(0, free.w - packedWidth);
        const slackH = Math.max(0, free.h - packedHeight);
        const score = [Math.min(slackW, slackH), Math.max(slackW, slackH), sheetIndex, freeIndex];
        const isBetter = !best || score.some((value, index) => value < best.score[index]
          && score.slice(0, index).every((prior, i) => prior === best.score[i]));
        if (isBetter) best = { sheet, sheetIndex, free, freeIndex, score };
      }
    }
    if (!best) {
      const sheet = { free: [{ x: 0, y: 0, w: tileWidth, h: tileLength }], placements: [] };
      sheets.push(sheet);
      best = { sheet, sheetIndex: sheets.length - 1, free: sheet.free[0], freeIndex: 0 };
    }
    piece.stockTile = best.sheetIndex + 1;
    piece.stockX = best.free.x;
    piece.stockY = best.free.y;
    best.sheet.placements.push({
      number: piece.number,
      x: piece.stockX,
      y: piece.stockY,
      width: packedWidth,
      height: packedHeight,
      full: packedWidth >= tileWidth - EPSILON && packedHeight >= tileLength - EPSILON,
    });
    best.sheet.free.splice(best.freeIndex, 1, ...splitFreeRect(best.free, { w: packedWidth, h: packedHeight }));
  }

  const remnantsBySize = new Map();
  let remnantArea = 0;
  for (const sheet of sheets) {
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
    stockTiles: sheets.length,
    sheets,
    remnants,
    remnantCount: remnants.reduce((sum, entry) => sum + entry.qty, 0),
    remnantArea,
  };
}
