const EPSILON = 1e-7;
const nearlyEqual = (a, b) => Math.abs(a - b) < EPSILON;

function axisPieces(length, tileSize, grout) {
  if (length <= tileSize + EPSILON) return [length];
  const count = Math.max(2, Math.ceil((length + grout) / (tileSize + grout)));
  const edge = (length - (count - 2) * tileSize - (count - 1) * grout) / 2;
  if (!(edge > 0 && edge <= tileSize + EPSILON)) throw new Error("Could not create a valid centered edge cut.");
  return [edge, ...Array.from({ length: count - 2 }, () => tileSize), edge];
}

/** Build a centered straight-lay grid. Other patterns implement this same placement contract. */
export function buildCenteredStraightLayout({ roomWidth, roomLength, tileWidth, tileLength, grout, maxPieces = 10_000 }) {
  const columns = axisPieces(roomWidth, tileWidth, grout);
  const rows = axisPieces(roomLength, tileLength, grout);
  if (columns.length * rows.length > maxPieces) {
    return { error: "This room would create more than 10,000 pieces. Increase the tile size or check your dimensions." };
  }
  const pieces = [];
  let number = 1;
  let y = 0;

  for (let row = 0; row < rows.length; row += 1) {
    let x = 0;
    for (let column = 0; column < columns.length; column += 1) {
      const w = columns[column];
      const h = rows[row];
      const edges = [];
      if (row === 0) edges.push("Top");
      if (row === rows.length - 1 && rows.length > 1) edges.push("Bottom");
      if (column === 0) edges.push("Left");
      if (column === columns.length - 1 && columns.length > 1) edges.push("Right");
      pieces.push({
        number,
        row,
        column,
        x,
        y,
        w,
        h,
        full: nearlyEqual(w, tileWidth) && nearlyEqual(h, tileLength),
        edges,
        location: edges.length ? edges.join("-") : "Interior",
      });
      number += 1;
      x += w + (column < columns.length - 1 ? grout : 0);
    }
    y += rows[row] + (row < rows.length - 1 ? grout : 0);
  }
  return { columns, rows, pieces };
}
