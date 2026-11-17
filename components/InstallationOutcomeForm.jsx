"use client";

import { useState, useTransition } from "react";
import { saveInstallationOutcomeAction } from "../app/actions/rooms.js";

function OffcutRows({ label, rows, onChange, onAdd, onRemove }) {
  return <fieldset className="offcut-outcome-group">
    <legend>{label}</legend>
    <p>Enter each rectangular piece as measured after cutting. Leave blank if not recorded.</p>
    {rows.map((row, index) => <div className="offcut-outcome-row" key={`${label}-${index}`}>
      <label><span>Width</span><input type="number" min="1" max="3000" step="0.01" value={row.widthMm} onChange={(event) => onChange(index, "widthMm", event.target.value)} aria-label={`${label} ${index + 1} width in millimeters`} /><b>mm</b></label>
      <label><span>Length</span><input type="number" min="1" max="3000" step="0.01" value={row.lengthMm} onChange={(event) => onChange(index, "lengthMm", event.target.value)} aria-label={`${label} ${index + 1} length in millimeters`} /><b>mm</b></label>
      <label><span>Quantity</span><input type="number" min="1" max="100000" step="1" value={row.quantity} onChange={(event) => onChange(index, "quantity", event.target.value)} aria-label={`${label} ${index + 1} quantity`} /></label>
      <button className="text-button" type="button" onClick={() => onRemove(index)}>Remove</button>
    </div>)}
    <button className="text-button offcut-add" type="button" onClick={onAdd}>Add {label.toLowerCase()}</button>
  </fieldset>;
}

