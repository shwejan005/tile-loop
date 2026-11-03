"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createRectangularRoomGeometry, normalizeRoomGeometry, roomGeometryBounds, validateRoomGeometry } from "../lib/geometry/room.js";

function rectangleRing(x, y, width, length) {
  return [[x, y], [x + width, y], [x + width, y + length], [x, y + length]];
}

function withBaseGeometry(geometry, widthMm, lengthMm) {
  const width = Number(widthMm);
  const length = Number(lengthMm);
  return geometry
    ? normalizeRoomGeometry(geometry)
    : createRectangularRoomGeometry(Number.isFinite(width) && width > 0 ? width : 300, Number.isFinite(length) && length > 0 ? length : 300);
}

function validOrFallbackGeometry(geometry, widthMm, lengthMm) {
  return geometry && !validateRoomGeometry(geometry) ? normalizeRoomGeometry(geometry) : withBaseGeometry(null, widthMm, lengthMm);
}

function initialShapeMode(geometry) {
  if (!geometry) return "rectangle";
  if (validateRoomGeometry(geometry)) return "custom";
  const [zone] = normalizeRoomGeometry(geometry).zones;
  const xs = new Set(zone.boundary.map(([x]) => x));
  const ys = new Set(zone.boundary.map(([, y]) => y));
  const simpleRectangle = normalizeRoomGeometry(geometry).zones.length === 1
    && zone.boundary.length === 4
    && xs.size === 2
    && ys.size === 2
    && zone.boundary.every((point, index) => {
      const next = zone.boundary[(index + 1) % zone.boundary.length];
      return point[0] === next[0] || point[1] === next[1];
    })
    && !zone.openings.length
    && !zone.obstacles.length
    && !zone.accessPoints.length;
  return simpleRectangle ? "rectangle" : "custom";
}

function serializeBoundary(boundary) {
  return boundary.map(([x, y]) => `${x},${y}`).join(" ");
}

function parseBoundary(value) {
  const points = value.trim().split(/[;\n]+|\s+(?=-?\d)/).map((token) => token.trim()).filter(Boolean);
  if (points.length < 3) throw new Error("Enter at least three x,y points.");
  return points.map((point) => {
    const match = point.match(/^(-?[\d.]+)\s*,\s*(-?[\d.]+)$/);
    if (!match) throw new Error("Use x,y pairs separated by spaces, for example: 0,0 4000,0 4000,1000 0,1000.");
    return [Number(match[1]), Number(match[2])];
  });
}

function RoomPreview({ geometry, widthMm, lengthMm }) {
  const previewGeometry = validOrFallbackGeometry(geometry, widthMm, lengthMm);
  const zones = previewGeometry.zones || [];
  const bounds = roomGeometryBounds(previewGeometry);
  const scale = Math.min(280 / Math.max(bounds.widthMm, 1), 150 / Math.max(bounds.lengthMm, 1));
  const offsetX = (320 - bounds.widthMm * scale) / 2 - bounds.minX * scale;
  const offsetY = (180 - bounds.lengthMm * scale) / 2 - bounds.minY * scale;
  const pointList = (ring) => ring.map(([x, y]) => `${offsetX + x * scale},${offsetY + y * scale}`).join(" ");

  return (
    <svg className="room-geometry-preview" viewBox="0 0 320 180" role="img" aria-label="Two-dimensional room geometry preview">
      <rect width="320" height="180" fill="#10181b" rx="8" />
      {zones.map((zone) => <g key={zone.id}>
        <polygon points={pointList(zone.boundary)} fill="#dcebed" stroke="#00c8d8" strokeWidth="2" />
        {(zone.obstacles || []).map((item) => <polygon key={item.id} points={pointList(item.boundary)} fill="#ec8c62" stroke="#10181b" strokeWidth="1.5" />)}
        {(zone.openings || []).map((item) => <polygon key={item.id} points={pointList(item.boundary)} fill="#10181b" stroke="#00c8d8" strokeDasharray="3 2" strokeWidth="1.5" />)}
        {(zone.accessPoints || []).map((item) => <line key={item.id} x1={offsetX + item.segment[0][0] * scale} y1={offsetY + item.segment[0][1] * scale} x2={offsetX + item.segment[1][0] * scale} y2={offsetY + item.segment[1][1] * scale} stroke="#f8c55a" strokeWidth="4" />)}
      </g>)}
    </svg>
  );
}

