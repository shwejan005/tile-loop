import { createHash } from "node:crypto";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { createClient } from "../../../lib/supabase/server.js";
import { formatNumber } from "../../../lib/planner.js";

export const metadata = {
  title: "Shared TileLoop project",
  robots: { index: false, follow: false },
};

function outlinePath(geometry) {
  return (geometry?.zones || []).map((zone) => (
    `M${zone.boundary.map(([x, y]) => `${x},${y}`).join(" L")} Z`
  )).join(" ");
}

function piecePath(geometry) {
  return geometry.flatMap((polygon) => polygon.map((ring) => (
    `M${ring.map(([x, y]) => `${x},${y}`).join(" L")} Z`
  ))).join(" ");
}

function SharedPlanDrawing({ plan }) {
  const snapshot = plan.snapshot;
  const inputs = snapshot?.inputs || {};
  const summary = snapshot?.result_summary || {};
  const roomGeometry = inputs.roomGeometry;
  const boundaries = (roomGeometry?.zones || []).flatMap((zone) => zone.boundary || []);
  const minX = boundaries.length ? Math.min(...boundaries.map(([x]) => x)) : 0;
  const minY = boundaries.length ? Math.min(...boundaries.map(([, y]) => y)) : 0;
  const width = Number(inputs.roomWidthMm || plan.room_width_mm);
  const height = Number(inputs.roomLengthMm || plan.room_length_mm);

  return (
    <svg className="shared-layout" viewBox={`${minX} ${minY} ${width} ${height}`} role="img" aria-label={`Numbered tile layout for ${plan.label}`}>
      <rect x={minX} y={minY} width={width} height={height} fill="#f4f7f7" />
      {(summary.pieces || []).map((piece, index) => <g key={piece.id || index}>
        {piece.geometry?.length
          ? <path d={piecePath(piece.geometry)} fill={piece.full ? "#e5eff0" : "#72d5dd"} stroke="#fff" strokeWidth="5" fillRule="evenodd" />
          : <rect x={piece.x} y={piece.y} width={piece.w} height={piece.h} fill={piece.full ? "#e5eff0" : "#72d5dd"} stroke="#fff" strokeWidth="5" />}
        {piece.w > 180 && piece.h > 180 && <text x={piece.x + piece.w / 2} y={piece.y + piece.h / 2} textAnchor="middle" dominantBaseline="central" fontSize="90" fill="#2c4246">{piece.id || index + 1}</text>}
      </g>)}
      {roomGeometry && <path d={outlinePath(roomGeometry)} fill="none" stroke="#1b8791" strokeWidth="12" />}
    </svg>
  );
}

export default async function SharedProjectPage({ params }) {
  await connection();
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    notFound();
  }
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await supabase.rpc("get_shared_project", { p_token_hash: tokenHash });
  if (error || !data) notFound();

  return (
    <div className="app-shell shared-shell">
      <header className="shared-topbar"><a className="brand" href="/">TileLoop</a><span>READ-ONLY PROJECT</span></header>
      <main className="shared-project">
        <div className="shared-heading"><span className="field-kicker">CUSTOMER PREVIEW / VIEW ONLY</span><h1>{data.name}</h1><p>Shared TileLoop installation plans. This page does not allow edits.</p></div>
        {data.plans.map((plan) => {
          const summary = plan.snapshot?.result_summary || {};
          const layout = plan.snapshot?.inputs?.layout || {};
          const pieces = summary.pieces || [];
          return <section className="shared-plan" key={plan.label}>
            <div className="shared-plan-heading"><div><span className="field-kicker">SURFACE / {plan.label}</span><h2>{formatNumber(plan.room_width_mm)} × {formatNumber(plan.room_length_mm)} mm</h2><p>{formatNumber(plan.tile_width_mm)} × {formatNumber(plan.tile_length_mm)} mm tile · {formatNumber(plan.grout_mm)} mm grout · {layout.pattern || "straight"} lay</p></div><div className="shared-plan-metrics"><strong>{summary.orderQuantity ?? "—"}<small>suggested tiles</small></strong><span>{summary.cutPieceCount ?? "—"} cuts · {pieces.length} pieces</span></div></div>
            <SharedPlanDrawing plan={plan} />
          </section>;
        })}
        {!data.plans.length && <p className="shared-empty">This project has no saved surface plans yet.</p>}
        <p className="shared-footer">TileLoop estimates are planning references. Confirm all measurements and material quantities on site.</p>
      </main>
    </div>
  );
}