export default function InstallationOutcomeForm({ projectId, roomPlanId, plannedStockTiles, suggestedOrderTiles, initialOutcome = null }) {
  const hasLegacyConsumptionBasis = Boolean(initialOutcome)
    && initialOutcome.consumption_basis !== "consumed-including-breakage-v1";
  const [actualTilesUsed, setActualTilesUsed] = useState(initialOutcome ? String(initialOutcome.actual_tiles_used) : "");
  const [actualTilesInstalled, setActualTilesInstalled] = useState(initialOutcome?.actual_tiles_installed == null ? "" : String(initialOutcome.actual_tiles_installed));
  const [breakageTiles, setBreakageTiles] = useState(initialOutcome?.breakage_tiles == null ? "" : String(initialOutcome.breakage_tiles));
  const [reusableOffcuts, setReusableOffcuts] = useState(() => (initialOutcome?.reusable_offcuts || []).map((row) => ({ widthMm: String(row.widthMm), lengthMm: String(row.lengthMm), quantity: String(row.quantity) })));
  const [discardedOffcuts, setDiscardedOffcuts] = useState(() => (initialOutcome?.discarded_offcuts || []).map((row) => ({ widthMm: String(row.widthMm), lengthMm: String(row.lengthMm), quantity: String(row.quantity) })));
  const [laborMinutes, setLaborMinutes] = useState(initialOutcome?.labor_minutes == null ? "" : String(initialOutcome.labor_minutes));
  const [practicalityRating, setPracticalityRating] = useState(initialOutcome?.practicality_rating == null ? "" : String(initialOutcome.practicality_rating));
  const [installerLabel, setInstallerLabel] = useState(initialOutcome?.installer_label || "");
  const [note, setNote] = useState(initialOutcome?.note || "");
  const [confirmConsumptionBasis, setConfirmConsumptionBasis] = useState(!hasLegacyConsumptionBasis);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [isSaving, startSaving] = useTransition();

  function updateOffcut(setRows, index, field, value) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  }

  function saveableOffcuts(rows) {
    return rows.filter((row) => row.widthMm !== "" || row.lengthMm !== "" || row.quantity !== "")
      .map((row) => ({ widthMm: Number(row.widthMm), lengthMm: Number(row.lengthMm), quantity: Number(row.quantity) }));
  }

  function saveOutcome(event) {
    event.preventDefault();
    setMessage("");
    setError(false);
    startSaving(async () => {
      const result = await saveInstallationOutcomeAction({
        projectId,
        roomPlanId,
        actualTilesUsed,
        actualTilesInstalled,
        confirmConsumptionBasis,
        breakageTiles,
        reusableOffcuts: saveableOffcuts(reusableOffcuts),
        discardedOffcuts: saveableOffcuts(discardedOffcuts),
        laborMinutes,
        practicalityRating,
        installerLabel,
        note,
      });
      if (result.error) {
        setError(true);
        setMessage(result.error);
        return;
      }
      setMessage(result.success);
    });
  }

  return (
    <section className="installation-outcome-panel" aria-labelledby="outcome-heading">
      <div className="outcome-heading"><div><span className="field-kicker">PILOT / FIELD VALIDATION</span><h2 id="outcome-heading">Record the installation</h2></div></div>
      <p className="outcome-description">Capture actual site use against the latest saved calculation. This is measured project data, not a supplier estimate.</p>
      {initialOutcome && <div className="outcome-comparison"><span>Planned stock estimate <strong>{plannedStockTiles ?? "—"}</strong></span><span>Suggested order with buffer <strong>{suggestedOrderTiles ?? "—"}</strong></span><span>Tiles consumed <strong>{initialOutcome.actual_tiles_used}</strong></span><span className={initialOutcome.actual_tiles_used - (plannedStockTiles || 0) > 0 ? "outcome-delta over" : "outcome-delta"}>{initialOutcome.actual_tiles_used - (plannedStockTiles || 0) > 0 ? "+" : ""}{initialOutcome.actual_tiles_used - (plannedStockTiles || 0)} vs planned stock</span></div>}
      <form className="outcome-form" onSubmit={saveOutcome}>
        {hasLegacyConsumptionBasis && <label className="outcome-rating outcome-basis-confirm"><input type="checkbox" checked={confirmConsumptionBasis} onChange={(event) => setConfirmConsumptionBasis(event.target.checked)} /> I confirm this older count is the total tiles taken from stock, including any broken tiles. It will then be included in accuracy metrics.</label>}
        <div className="input-row">
          <label className="input-unit"><span>Tiles consumed <small>REQUIRED · INCLUDES BREAKAGE</small></span><div><input aria-label="Tiles consumed including breakage" type="number" min="1" max="100000" step="1" required value={actualTilesUsed} onChange={(event) => setActualTilesUsed(event.target.value)} /><b>tiles</b></div></label>
          <label className="input-unit"><span>Breakage <small>OPTIONAL · SUBSET OF CONSUMED</small></span><div><input aria-label="Breakage tiles" type="number" min="0" max="100000" step="1" value={breakageTiles} onChange={(event) => setBreakageTiles(event.target.value)} /><b>tiles</b></div></label>
        </div>
        <label className="input-unit installed-count"><span>Tiles installed <small>OPTIONAL · EXCLUDES BROKEN TILES</small></span><div><input aria-label="Tiles installed excluding breakage" type="number" min="0" max="100000" step="1" value={actualTilesInstalled} onChange={(event) => setActualTilesInstalled(event.target.value)} /><b>tiles</b></div></label>
        <div className="input-row">
          <label className="input-unit"><span>Installation time <small>OPTIONAL</small></span><div><input aria-label="Installation time minutes" type="number" min="1" max="100000" step="1" value={laborMinutes} onChange={(event) => setLaborMinutes(event.target.value)} /><b>min</b></div></label>
          <label className="input-label outcome-rating" htmlFor="practicality-rating">Plan practicality <span>OPTIONAL</span><select id="practicality-rating" className="text-control" value={practicalityRating} onChange={(event) => setPracticalityRating(event.target.value)}><option value="">Not rated</option><option value="1">1 · Difficult</option><option value="2">2 · Below average</option><option value="3">3 · Acceptable</option><option value="4">4 · Practical</option><option value="5">5 · Very practical</option></select></label>
        </div>
        <div className="offcut-outcome-grid">
          <OffcutRows label="Reusable offcuts" rows={reusableOffcuts} onChange={(index, field, value) => updateOffcut(setReusableOffcuts, index, field, value)} onAdd={() => setReusableOffcuts((rows) => [...rows, { widthMm: "", lengthMm: "", quantity: "" }])} onRemove={(index) => setReusableOffcuts((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} />
          <OffcutRows label="Discarded material" rows={discardedOffcuts} onChange={(index, field, value) => updateOffcut(setDiscardedOffcuts, index, field, value)} onAdd={() => setDiscardedOffcuts((rows) => [...rows, { widthMm: "", lengthMm: "", quantity: "" }])} onRemove={(index) => setDiscardedOffcuts((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} />
        </div>
        <label className="input-label" htmlFor="installer-label">Installer / crew label <span>OPTIONAL · PRIVATE TO THIS ACCOUNT</span></label>
        <input id="installer-label" className="text-control" maxLength={80} value={installerLabel} onChange={(event) => setInstallerLabel(event.target.value)} placeholder="Crew A or installer initials" />
        <label className="input-label" htmlFor="outcome-note">Site notes <span>OPTIONAL · 1,000 CHARACTERS</span></label>
        <textarea id="outcome-note" className="text-control outcome-note" maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record changes, unusable offcuts, or site conditions." />
        {message && <p className={`outcome-message ${error ? "is-error" : ""}`} role={error ? "alert" : "status"}>{message}</p>}
        <button className="geometry-action outcome-save" type="submit" disabled={isSaving || !actualTilesUsed || (hasLegacyConsumptionBasis && !confirmConsumptionBasis)}>{isSaving ? "Saving field outcome…" : initialOutcome ? "Update installation outcome" : "Save installation outcome"}</button>
      </form>
      <p className="microcopy">Tiles consumed means the total taken from stock for this job, including broken tiles. Breakage is a subset. Outcomes are linked to an immutable calculation version; compare similar room, tile, pattern, and site conditions.</p>
    </section>
  );
}
