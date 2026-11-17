const COLUMNS = [
  "room_plan_id",
  "room_width_mm",
  "room_length_mm",
  "pattern",
  "tile_width_mm",
  "tile_length_mm",
  "grout_mm",
  "kerf_mm",
  "order_buffer_percent",
  "planned_stock_tiles",
  "order_quantity_tiles",
  "cartons_to_order",
  "piece_id",
  "source_stock_tile_id",
  "piece_width_mm",
  "piece_length_mm",
  "quantity",
  "position_x_mm",
  "position_y_mm",
  "location",
  "orientation",
  "stock_piece_orientation",
  "piece_type",
  "reuse_status",
];

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** Export one row per positioned piece so identical cuts retain their locations. */
export function cutListToCsv(plan) {
  if (!plan || plan.error || !Array.isArray(plan.pieces)) throw new TypeError("A calculated tile plan is required for cut-list export.");
  const rows = plan.pieces.map((piece) => [
    plan.planId,
    plan.roomWidth,
    plan.roomLength,
    plan.pattern,
    plan.tileWidth,
    plan.tileLength,
    plan.grout,
    plan.kerf,
    plan.reserve,
    plan.stockTiles,
    plan.orderQuantity,
    plan.cartonsToOrder ?? "",
    piece.id || `P-${String(piece.number).padStart(4, "0")}`,
    piece.stockTile == null ? "" : `STOCK-${String(piece.stockTile).padStart(4, "0")}`,
    piece.w,
    piece.h,
    1,
    piece.x,
    piece.y,
    piece.location,
    plan.orientation,
    piece.stockRotated ? "rotated 90° on stock" : "entered direction",
    piece.full ? "full" : "cut",
    "prior-job offcut reuse not modeled",
  ]);
  return [COLUMNS, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function planSvg(plan) {
  const bounds = plan.bounds || { minX: 0, minY: 0 };
  const pathFor = (geometry) => geometry.flatMap((polygon) => polygon.map((ring) => (
    ring.map(([x, y], index) => `${index ? "L" : "M"}${x - bounds.minX},${y - bounds.minY}`).join(" ") + " Z"
  ))).join(" ");
  const pieces = plan.pieces.map((piece) => {
    const x = piece.x - bounds.minX;
    const y = piece.y - bounds.minY;
    const shape = piece.geometry?.length
      ? `<path d="${pathFor(piece.geometry)}" fill="${piece.full ? "#e6eef0" : "#59d9e8"}" fill-rule="evenodd" stroke="#67777b" stroke-width="8"/>`
      : `<rect x="${x}" y="${y}" width="${piece.w}" height="${piece.h}" fill="${piece.full ? "#e6eef0" : "#59d9e8"}" stroke="#67777b" stroke-width="8"/>`;
    const label = Math.min(piece.w, piece.h) > 180
      ? `<text x="${x + piece.w / 2}" y="${y + piece.h / 2}" text-anchor="middle" dominant-baseline="central" font-size="100">${escapeHtml(piece.id || piece.number)}</text>`
      : "";
    return `<g>${shape}${label}</g>`;
  }).join("");
  const footprint = plan.footprint?.length
    ? `<path d="${pathFor(plan.footprint)}" fill="none" stroke="#008b99" stroke-width="14" fill-rule="evenodd"/>`
    : `<rect width="${plan.roomWidth}" height="${plan.roomLength}" fill="none" stroke="#008b99" stroke-width="14"/>`;
  return `<svg class="plan" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${plan.roomWidth} ${plan.roomLength}" role="img" aria-label="Numbered tile layout">${pieces}${footprint}</svg>`;
}

/** Create a self-contained print page; the browser print dialog can save it as PDF. */
export function buildPrintableCutListHtml(plan) {
  if (!plan || plan.error || !Array.isArray(plan.pieces)) throw new TypeError("A calculated tile plan is required for printable cut-list export.");
  const rows = plan.pieces.map((piece) => `<tr>
    <td>${escapeHtml(piece.id || `P-${String(piece.number).padStart(4, "0")}`)}</td>
    <td>${escapeHtml(piece.stockTile == null ? "Unassigned" : `STOCK-${String(piece.stockTile).padStart(4, "0")}`)}</td>
    <td>${escapeHtml(piece.full ? "Full tile" : "Cut")}</td>
    <td>${escapeHtml(piece.w)} × ${escapeHtml(piece.h)} mm</td>
    <td>${escapeHtml(piece.location)}</td>
    <td>${escapeHtml(plan.orientation)}${piece.stockRotated ? " · rotated 90° on stock" : ""}</td>
    <td>Prior-job offcut reuse not modeled</td>
  </tr>`).join("");
  const cartons = plan.cartonsToOrder == null ? "Not specified" : plan.cartonsToOrder;
  const title = `TileLoop cut list · ${plan.planId}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title>
<style>
  @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font:10pt Arial,sans-serif;color:#172226;margin:0}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #008b99;padding-bottom:8px}h1{font-size:18pt;margin:0 0 4px}p{margin:3px 0;color:#526064}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:6px 16px;padding:10px 0}.summary div{border-bottom:1px solid #d3dcde;padding:4px 0}.summary b{display:block;font-size:8pt;color:#526064;margin-bottom:2px}.layout{max-height:105mm;text-align:center;page-break-inside:avoid}.plan{width:auto;height:auto;max-width:100%;max-height:100mm}.cuts{page-break-before:auto}table{width:100%;border-collapse:collapse;font-size:8pt}th,td{text-align:left;border:1px solid #aab6b8;padding:4px}th{background:#eaf1f2}tr{page-break-inside:avoid}.note{font-size:8pt;color:#526064;margin:8px 0}@media print{button{display:none}}
</style></head><body>
<header><div><h1>${escapeHtml(title)}</h1><p>Generated by TileLoop · Dimensions in millimetres</p></div><button onclick="window.print()">Print / Save as PDF</button></header>
<section class="summary">
  <div><b>Room</b>${escapeHtml(plan.roomWidth)} × ${escapeHtml(plan.roomLength)} mm</div>
  <div><b>Tile</b>${escapeHtml(plan.tileWidth)} × ${escapeHtml(plan.tileLength)} mm · ${escapeHtml(plan.orientation)}</div>
  <div><b>Pattern</b>${escapeHtml(plan.pattern)}</div>
  <div><b>Grout / saw kerf</b>${escapeHtml(plan.grout)} / ${escapeHtml(plan.kerf)} mm</div>
  <div><b>Planned stock</b>${escapeHtml(plan.stockTiles)} tiles</div>
  <div><b>Order with ${escapeHtml(plan.reserve)}% buffer</b>${escapeHtml(plan.orderQuantity)} tiles</div>
  <div><b>Cartons</b>${escapeHtml(cartons)}</div>
  <div><b>Numbered pieces</b>${escapeHtml(plan.pieces.length)}</div>
</section>
<figure class="layout">${planSvg(plan)}</figure>
<p class="note">Source stock IDs identify TileLoop's calculated stock allocation. This report does not allocate offcuts from previous jobs; confirm cuts and material on site.</p>
<section class="cuts"><table><thead><tr><th>Cut ID</th><th>Source tile</th><th>Type</th><th>Required size</th><th>Room location</th><th>Orientation</th><th>Reuse status</th></tr></thead><tbody>${rows}</tbody></table></section>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script></body></html>`;
}
