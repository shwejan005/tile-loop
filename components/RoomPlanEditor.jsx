"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, ChevronDown, CircleHelp,
  Layers3, Rotate3D, RotateCcw, Scissors, ShieldCheck, TriangleAlert,
} from "lucide-react";
import { calculatePlan, DEFAULT_FORM, formatArea, formatLocation, formatNumber, minimumTilesByArea } from "../lib/planner.js";
import { roomGeometryBounds, resizeRoomGeometry, validateRoomGeometry } from "../lib/geometry/room.js";
import { saveRoomPlanAction } from "../app/actions/rooms.js";
import RoomGeometryEditor from "./RoomGeometryEditor.jsx";

const RoomScene = dynamic(() => import("./RoomScene"), { ssr: false, loading: () => <div className="scene-loading"><span className="loading-spinner" /> Building your room model…</div> });
const RoomPlan2D = dynamic(() => import("./RoomPlan2D.jsx"), { ssr: false });

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char]));
}

function downloadText(name, contents, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function catalogLabel(item) {
  return `${item.brand} · ${item.collection_name} · ${item.color} · ${item.format_label}`;
}

function geometryPath(geometry, mapX, mapY) {
  return (geometry || []).flatMap((polygon) => polygon.map((ring) => {
    const points = ring.map(([x, y], index) => `${index ? "L" : "M"}${mapX(x)},${mapY(y)}`).join(" ");
    return `${points} Z`;
  })).join(" ");
}

function OffcutShape({ entry, plan }) {
  if (!entry.geometry?.length) {
    return <div className="offcut-shape" style={{ "--shape-w": `${Math.max(34, Math.min(100, entry.w / Math.max(plan.tileWidth, plan.tileLength) * 100))}%`, "--shape-h": `${Math.max(26, Math.min(100, entry.h / Math.max(plan.tileWidth, plan.tileLength) * 100))}%` }}><span /></div>;
  }
  const points = entry.geometry.flat(2);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const path = geometryPath(entry.geometry, (x) => x - minX, (y) => y - minY);
  return <svg className="offcut-shape offcut-shape-svg" viewBox={`0 0 ${entry.w} ${entry.h}`} role="img" aria-label={`${entry.shape || "polygon"} offcut ${formatNumber(entry.w)} by ${formatNumber(entry.h)} millimeters`}><path d={path} fillRule="evenodd" /></svg>;
}

function exportPlanSvg(plan) {
  if (!plan) return;
  const left = 360;
  const top = 220;
  const footer = 390;
  const right = 180;
  const viewWidth = plan.roomWidth + left + right;
  const viewHeight = plan.roomLength + top + footer;
  const roomRight = left + plan.roomWidth;
  const roomBottom = top + plan.roomLength;
  const roomBounds = plan.bounds || { minX: 0, minY: 0 };
  const mapX = (x) => left + x - roomBounds.minX;
  const mapY = (y) => top + y - roomBounds.minY;
  const tileRects = plan.pieces.map((piece) => {
    const fill = piece.full ? "#e6eef0" : "#67e5f1";
    const label = Math.min(piece.w, piece.h) > 180 ? `<text class="number" x="${mapX(piece.x + piece.w / 2)}" y="${mapY(piece.y + piece.h / 2)}">${escapeXml(piece.id || piece.number)}</text>` : "";
    const shape = piece.geometry?.length
      ? `<path d="${geometryPath(piece.geometry, mapX, mapY)}" fill="${fill}" fill-rule="evenodd" stroke="#a7b6ba" stroke-width="2"/>`
      : `<rect x="${mapX(piece.x)}" y="${mapY(piece.y)}" width="${piece.w}" height="${piece.h}" fill="${fill}" stroke="#a7b6ba" stroke-width="2" rx="5"/>`;
    return `<g><title>${escapeXml(piece.id || `Piece ${piece.number}`)}: ${formatNumber(piece.w)} × ${formatNumber(piece.h)} mm · ${escapeXml(piece.shape || "rectangle")}</title>${shape}${label}</g>`;
  }).join("");
  const roomOutline = plan.footprint?.length
    ? `<path d="${geometryPath(plan.footprint, mapX, mapY)}" fill="none" stroke="#00d3e5" stroke-width="12" fill-rule="evenodd"/>`
    : `<rect x="${left}" y="${top}" width="${plan.roomWidth}" height="${plan.roomLength}" fill="none" stroke="#00d3e5" stroke-width="12"/>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewWidth} ${viewHeight}">
  <style>text{font-family:Arial,sans-serif;fill:#172226}.number{text-anchor:middle;dominant-baseline:central;font-size:120px;font-weight:600}.dimension{fill:#e9f4f5;text-anchor:middle;font-size:135px;font-weight:bold}</style>
  <rect width="100%" height="100%" fill="#10181b"/>
  <text x="${left}" y="130" style="fill:#00d3e5" font-size="65" font-family="Arial" font-weight="bold">TILELOOP · ${escapeXml(plan.planId)}</text>
  <g>${tileRects}${roomOutline}</g>
  <text class="dimension" x="${left + plan.roomWidth / 2}" y="${roomBottom + 240}" fill="#e9f4f5">${formatNumber(plan.roomWidth)} mm</text>
  <text class="dimension" x="${roomRight + 100}" y="${top + plan.roomLength / 2}" fill="#e9f4f5" transform="rotate(90 ${roomRight + 100} ${top + plan.roomLength / 2})">${formatNumber(plan.roomLength)} mm</text>
  <text x="${left}" y="${viewHeight - 85}" fill="#8d9da0" font-size="55" font-family="Arial">${plan.tilesToOrder || plan.orderQuantity} TILES SUGGESTED · ${plan.pieces.length} NUMBERED PIECES · ${escapeXml(plan.pattern || "straight")}</text>
</svg>`;
  const safeId = plan.planId.replace(/[^a-z0-9_-]/gi, "-");
  downloadText(`${safeId}-tileloop-plan.svg`, xml, "image/svg+xml;charset=utf-8");
}

export default function RoomPlanEditor({ projectId, roomPlanId = null, initialForm = DEFAULT_FORM, initialInstallerEstimate = "", initialCatalogItemId = null, catalogItems = [], history = [], demoMode = false }) {
  const [form, setForm] = useState(() => ({ ...DEFAULT_FORM, ...initialForm }));
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [modelView, setModelView] = useState("3d");
  const [catalogItemId, setCatalogItemId] = useState(initialCatalogItemId || "");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [installerEstimate, setInstallerEstimate] = useState(initialInstallerEstimate);
  const [installerNote, setInstallerNote] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [isSaving, startSaving] = useTransition();
  const router = useRouter();
  const plan = useMemo(() => calculatePlan(form), [form]);
  const validPlan = plan && !plan.error ? plan : null;
  const activePiece = selectedPiece && validPlan?.pieces.find((piece) => piece.number === selectedPiece.number);
  const selectedCatalogItem = catalogItems.find((item) => item.id === catalogItemId) || null;
  const filteredCatalogItems = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase();
    if (query.length < 2) return [];
    return catalogItems.filter((item) => [
      item.brand, item.collection_name, item.product_name, item.color, item.supplier_code,
      item.format_label,
    ].some((value) => String(value || "").toLowerCase().includes(query))).slice(0, 12);
  }, [catalogItems, catalogSearch]);
  const installerEstimateNumber = Number(installerEstimate);
  const installerEstimateInvalid = installerEstimate !== ""
    && (!Number.isInteger(installerEstimateNumber) || installerEstimateNumber < 1 || installerEstimateNumber > 100000);
  const installerEstimateBelowFloor = installerEstimate !== "" && validPlan
    && Number.isInteger(installerEstimateNumber)
    && installerEstimateNumber < minimumTilesByArea(validPlan);
  const onPieceSelect = useCallback((piece) => setSelectedPiece(piece), []);

  function updateField(name, value) {
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "pattern" && value === "herringbone") next.orientation = "standard";
      if (["tileWidth", "tileLength"].includes(name)) next.tilesPerCarton = "";
      if (name === "roomGeometry") {
        if (value && !validateRoomGeometry(value)) {
          const bounds = roomGeometryBounds(value);
          next.roomWidth = bounds.widthMm;
          next.roomLength = bounds.lengthMm;
        }
        return next;
      }
      if (current.roomGeometry && ["roomWidth", "roomLength"].includes(name)) {
        const width = Number(name === "roomWidth" ? value : current.roomWidth);
        const length = Number(name === "roomLength" ? value : current.roomLength);
        if (Number.isFinite(width) && Number.isFinite(length) && width >= 300 && length >= 300) {
          try { next.roomGeometry = resizeRoomGeometry(current.roomGeometry, width, length); } catch { /* Keep the last valid outline while the user edits a dimension. */ }
        }
      }
      return next;
    });
    setSelectedPiece(null);
    if (["roomWidth", "roomLength", "tileWidth", "tileLength", "grout", "kerf", "orientation", "pattern"].includes(name)) setInstallerEstimate("");
    if (["tileWidth", "tileLength"].includes(name)) setCatalogItemId("");
    setSaveMessage("");
  }

  function chooseCatalogItem(item) {
    setCatalogItemId(item.id);
    setCatalogSearch(`${item.brand} · ${item.collection_name} · ${item.color} · ${item.format_label}`);
    setForm((current) => ({
      ...current,
      tileWidth: Number(item.width_mm),
      tileLength: Number(item.height_mm),
      tilesPerCarton: item.tiles_per_carton == null ? "" : String(item.tiles_per_carton),
    }));
    setInstallerEstimate("");
    setSelectedPiece(null);
    setSaveMessage("");
  }

  function clearCatalogItem() {
    setCatalogItemId("");
    setCatalogSearch("");
    setForm((current) => ({ ...current, tilesPerCarton: "" }));
    setInstallerEstimate("");
    setSaveMessage("");
  }

  function savePlan() {
    if (!validPlan || !projectId) return;
    setSaveMessage("");
    startSaving(async () => {
      const result = await saveRoomPlanAction({
        projectId,
        roomPlanId,
        catalogItemId: catalogItemId || null,
        form,
        installerEstimate,
        installerNote,
      });
      if (result.error) {
        setSaveMessage(result.error);
        return;
      }
      router.replace(`/projects/${projectId}/rooms/${result.roomPlanId}`);
      router.refresh();
    });
  }

  return (
    <main id="main-content" className="room-planner-page">
        <div className="planner-breadcrumb"><Link href={demoMode ? "/" : `/projects/${projectId}`}><ArrowLeft size={14} /> BACK TO {demoMode ? "HOME" : "PROJECT"}</Link><span>{demoMode ? "INTERACTIVE DEMO" : roomPlanId ? "EDIT SAVED PLAN" : "NEW ROOM PLAN"}</span></div>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-chip">INSTALLATION PLAN</span><span>POLYGON ROOMS · MULTIPLE PATTERNS</span></div>
            <h1>PLAN EACH CUT.<br /><span>RECORD THE ASSUMPTIONS.</span></h1>
            <p>{demoMode ? "Explore room geometry, patterns, cut shapes, offcuts, and carton rounding with sample data. Nothing in this demo is saved." : "Review a kerf-aware stock estimate, compare an installer count, and save the exact inputs and calculation version to this project."}</p>
          </div>
          <div className="hero-side">
            <div className="hero-rule" />
            <p><span>01</span> ROOM ZONES + OPENINGS</p>
            <p><span>02</span> STRAIGHT · OFFSET · DIAGONAL</p>
            <p><span>03</span> NUMBERED CUT SHAPES</p>
          </div>
          <div className="hero-index" aria-hidden="true">TL<span>—</span>26</div>
        </section>

        <div id="planner" className="section-bar"><div><span className="section-index">01</span><span>PLAN YOUR ROOM</span></div><span className="section-bar-note"><ShieldCheck size={14} /> GEOMETRY · PATTERN · KERF</span></div>

        <section className="planner-grid">
          <aside className="control-panel">
            <div className="panel-title-row"><div><span className="field-kicker">INPUTS / MILLIMETERS</span><h2>Room setup</h2></div><button className="icon-text-button" type="button" onClick={() => { const originalProduct = catalogItems.find((item) => item.id === initialCatalogItemId); setForm({ ...DEFAULT_FORM, ...initialForm }); setInstallerEstimate(initialInstallerEstimate); setInstallerNote(""); setSelectedPiece(null); setCatalogItemId(initialCatalogItemId || ""); setCatalogSearch(originalProduct ? catalogLabel(originalProduct) : ""); setSaveMessage(""); }}><RotateCcw size={13} /> Reset</button></div>

              <label className="input-label" htmlFor="plan-id">Room plan ID <span>24 CHARACTERS MAX</span></label>
            <input id="plan-id" className="text-control" value={form.planId} maxLength={24} onChange={(event) => updateField("planId", event.target.value)} placeholder="UAE-01" />

            <div className="control-section-heading"><span>Room dimensions</span><span>MM</span></div>
            <div className="input-row">
              <label className="input-unit"><span>Width</span><div><input type="number" min="300" max="50000" step="0.01" value={form.roomWidth} onChange={(event) => updateField("roomWidth", event.target.value)} /><b>mm</b></div></label>
              <label className="input-unit"><span>Length</span><div><input type="number" min="300" max="50000" step="0.01" value={form.roomLength} onChange={(event) => updateField("roomLength", event.target.value)} /><b>mm</b></div></label>
            </div>

            <RoomGeometryEditor
              geometry={form.roomGeometry}
              widthMm={form.roomWidth}
              lengthMm={form.roomLength}
              onChange={(geometry) => updateField("roomGeometry", geometry)}
            />

            <div className="control-section-heading tile-size-heading"><span>Supplier catalog</span><span>{catalogItems.length} PUBLISHED FORMATS</span></div>
            <div className="catalog-picker">
              <label className="visually-hidden" htmlFor="catalog-search">Search supplier catalog</label>
              <input id="catalog-search" className="text-control" type="search" value={catalogSearch} onChange={(event) => { setCatalogSearch(event.target.value); setCatalogItemId(""); setForm((current) => ({ ...current, tilesPerCarton: "" })); setInstallerEstimate(""); }} placeholder="Search brand, collection, color, or code" />
              {catalogItemId && selectedCatalogItem && <div className="catalog-selected"><strong>{catalogLabel(selectedCatalogItem)}</strong><span>{selectedCatalogItem.width_mm} × {selectedCatalogItem.height_mm} mm{selectedCatalogItem.thickness_mm ? ` · ${selectedCatalogItem.thickness_mm} mm thick` : ""} · {selectedCatalogItem.supplier_code}</span><span>{selectedCatalogItem.tiles_per_carton == null ? "Carton size unavailable" : `${selectedCatalogItem.tiles_per_carton} tiles/carton`} · {selectedCatalogItem.price_amount == null ? "Price unavailable" : `${formatNumber(Number(selectedCatalogItem.price_amount))} ${selectedCatalogItem.price_currency} / ${selectedCatalogItem.price_unit}`} · {selectedCatalogItem.stock_quantity == null ? "Stock unavailable" : `${selectedCatalogItem.stock_quantity} ${selectedCatalogItem.stock_unit} in stock`}</span>{selectedCatalogItem.ordering_status === "orderable" ? <small>Supplier facts verified {selectedCatalogItem.facts_verified_at ? new Date(selectedCatalogItem.facts_verified_at).toLocaleDateString() : ""}. Confirm current availability before purchase.</small> : <small>Planning only — supplier facts are not approved for ordering.</small>}<button className="icon-text-button" type="button" onClick={clearCatalogItem}>Use custom size</button></div>}
              {!catalogItemId && catalogSearch.trim().length >= 2 && <div className="catalog-search-results" role="listbox" aria-label="Catalog matches">
                {filteredCatalogItems.map((item) => <button className="catalog-option" key={item.id} type="button" role="option" aria-selected="false" onClick={() => chooseCatalogItem(item)}><strong>{catalogLabel(item)}</strong><span>{item.width_mm} × {item.height_mm} mm · {item.supplier_code}</span></button>)}
                {!filteredCatalogItems.length && <p className="catalog-empty">No published formats match that search.</p>}
              </div>}
              {!catalogItemId && catalogSearch.trim().length < 2 && <p className="microcopy">Search published supplier products, or enter a custom format below.</p>}
              {!catalogItems.length && <p className="catalog-empty">No supplier catalog is published yet. Custom tile dimensions are available.</p>}
            </div>

            <div className="control-section-heading tile-size-heading"><span>Tile dimensions</span><span>{selectedCatalogItem ? "CATALOG FORMAT" : "CUSTOM / MM"}</span></div>
            <div className="input-row">
              <label className="input-unit"><span>Width</span><div><input aria-label="Tile width in millimeters" type="number" min="50" max="3000" step="0.01" readOnly={Boolean(selectedCatalogItem)} value={form.tileWidth} onChange={(event) => updateField("tileWidth", event.target.value)} /><b>mm</b></div></label>
              <label className="input-unit"><span>Length</span><div><input aria-label="Tile length in millimeters" type="number" min="50" max="3000" step="0.01" readOnly={Boolean(selectedCatalogItem)} value={form.tileLength} onChange={(event) => updateField("tileLength", event.target.value)} /><b>mm</b></div></label>
            </div>

            <label className="input-unit grout-unit"><span>Grout joint</span><div><input type="number" min="0" max="30" step="0.01" value={form.grout} onChange={(event) => updateField("grout", event.target.value)} /><b>mm</b></div></label>
            <label className="input-unit grout-unit"><span>Saw kerf</span><div><input type="number" min="0" max="10" step="0.1" value={form.kerf} onChange={(event) => updateField("kerf", event.target.value)} /><b>mm</b></div></label>
            <p className="microcopy">Use the measured blade kerf. The nesting estimate conservatively reserves it on each cut dimension.</p>

            <label className="input-label select-label" htmlFor="pattern">Installation pattern</label>
            <div className="select-shell"><select id="pattern" value={form.pattern || "straight"} onChange={(event) => updateField("pattern", event.target.value)}><option value="straight">Straight lay</option><option value="half-offset">Half-offset (50%)</option><option value="diagonal">Diagonal (45°)</option><option value="herringbone">Herringbone 90° (2:1 tile)</option></select><ChevronDown size={15} /></div>

            <label className="input-label select-label" htmlFor="orientation">Tile direction{form.pattern === "herringbone" && <span>SET BY PATTERN</span>}</label>
            <div className="select-shell"><select id="orientation" disabled={form.pattern === "herringbone"} value={form.orientation} onChange={(event) => updateField("orientation", event.target.value)}><option value="standard">Tile width across room width</option><option value="rotated">Rotate tile 90°</option></select><ChevronDown size={15} /></div>

            <div className="control-section-heading buffer-heading"><span>Order buffer</span><span>BREAKAGE / REPAIR</span></div>
            <div className="range-line"><input aria-label="Order buffer percent" type="range" min="0" max="20" step="1" value={form.reserve} onChange={(event) => updateField("reserve", Number(event.target.value))} style={{ "--range-fill": `${Number(form.reserve) * 5}%` }} /><strong>{formatNumber(Number(form.reserve) || 0)}<small>%</small></strong></div>
            <p className="microcopy">Added after tile nesting and rounded up to a whole tile.</p>

            <label className="input-unit carton-unit"><span>Tiles per carton <small>OPTIONAL · VERIFY PACK LABEL</small></span><div><input aria-label="Tiles per carton" type="number" min="1" max="1000" step="1" value={form.tilesPerCarton} onChange={(event) => updateField("tilesPerCarton", event.target.value)} placeholder="Not provided" /><b>tiles</b></div></label>
            <p className="microcopy">Carton rounding uses this user-entered value only; catalog pack sizes are currently unverified.</p>

            {plan.error && <div className="validation-error" role="alert"><TriangleAlert size={14} /><span>{plan.error}</span></div>}
            <div className="assumption-card"><CircleHelp size={15} /><p><strong>{validPlan?.geometryMode ? "Polygon-clipped layout." : "Rectangular room layout."}</strong> {validPlan?.geometryMode ? "Cut-piece bounds are conservatively packed with kerf; reuse candidates require a bounding-box fit and still need installer review." : "The selected pattern places tiles on a centered grid; no perimeter grout is added. Tile dimensions are finished stock dimensions."}</p></div>
            {validPlan?.layoutWarnings?.map((warning) => <div className="layout-warning" role="status" key={warning}><TriangleAlert size={13} /><span>{warning}</span></div>)}
            {demoMode ? <div className="save-plan-panel demo-save-panel"><span className="field-kicker">DEMO MODE / READ ONLY</span><p>Start a private project to save plans, compare installer estimates, and record actual installation outcomes.</p><Link className="save-plan-button" href="/signup">Create an account <ArrowRight size={14} /></Link></div> : <div className="save-plan-panel">
              <span className="field-kicker">SAVE TO PROJECT</span>
              <label className="input-label" htmlFor="installer-estimate">Installer estimate <span>OPTIONAL · WHOLE TILES</span></label>
              <input id="installer-estimate" className="text-control" type="number" min="1" max="100000" step="1" value={installerEstimate} onChange={(event) => { setInstallerEstimate(event.target.value); setSaveMessage(""); }} placeholder="Enter a comparable order count" />
              {installerEstimateInvalid && <p className="save-plan-message" role="alert">Enter a whole number from 1 to 100,000 tiles, or clear the optional field.</p>}
              {installerEstimateBelowFloor && <p className="save-plan-message" role="alert">This is below the {minimumTilesByArea(validPlan)}-tile floor-area minimum. Check units or clear the comparison.</p>}
              <label className="input-label" htmlFor="installer-note">Comparison note <span>OPTIONAL</span></label>
              <textarea id="installer-note" className="text-control note-control" maxLength={1000} value={installerNote} onChange={(event) => setInstallerNote(event.target.value)} placeholder="Same room, tile, units, and site assumptions" />
              {saveMessage && <p className="save-plan-message" role="status">{saveMessage}</p>}
              <button className="save-plan-button" type="button" onClick={savePlan} disabled={!validPlan || isSaving || installerEstimateInvalid || installerEstimateBelowFloor}>{isSaving ? "Saving calculation…" : roomPlanId ? "Save new calculation version" : "Save room plan"}<ArrowRight size={14} /></button>
              <p className="microcopy">Each save records an immutable calculation snapshot and algorithm version. Estimates below the area-only minimum are rejected.</p>
            </div>}
          </aside>

          <section className="model-panel" aria-label={modelView === "3d" ? "Interactive three-dimensional tile layout" : "Interactive two-dimensional tile layout"}>
            <div className="model-topbar"><div><span className="field-kicker">MODEL / {validPlan ? validPlan.planId : "WAITING FOR INPUT"}</span><h2>Room in {modelView === "3d" ? "3D" : "2D"}<span className="cyan-period">.</span></h2></div>
              <div className="model-actions"><div className="model-view-switch" role="group" aria-label="Choose plan view"><button type="button" aria-pressed={modelView === "2d"} onClick={() => setModelView("2d")}>2D</button><button type="button" aria-pressed={modelView === "3d"} onClick={() => setModelView("3d")}>3D</button></div>{modelView === "3d" && <div className="live-model-pill"><span /> INTERACTIVE</div>}<button className="square-button" type="button" onClick={() => exportPlanSvg(validPlan)} disabled={!validPlan} title="Download numbered 2D plan as SVG" aria-label="Download plan as SVG"><ArrowDownToLine size={17} /></button></div>
            </div>
            <div className="model-viewport">
              {validPlan ? modelView === "3d"
                ? <RoomScene plan={validPlan} selectedPieceNumber={activePiece?.number ?? null} onPieceSelect={onPieceSelect} />
                : <RoomPlan2D plan={validPlan} selectedPieceNumber={activePiece?.number ?? null} onPieceSelect={onPieceSelect} />
                : <div className="model-error"><TriangleAlert size={18} /> Fix the room and tile inputs to build the model.</div>}
              {validPlan && <div className={`selection-overlay ${activePiece ? "piece-is-selected" : ""}`} aria-live="polite">
                {activePiece ? <><span className="selection-type">{activePiece.full ? "FULL TILE" : "CUT PIECE"} · {activePiece.id || `#${activePiece.number}`}</span><strong>{formatNumber(activePiece.w)} × {formatNumber(activePiece.h)} <small>mm max bounds</small></strong><button type="button" onClick={() => setSelectedPiece(null)} aria-label="Clear selected tile">×</button></> : <><span>CLICK ANY TILE</span><small>to inspect piece size and ID</small></>}
              </div>}
            </div>
            <div className="model-caption">
              <div className="model-legend"><span><i className="legend-tile legend-full" /> FULL TILE</span><span><i className="legend-tile legend-cut" /> CUT PIECE</span><span><i className="legend-gap" /> GROUT</span></div>
              <div className="model-caption-right">{activePiece ? <><b>PIECE {activePiece.number}</b><span>{formatNumber(activePiece.w)} × {formatNumber(activePiece.h)} mm</span></> : <><b>ROOM GRID</b><span>{validPlan ? `${validPlan.columns.length} cols × ${validPlan.rows.length} rows` : "—"}</span></>}</div>
            </div>
          </section>
        </section>

        <section className="metrics-grid" aria-label="Plan estimate">
          <article className="metric-card metric-primary"><div className="metric-top"><span>SUGGESTED ORDER</span><ArrowRight size={15} /></div><div className="metric-value">{validPlan ? (validPlan.cartonsToOrder || validPlan.orderQuantity) : "—"}<small>{validPlan?.cartonsToOrder ? "cartons" : "tiles"}</small></div><div className="metric-bottom"><span>{validPlan?.cartonsToOrder ? `${validPlan.tilesToOrder} tiles · ${validPlan.orderQuantity} after buffer` : `includes ${form.reserve}% buffer`}</span><span className="cyan-tag">ESTIMATE</span></div><div className="metric-accent-line" /></article>
          <article className="metric-card"><div className="metric-top"><span>CUT PLAN</span><Layers3 size={15} /></div><div className="metric-value">{validPlan ? validPlan.stockTiles : "—"}<small>tiles</small></div><div className="metric-bottom"><span>{validPlan ? `${validPlan.fullCount} full · ${validPlan.cutPieces.length} cut pieces` : "—"}</span><span>{validPlan ? `${validPlan.pieces.length} pieces` : ""}</span></div></article>
          <article className="metric-card"><div className="metric-top"><span>OFFCUT CANDIDATES</span><Rotate3D size={15} /></div><div className="metric-value">{validPlan ? validPlan.remnantCount : "—"}<small>pieces</small></div><div className="metric-bottom"><span>both sides ≥ 150 mm</span><span>{validPlan ? formatArea(validPlan.remnantArea) : "—"}</span></div></article>
        </section>

        <section className="detail-grid">
          <article className="detail-card cut-schedule-card">
            <div className="detail-heading"><div><span className="field-kicker">CUT MAP / PIECE SCHEDULE</span><h2>Every edge, accounted for.</h2></div><span className="table-count">{validPlan ? `${validPlan.schedule.length} piece types` : "—"}</span></div>
            <div className="schedule-table-wrap"><table className="schedule-table"><thead><tr><th>TYPE</th><th>QTY</th><th>PIECE SIZE <span>W × L</span></th><th>LOCATION</th></tr></thead><tbody>
              {validPlan?.schedule.map((piece, index) => <tr key={`${piece.w}-${piece.h}-${piece.full}-${index}`}><td><span className={`piece-mark ${piece.full ? "piece-full" : "piece-cut"}`} />{piece.full ? "Full tile" : piece.shape === "polygon" ? "Shaped cut" : "Cut piece"}{piece.pieceIds?.length > 0 && <details className="piece-id-details"><summary>{piece.qty} piece IDs</summary><code>{piece.pieceIds.join(", ")}</code></details>}</td><td>{piece.qty}</td><td>{formatNumber(piece.w)} × {formatNumber(piece.h)} mm{piece.shape === "polygon" ? " max bounds" : ""}</td><td>{formatLocation(piece.locations)}</td></tr>)}
              {!validPlan && <tr><td className="empty-row" colSpan="4">Valid dimensions will generate a numbered cut schedule.</td></tr>}
            </tbody></table></div>
            <div className="table-foot"><span><Scissors size={13} /> {validPlan ? validPlan.geometryMode ? `${validPlan.cutPaths} polygon cut profiles` : `${validPlan.cutEdges} estimated cut edges` : "—"}</span><span>Select a piece in either view to inspect its ID and dimensions.</span></div>
          </article>

          <article className="detail-card offcut-card">
            <div className="detail-heading"><div><span className="field-kicker">MATERIAL / KEEP IN USE</span><h2>Remnants worth a look.</h2></div><span className="reuse-arrow">↗</span></div>
            <p className="detail-description">Rectangular stock-tile areas left after nesting every room piece. Installer checks final suitability.</p>
            <div className="offcut-stack">
              {validPlan?.remnants.slice(0, 5).map((entry, index) => <div className="offcut-entry" key={entry.id || `${entry.w}-${entry.h}-${index}`}><OffcutShape entry={entry} plan={validPlan} /><span className="offcut-size">{formatNumber(entry.w)} × {formatNumber(entry.h)} <i>mm</i></span><span className="offcut-quantity">×{entry.qty}</span>{entry.reuseCandidates?.length > 0 && <small className="offcut-reuse">Bounding-box fit candidates: {entry.reuseCandidates.flatMap((candidate) => candidate.pieceIds || []).join(", ")}</small>}</div>)}
              {validPlan && validPlan.remnantCount === 0 && <div className="offcut-empty">No remaining rectangle meets 150 × 150 mm in this nesting estimate.</div>}
              {!validPlan && <div className="offcut-empty">Offcut candidates appear when the room dimensions are valid.</div>}
            </div>
            <div className="estimate-note"><Scissors size={13} /><span>Repeatable guillotine estimate. Kerf is conservatively reserved; breakage and site cutting order can still change reuse.</span></div>
          </article>
        </section>

        {roomPlanId && <section className="snapshot-history">
          <div className="detail-heading"><div><span className="field-kicker">AUDIT TRAIL</span><h2>Calculation history</h2></div><span className="table-count">{history.length} saved {history.length === 1 ? "version" : "versions"}</span></div>
          <div className="snapshot-list">{history.map((snapshot) => {
            const savedComparisons = snapshot.installer_comparisons;
            const comparison = Array.isArray(savedComparisons) ? savedComparisons[0] : savedComparisons;
            const delta = comparison ? comparison.installer_estimate_tiles - snapshot.result_summary.orderQuantity : null;
            return <article className="snapshot-row" key={snapshot.id}><div><strong>{snapshot.algorithm_version}</strong><span>{new Date(snapshot.created_at).toLocaleString()}</span></div><div><small>TileLoop order</small><b>{snapshot.result_summary.orderQuantity} tiles</b></div><div><small>Installer usual</small><b>{comparison ? `${comparison.installer_estimate_tiles} tiles` : "Not recorded"}</b></div><div><small>Difference</small><b className={delta == null ? "" : delta > 0 ? "diff-positive" : delta < 0 ? "diff-negative" : "diff-neutral"}>{delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta}`}</b></div><code>{snapshot.input_hash.slice(0, 12)}…</code></article>;
          })}</div>
        </section>}
      </main>
  );
}
