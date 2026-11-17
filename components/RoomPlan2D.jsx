"use client";

function piecePath(geometry, mapX, mapY) {
  return (geometry || []).flatMap((polygon) => polygon.map((ring) => (
    `${ring.map(([x, y], index) => `${index ? "L" : "M"}${mapX(x)},${mapY(y)}`).join(" ")} Z`
  ))).join(" ");
}

function rectanglePath(piece) {
  return `M${piece.x},${piece.y} h${piece.w} v${piece.h} h${-piece.w} Z`;
}

export default function RoomPlan2D({ plan, selectedPieceNumber, onPieceSelect }) {
  const bounds = plan.bounds || { minX: 0, minY: 0 };
  const planWidth = bounds.widthMm ?? plan.roomWidth;
  const planLength = bounds.lengthMm ?? plan.roomLength;
  const viewPadding = Math.max(Math.min(plan.tileWidth, plan.tileLength) * 0.35, 100);
  const mapX = (x) => x - bounds.minX;
  const mapY = (y) => y - bounds.minY;
  const outline = plan.footprint?.length
    ? piecePath(plan.footprint, mapX, mapY)
    : `M0,0 h${plan.roomWidth} v${plan.roomLength} h${-plan.roomWidth} Z`;

  return (
    <div className="plan-2d-shell">
      <svg className="plan-2d-svg" viewBox={`${-viewPadding} ${-viewPadding} ${planWidth + viewPadding * 2} ${planLength + viewPadding * 2}`} role="img" aria-label="Interactive two-dimensional tile cut plan. Select a piece to inspect its ID and dimensions.">
        <path d={outline} className="plan-2d-floor" fillRule="evenodd" />
        {plan.pieces.map((piece) => {
          const selected = piece.number === selectedPieceNumber;
          const path = piece.geometry?.length
            ? piecePath(piece.geometry, mapX, mapY)
            : rectanglePath({ ...piece, x: mapX(piece.x), y: mapY(piece.y) });
          const label = piece.id || `#${piece.number}`;
          return <g key={label}>
            <path
              d={path}
              className={`plan-2d-piece ${piece.full ? "is-full" : "is-cut"} ${selected ? "is-selected" : ""}`}
              fillRule="evenodd"
              tabIndex="0"
              role="button"
              aria-label={`${label}, ${piece.full ? "full tile" : "cut piece"}, ${piece.w} by ${piece.h} millimeters`}
              onClick={() => onPieceSelect?.(piece)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onPieceSelect?.(piece);
                }
              }}
            >
              <title>{label} · {piece.full ? "Full tile" : "Cut piece"} · {piece.w} × {piece.h} mm</title>
            </path>
            {(piece.displayW ?? piece.w) > plan.tileWidth * 0.62 && (piece.displayH ?? piece.h) > plan.tileLength * 0.62 && <text
              x={mapX(piece.x + (piece.displayW ?? piece.w) / 2)}
              y={mapY(piece.y + (piece.displayH ?? piece.h) / 2)}
              className="plan-2d-label"
              pointerEvents="none"
            >{piece.number}</text>}
          </g>;
        })}
        <path d={outline} className="plan-2d-boundary" fill="none" fillRule="evenodd" />
      </svg>
      <div className="plan-2d-scale">{planWidth} × {planLength} mm plan bounds · {plan.pattern || "straight"}</div>
    </div>
  );
}
