import Link from "next/link";
import { calculatePlan, formatNumber } from "../lib/planner.js";
import { createDemoForm } from "../lib/demo-sample.js";

function geometryPath(geometry, mapX, mapY) {
  return (geometry || []).flatMap((polygon) => polygon.map((ring) => (
    `${ring.map(([x, y], index) => `${index ? "L" : "M"}${mapX(x)},${mapY(y)}`).join(" ")} Z`
  ))).join(" ");
}

function piecePath(piece, mapX, mapY) {
  if (piece.geometry?.length) return geometryPath(piece.geometry, mapX, mapY);
  return `M${mapX(piece.x)},${mapY(piece.y)} h${piece.w} v${piece.h} h${-piece.w} Z`;
}

export default function LandingProductPreview() {
  const plan = calculatePlan(createDemoForm());

  if (plan.error) return null;

  const bounds = plan.bounds || { minX: 0, minY: 0 };
  const width = bounds.widthMm ?? plan.roomWidth;
  const length = bounds.lengthMm ?? plan.roomLength;
  const padding = Math.max(Math.min(plan.tileWidth, plan.tileLength) * 0.35, 100);
  const mapX = (x) => x - bounds.minX;
  const mapY = (y) => y - bounds.minY;
  const footprint = plan.footprint?.length
    ? geometryPath(plan.footprint, mapX, mapY)
    : `M0,0 h${width} v${length} h${-width} Z`;
  const orderQuantity = plan.cartonsToOrder || plan.orderQuantity;
  const orderUnit = plan.cartonsToOrder ? "cartons" : "tiles";

  return (
    <aside className="landing-product-preview" aria-label="Calculated sample plan preview">
      <div className="landing-preview-heading">
        <div><span className="field-kicker">LIVE CALCULATION · SAMPLE DATA</span><strong>L-shaped room plan</strong></div>
        <span>2D / HALF-OFFSET</span>
      </div>
      <div className="landing-preview-stage">
        <svg className="landing-preview-svg" viewBox={`${-padding} ${-padding} ${width + padding * 2} ${length + padding * 2}`} role="img" aria-label="Sample L-shaped tile plan with numbered full tiles and cut pieces">
          <path d={footprint} className="plan-2d-floor" fillRule="evenodd" />
          {plan.pieces.map((piece) => (
            <g key={piece.id || piece.number}>
              <path d={piecePath(piece, mapX, mapY)} className={`plan-2d-piece ${piece.full ? "is-full" : "is-cut"}`} fillRule="evenodd" />
              {(piece.displayW ?? piece.w) > plan.tileWidth * 0.62 && (piece.displayH ?? piece.h) > plan.tileLength * 0.62 && <text
                x={mapX(piece.x + (piece.displayW ?? piece.w) / 2)}
                y={mapY(piece.y + (piece.displayH ?? piece.h) / 2)}
                className="plan-2d-label"
                pointerEvents="none"
              >{piece.number}</text>}
            </g>
          ))}
          <path d={footprint} className="plan-2d-boundary" fill="none" fillRule="evenodd" />
        </svg>
        <span className="landing-preview-sample-label">ILLUSTRATIVE</span>
      </div>
      <div className="landing-preview-metrics">
        <div><span>SUGGESTED ORDER</span><strong>{orderQuantity}<small> {orderUnit}</small></strong></div>
        <div><span>STOCK PLAN</span><strong>{plan.stockTiles}<small> tiles</small></strong></div>
        <div><span>CUT PIECES</span><strong>{plan.cutPieces.length}<small> pieces</small></strong></div>
      </div>
      <div className="landing-preview-footer">
        <span>{plan.schedule.length} cut types · 1 column · 1 floor opening</span>
        <Link href="/demo">Explore the interactive plan</Link>
      </div>
    </aside>
  );
}