export default function RoomGeometryEditor({ geometry, widthMm, lengthMm, onChange }) {
  const [mode, setMode] = useState(() => initialShapeMode(geometry));
  const [notchWidth, setNotchWidth] = useState(() => Math.round(Number(widthMm) * 0.35));
  const [notchDepth, setNotchDepth] = useState(() => Math.round(Number(lengthMm) * 0.35));
  const [customBoundary, setCustomBoundary] = useState(() => serializeBoundary(
    geometry?.zones?.[0]?.boundary || withBaseGeometry(null, widthMm, lengthMm).zones[0].boundary,
  ));
  const [featureX, setFeatureX] = useState("200");
  const [featureY, setFeatureY] = useState("200");
  const [featureWidth, setFeatureWidth] = useState("300");
  const [featureLength, setFeatureLength] = useState("300");
  const [zoneX, setZoneX] = useState(() => String(Number(widthMm) + 200));
  const [zoneY, setZoneY] = useState("0");
  const [zoneWidth, setZoneWidth] = useState("1000");
  const [zoneLength, setZoneLength] = useState("1000");
  const [doorEdge, setDoorEdge] = useState("0");
  const [doorOffset, setDoorOffset] = useState("200");
  const [doorWidth, setDoorWidth] = useState("900");
  const [editorError, setEditorError] = useState("");
  const [traceImageUrl, setTraceImageUrl] = useState("");
  const [traceImageSize, setTraceImageSize] = useState(null);
  const [tracePoints, setTracePoints] = useState([]);
  const [traceActive, setTraceActive] = useState(false);
  const traceSvgRef = useRef(null);

  const activeGeometry = useMemo(
    () => validOrFallbackGeometry(geometry, widthMm, lengthMm),
    [geometry, widthMm, lengthMm],
  );
  const zoneOptions = useMemo(() => activeGeometry.zones.map((zone, index) => ({ id: zone.id, label: `Area ${index + 1}` })), [activeGeometry]);
  const [featureZoneId, setFeatureZoneId] = useState(zoneOptions[0]?.id || "zone-1");
  const activeZone = activeGeometry.zones.find((zone) => zone.id === featureZoneId) || activeGeometry.zones[0];
  const availableEdges = activeZone?.boundary.map((point, index) => {
    const next = activeZone.boundary[(index + 1) % activeZone.boundary.length];
    const dx = next[0] - point[0];
    const dy = next[1] - point[1];
    return { index, start: point, end: next, length: Math.hypot(dx, dy) };
  }) || [];
  const geometryError = geometry ? validateRoomGeometry(geometry) : null;
  const traceImageBounds = useMemo(() => {
    if (!traceImageSize) return null;
    const scale = Math.min(400 / traceImageSize.width, 260 / traceImageSize.height);
    const width = traceImageSize.width * scale;
    const height = traceImageSize.height * scale;
    return { x: (400 - width) / 2, y: (260 - height) / 2, width, height };
  }, [traceImageSize]);

  useEffect(() => {
    if (mode === "custom" && geometry?.zones?.[0]?.boundary) setCustomBoundary(serializeBoundary(geometry.zones[0].boundary));
  }, [geometry, mode]);

  useEffect(() => {
    if (!zoneOptions.some((zone) => zone.id === featureZoneId) && zoneOptions[0]) setFeatureZoneId(zoneOptions[0].id);
  }, [featureZoneId, zoneOptions]);

  useEffect(() => {
    if (!traceImageUrl) return undefined;
    let active = true;
    const image = new Image();
    image.onload = () => { if (active) setTraceImageSize({ width: image.naturalWidth, height: image.naturalHeight }); };
    image.onerror = () => { if (active) setEditorError("Could not read this image. Choose a PNG, JPEG, or WebP floor plan."); };
    image.src = traceImageUrl;
    return () => { active = false; };
  }, [traceImageUrl]);

  useEffect(() => () => {
    if (traceImageUrl) URL.revokeObjectURL(traceImageUrl);
  }, [traceImageUrl]);

  function publish(nextGeometry) {
    const error = validateRoomGeometry(nextGeometry);
    setEditorError(error || "");
    onChange(nextGeometry);
  }

  function chooseMode(nextMode) {
    setMode(nextMode);
    setEditorError("");
    if (nextMode === "rectangle") {
      onChange(null);
      return;
    }
    if (nextMode === "l-shape") {
      const width = Number(widthMm);
      const length = Number(lengthMm);
      const base = createRectangularRoomGeometry(width, length);
      base.zones[0].boundary = [
        [0, 0], [width, 0], [width, length - Number(notchDepth)],
        [width - Number(notchWidth), length - Number(notchDepth)],
        [width - Number(notchWidth), length], [0, length],
      ];
      setCustomBoundary(serializeBoundary(base.zones[0].boundary));
      publish(base);
      return;
    }
    const current = withBaseGeometry(geometry, widthMm, lengthMm);
    setCustomBoundary(serializeBoundary(current.zones[0].boundary));
    publish(current);
  }

  function applyCustomBoundary() {
    try {
      const base = withBaseGeometry(geometry, widthMm, lengthMm);
      const next = {
        ...base,
        zones: base.zones.map((zone, index) => index === 0 ? { ...zone, boundary: parseBoundary(customBoundary) } : zone),
      };
      publish(next);
    } catch (error) {
      setEditorError(error.message || "Could not apply this room outline.");
    }
  }

  function addRectangularFeature(kind) {
    const base = withBaseGeometry(geometry, widthMm, lengthMm);
    const feature = {
      id: `${kind}-${globalThis.crypto.randomUUID()}`,
      boundary: rectangleRing(Number(featureX), Number(featureY), Number(featureWidth), Number(featureLength)),
    };
    const next = {
      ...base,
      zones: base.zones.map((zone) => zone.id === featureZoneId
        ? { ...zone, [kind === "opening" ? "openings" : "obstacles"]: [...(zone[kind === "opening" ? "openings" : "obstacles"] || []), feature] }
        : zone),
    };
    if (!geometry) setMode("custom");
    publish(next);
  }

  function removeFeature(zoneId, collection, id) {
    const next = {
      ...activeGeometry,
      zones: activeGeometry.zones.map((zone) => zone.id === zoneId
        ? { ...zone, [collection]: zone[collection].filter((item) => item.id !== id) }
        : zone),
    };
    publish(next);
  }

  function addArea() {
    const base = withBaseGeometry(geometry, widthMm, lengthMm);
    const nextIndex = base.zones.length + 1;
    const next = {
      ...base,
      zones: [...base.zones, {
        id: `zone-${nextIndex}-${globalThis.crypto.randomUUID()}`,
        boundary: rectangleRing(Number(zoneX), Number(zoneY), Number(zoneWidth), Number(zoneLength)),
        openings: [],
        obstacles: [],
        accessPoints: [],
      }],
    };
    setMode("custom");
    publish(next);
    setFeatureZoneId(next.zones.at(-1).id);
  }

  function removeArea(id) {
    if (activeGeometry.zones.length <= 1) return;
    const next = { ...activeGeometry, zones: activeGeometry.zones.filter((zone) => zone.id !== id) };
    setFeatureZoneId(next.zones[0].id);
    publish(next);
  }

  function addDoorway() {
    const edge = availableEdges.find((item) => item.index === Number(doorEdge));
    if (!edge) return;
    const startDistance = Number(doorOffset);
    const width = Number(doorWidth);
    if (!(startDistance >= 0 && width > 0 && startDistance + width <= edge.length)) {
      setEditorError("The doorway must fit along the selected wall edge.");
      return;
    }
    const unitX = (edge.end[0] - edge.start[0]) / edge.length;
    const unitY = (edge.end[1] - edge.start[1]) / edge.length;
    const segment = [
      [edge.start[0] + unitX * startDistance, edge.start[1] + unitY * startDistance],
      [edge.start[0] + unitX * (startDistance + width), edge.start[1] + unitY * (startDistance + width)],
    ];
    const next = {
      ...activeGeometry,
      zones: activeGeometry.zones.map((zone) => zone.id === featureZoneId
        ? { ...zone, accessPoints: [...(zone.accessPoints || []), { id: `doorway-${globalThis.crypto.randomUUID()}`, kind: "doorway", segment }] }
        : zone),
    };
    setMode("custom");
    publish(next);
  }

  function selectTraceImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setEditorError("Choose a PNG, JPEG, or WebP image smaller than 10 MB.");
      event.target.value = "";
      return;
    }
    setTraceImageSize(null);
    setTracePoints([]);
    setTraceActive(false);
    setTraceImageUrl(URL.createObjectURL(file));
    setEditorError("");
  }

  function addTracePoint(event) {
    if (!traceActive || !traceImageBounds || !traceSvgRef.current) return;
    const bounds = traceSvgRef.current.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width * 400;
    const y = (event.clientY - bounds.top) / bounds.height * 260;
    if (x < traceImageBounds.x || x > traceImageBounds.x + traceImageBounds.width
      || y < traceImageBounds.y || y > traceImageBounds.y + traceImageBounds.height) return;
    setTracePoints((points) => [...points, {
      x: (x - traceImageBounds.x) / traceImageBounds.width,
      y: (y - traceImageBounds.y) / traceImageBounds.height,
    }]);
  }

  function applyTrace() {
    if (tracePoints.length < 3) {
      setEditorError("Trace at least three outline points before applying the room boundary.");
      return;
    }
    const minX = Math.min(...tracePoints.map((point) => point.x));
    const maxX = Math.max(...tracePoints.map((point) => point.x));
    const minY = Math.min(...tracePoints.map((point) => point.y));
    const maxY = Math.max(...tracePoints.map((point) => point.y));
    if (maxX - minX < 0.01 || maxY - minY < 0.01) {
      setEditorError("The traced outline needs measurable width and length.");
      return;
    }
    try {
      const base = withBaseGeometry(geometry, widthMm, lengthMm);
      const width = Number(widthMm);
      const length = Number(lengthMm);
      const boundary = tracePoints.map((point) => [
        Math.round(((point.x - minX) / (maxX - minX)) * width * 100) / 100,
        Math.round(((point.y - minY) / (maxY - minY)) * length * 100) / 100,
      ]);
      const next = {
        ...base,
        zones: base.zones.map((zone, index) => index === 0 ? { ...zone, boundary } : zone),
      };
      setCustomBoundary(serializeBoundary(boundary));
      setMode("custom");
      setTraceActive(false);
      publish(next);
    } catch (error) {
      setEditorError(error.message || "Could not apply the traced room boundary.");
    }
  }

  return (
    <section className="geometry-editor" aria-label="Room geometry">
      <div className="geometry-editor-heading"><div><strong>Room geometry</strong><span>BOUNDARIES / MM</span></div><RoomPreview geometry={geometry} widthMm={widthMm} lengthMm={lengthMm} /></div>
      <label className="input-label" htmlFor="room-shape-mode">Room outline <span>PLANNER SUPPORTS POLYGONS</span></label>
      <select id="room-shape-mode" className="text-control" value={mode} onChange={(event) => chooseMode(event.target.value)}>
        <option value="rectangle">Rectangle</option>
        <option value="l-shape">L-shaped room</option>
        <option value="custom">Custom polygon / multiple areas</option>
      </select>

      {mode === "l-shape" && <div className="input-row geometry-input-row">
        <label className="input-unit"><span>Notch width</span><div><input aria-label="Notch width mm" type="number" min="1" max={widthMm} value={notchWidth} onChange={(event) => setNotchWidth(event.target.value)} /><b>mm</b></div></label>
        <label className="input-unit"><span>Notch depth</span><div><input aria-label="Notch depth mm" type="number" min="1" max={lengthMm} value={notchDepth} onChange={(event) => setNotchDepth(event.target.value)} /><b>mm</b></div></label>
        <button className="geometry-action" type="button" onClick={() => chooseMode("l-shape")}>Apply L-shape</button>
      </div>}

      {mode === "custom" && <div className="geometry-custom-outline">
        <div className="geometry-trace">
          <label className="input-label" htmlFor="floor-plan-image">Trace from floor-plan image <span>PNG / JPG / WEBP · MAX 10 MB</span></label>
          <input id="floor-plan-image" className="geometry-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={selectTraceImage} />
          {traceImageUrl && traceImageBounds && <>
            <svg ref={traceSvgRef} className={`geometry-trace-canvas ${traceActive ? "is-tracing" : ""}`} viewBox="0 0 400 260" preserveAspectRatio="none" role="img" aria-label="Floor plan image. Click room boundary points in order while tracing is active." onPointerDown={addTracePoint}>
              <rect width="400" height="260" fill="#172226" />
              <image href={traceImageUrl} x={traceImageBounds.x} y={traceImageBounds.y} width={traceImageBounds.width} height={traceImageBounds.height} />
              {tracePoints.length > 1 && <polyline points={tracePoints.map((point) => `${traceImageBounds.x + point.x * traceImageBounds.width},${traceImageBounds.y + point.y * traceImageBounds.height}`).join(" ")} fill={tracePoints.length > 2 ? "rgba(0, 200, 220, .13)" : "none"} stroke="#00c8d8" strokeWidth="2" />}
              {tracePoints.map((point, index) => <circle key={index} cx={traceImageBounds.x + point.x * traceImageBounds.width} cy={traceImageBounds.y + point.y * traceImageBounds.height} r="3" fill="#00c8d8" stroke="#fff" strokeWidth="1" />)}
            </svg>
            <div className="geometry-trace-actions">
              <button className="geometry-action" type="button" onClick={() => { setTracePoints([]); setTraceActive(true); setEditorError(""); }}>Trace room outline</button>
              <button className="geometry-action secondary" type="button" onClick={() => setTracePoints((points) => points.slice(0, -1))} disabled={!tracePoints.length}>Undo point</button>
              <button className="geometry-action" type="button" onClick={applyTrace} disabled={tracePoints.length < 3}>Use traced outline</button>
            </div>
            <small className="geometry-trace-note">Click at least three points clockwise or counter-clockwise. The trace is scaled to the measured room width and length above. The image stays in this browser; only the point geometry is saved.</small>
          </>}
        </div>
        <label className="input-label" htmlFor="custom-room-boundary">Area 1 outline <span>ORDERED X,Y POINTS</span></label>
        <textarea id="custom-room-boundary" className="text-control geometry-points" value={customBoundary} onChange={(event) => setCustomBoundary(event.target.value)} />
        <button className="geometry-action" type="button" onClick={applyCustomBoundary}>Apply outline</button>
      </div>}

      {geometry && <>
        <div className="geometry-zone-list">
          {activeGeometry.zones.map((zone, index) => <div className="geometry-zone-row" key={zone.id}><span>Area {index + 1}</span><small>{zone.boundary.length} boundary points</small>{activeGeometry.zones.length > 1 && <button type="button" aria-label={`Remove area ${index + 1}`} onClick={() => removeArea(zone.id)}><Trash2 size={12} /></button>}</div>)}
        </div>
        <div className="geometry-add-area">
          <span className="field-kicker">ADD RECTANGULAR AREA</span>
          <div className="input-row geometry-input-row">
            <label className="input-unit"><span>X offset</span><div><input aria-label="New area X offset mm" type="number" value={zoneX} onChange={(event) => setZoneX(event.target.value)} /><b>mm</b></div></label>
            <label className="input-unit"><span>Y offset</span><div><input aria-label="New area Y offset mm" type="number" value={zoneY} onChange={(event) => setZoneY(event.target.value)} /><b>mm</b></div></label>
          </div>
          <div className="input-row geometry-input-row">
            <label className="input-unit"><span>Width</span><div><input aria-label="New area width mm" type="number" min="1" value={zoneWidth} onChange={(event) => setZoneWidth(event.target.value)} /><b>mm</b></div></label>
            <label className="input-unit"><span>Length</span><div><input aria-label="New area length mm" type="number" min="1" value={zoneLength} onChange={(event) => setZoneLength(event.target.value)} /><b>mm</b></div></label>
          </div>
          <button className="geometry-action" type="button" onClick={addArea}><Plus size={13} /> Add area</button>
        </div>

        <div className="geometry-zone-controls">
          <label className="input-label" htmlFor="feature-zone">Apply feature to</label>
          <select id="feature-zone" className="text-control" value={featureZoneId} onChange={(event) => setFeatureZoneId(event.target.value)}>
            {zoneOptions.map((zone) => <option value={zone.id} key={zone.id}>{zone.label}</option>)}
          </select>
          <div className="input-row geometry-input-row">
            <label className="input-unit"><span>X position</span><div><input aria-label="Feature X position mm" type="number" value={featureX} onChange={(event) => setFeatureX(event.target.value)} /><b>mm</b></div></label>
            <label className="input-unit"><span>Y position</span><div><input aria-label="Feature Y position mm" type="number" value={featureY} onChange={(event) => setFeatureY(event.target.value)} /><b>mm</b></div></label>
          </div>
          <div className="input-row geometry-input-row">
            <label className="input-unit"><span>Width</span><div><input aria-label="Feature width mm" type="number" min="1" value={featureWidth} onChange={(event) => setFeatureWidth(event.target.value)} /><b>mm</b></div></label>
            <label className="input-unit"><span>Length</span><div><input aria-label="Feature length mm" type="number" min="1" value={featureLength} onChange={(event) => setFeatureLength(event.target.value)} /><b>mm</b></div></label>
          </div>
          <div className="geometry-feature-actions">
            <button className="geometry-action" type="button" onClick={() => addRectangularFeature("obstacle")}><Plus size={13} /> Add column / obstacle</button>
            <button className="geometry-action secondary" type="button" onClick={() => addRectangularFeature("opening")}><Plus size={13} /> Add floor opening</button>
          </div>
          {activeGeometry.zones.map((zone) => <div className="geometry-feature-list" key={`${zone.id}-features`}>
            {[...(zone.obstacles || []).map((item) => ({ ...item, collection: "obstacles", label: "Obstacle" })), ...(zone.openings || []).map((item) => ({ ...item, collection: "openings", label: "Opening" }))].map((item) => <div className="geometry-zone-row" key={item.id}><span>{item.label} · Area {activeGeometry.zones.findIndex((entry) => entry.id === zone.id) + 1}</span><small>{item.id}</small><button type="button" aria-label={`Remove ${item.label.toLowerCase()} ${item.id}`} onClick={() => removeFeature(zone.id, item.collection, item.id)}><Trash2 size={12} /></button></div>)}
          </div>)}

          <div className="geometry-doorway-controls">
            <span className="field-kicker">WALL ACCESS / DOORWAYS</span>
            <label className="input-label" htmlFor="door-edge">Boundary edge</label>
            <select id="door-edge" className="text-control" value={doorEdge} onChange={(event) => setDoorEdge(event.target.value)}>
              {availableEdges.map((edge) => <option key={edge.index} value={edge.index}>Edge {edge.index + 1} · {Math.round(edge.length)} mm</option>)}
            </select>
            <div className="input-row geometry-input-row">
              <label className="input-unit"><span>Offset</span><div><input aria-label="Doorway offset mm" type="number" min="0" value={doorOffset} onChange={(event) => setDoorOffset(event.target.value)} /><b>mm</b></div></label>
              <label className="input-unit"><span>Width</span><div><input aria-label="Doorway width mm" type="number" min="1" value={doorWidth} onChange={(event) => setDoorWidth(event.target.value)} /><b>mm</b></div></label>
            </div>
            <button className="geometry-action" type="button" onClick={addDoorway}><Plus size={13} /> Add doorway</button>
          </div>
          {activeGeometry.zones.map((zone, zoneIndex) => (zone.accessPoints || []).map((item) => <div className="geometry-zone-row" key={item.id}><span>{item.kind} · Area {zoneIndex + 1}</span><small>{item.id}</small><button type="button" aria-label={`Remove doorway ${item.id}`} onClick={() => removeFeature(zone.id, "accessPoints", item.id)}><Trash2 size={12} /></button></div>))}
        </div>
      </>}

      {(editorError || geometryError) && <p className="geometry-error" role="alert">{editorError || geometryError}</p>}
      <p className="microcopy">Openings and obstacles are clipped from the floor. Doorways mark wall access only; they do not remove floor area.</p>
    </section>
  );
}
