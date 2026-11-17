function ringVertices(ring = []) {
  if (ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]) return ring.slice(0, -1);
  return ring;
}

function isConcave(ring) {
  if (ring.length < 4) return false;
  const signs = new Set();
  for (let index = 0; index < ring.length; index += 1) {
    const a = ring[index];
    const b = ring[(index + 1) % ring.length];
    const c = ring[(index + 2) % ring.length];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) > 1e-7) signs.add(Math.sign(cross));
  }
  return signs.size > 1;
}

export function classifyRoomShape(roomGeometry) {
  const zones = roomGeometry?.zones;
  if (!Array.isArray(zones) || !zones.length) return "Rectangle";
  if (zones.length > 1) return "Multiple zones";
  if (zones.some((zone) => zone.obstacles?.length || zone.openings?.length)) return "Room with obstacles or openings";
  const ring = ringVertices(zones[0]?.boundary || []);
  if (ring.length === 4) {
    const xs = new Set(ring.map(([x]) => x));
    const ys = new Set(ring.map(([, y]) => y));
    if (xs.size === 2 && ys.size === 2) return "Rectangle";
  }
  if (isConcave(ring) && ring.length === 6) return "L-shaped";
  if (isConcave(ring)) return "Irregular concave";
  return "Irregular polygon";
}

export function classifyRoomSize(roomAreaMm2) {
  const area = Number(roomAreaMm2);
  if (!Number.isFinite(area) || area <= 0) return "Unknown size";
  const areaM2 = area / 1_000_000;
  if (areaM2 < 10) return "Under 10 m²";
  if (areaM2 < 30) return "10–30 m²";
  return "30 m² and over";
}

export function formatTileCohort(width, length) {
  const dimensions = [Number(width), Number(length)].sort((a, b) => a - b);
  return dimensions.every(Number.isFinite) ? `${dimensions[0]} × ${dimensions[1]} mm` : "Unknown format";
}
