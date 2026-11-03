"use client";

import { useState, useTransition } from "react";
import { Check, ClipboardCheck } from "lucide-react";
import { saveInstallationOutcomeAction } from "../app/actions/rooms.js";

export default function InstallationOutcomeForm({ projectId, roomPlanId, estimatedTiles, initialOutcome = null }) {
  const [actualTilesUsed, setActualTilesUsed] = useState(initialOutcome ? String(initialOutcome.actual_tiles_used) : "");
  const [breakageTiles, setBreakageTiles] = useState(initialOutcome?.breakage_tiles == null ? "" : String(initialOutcome.breakage_tiles));
  const [laborMinutes, setLaborMinutes] = useState(initialOutcome?.labor_minutes == null ? "" : String(initialOutcome.labor_minutes));
  const [practicalityRating, setPracticalityRating] = useState(initialOutcome?.practicality_rating == null ? "" : String(initialOutcome.practicality_rating));
  const [note, setNote] = useState(initialOutcome?.note || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [isSaving, startSaving] = useTransition();

  function saveOutcome(event) {
    event.preventDefault();
    setMessage("");
    setError(false);
    startSaving(async () => {
      const result = await saveInstallationOutcomeAction({
        projectId,
        roomPlanId,
        actualTilesUsed,
        breakageTiles,
        laborMinutes,
        practicalityRating,
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
      <div className="outcome-heading"><div><span className="field-kicker">PILOT / FIELD VALIDATION</span><h2 id="outcome-heading">Record the installation</h2></div><ClipboardCheck size={17} /></div>
      <p className="outcome-description">Capture actual site use against the latest saved calculation. This is measured project data, not a supplier estimate.</p>
      {initialOutcome && <div className="outcome-comparison"><span>TileLoop suggested order <strong>{estimatedTiles ?? "—"}</strong></span><span>Actual tiles used <strong>{initialOutcome.actual_tiles_used}</strong></span><span className={initialOutcome.actual_tiles_used - (estimatedTiles || 0) > 0 ? "outcome-delta over" : "outcome-delta"}>{initialOutcome.actual_tiles_used - (estimatedTiles || 0) > 0 ? "+" : ""}{initialOutcome.actual_tiles_used - (estimatedTiles || 0)} tiles vs suggested order</span></div>}
      <form className="outcome-form" onSubmit={saveOutcome}>
        <div className="input-row">
          <label className="input-unit"><span>Actual tiles used <small>REQUIRED</small></span><div><input aria-label="Actual tiles used" type="number" min="1" max="100000" step="1" required value={actualTilesUsed} onChange={(event) => setActualTilesUsed(event.target.value)} /><b>tiles</b></div></label>
          <label className="input-unit"><span>Breakage <small>OPTIONAL</small></span><div><input aria-label="Breakage tiles" type="number" min="0" max="100000" step="1" value={breakageTiles} onChange={(event) => setBreakageTiles(event.target.value)} /><b>tiles</b></div></label>
        </div>
        <div className="input-row">
          <label className="input-unit"><span>Installation time <small>OPTIONAL</small></span><div><input aria-label="Installation time minutes" type="number" min="1" max="100000" step="1" value={laborMinutes} onChange={(event) => setLaborMinutes(event.target.value)} /><b>min</b></div></label>
          <label className="input-label outcome-rating" htmlFor="practicality-rating">Plan practicality <span>OPTIONAL</span><select id="practicality-rating" className="text-control" value={practicalityRating} onChange={(event) => setPracticalityRating(event.target.value)}><option value="">Not rated</option><option value="1">1 · Difficult</option><option value="2">2 · Below average</option><option value="3">3 · Acceptable</option><option value="4">4 · Practical</option><option value="5">5 · Very practical</option></select></label>
        </div>
        <label className="input-label" htmlFor="outcome-note">Site notes <span>OPTIONAL · 1,000 CHARACTERS</span></label>
        <textarea id="outcome-note" className="text-control outcome-note" maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record changes, unusable offcuts, or site conditions." />
        {message && <p className={`outcome-message ${error ? "is-error" : ""}`} role={error ? "alert" : "status"}>{!error && <Check size={12} />}{message}</p>}
        <button className="geometry-action outcome-save" type="submit" disabled={isSaving || !actualTilesUsed}>{isSaving ? "Saving field outcome…" : initialOutcome ? "Update installation outcome" : "Save installation outcome"}</button>
      </form>
      <p className="microcopy">Outcomes are linked to an immutable calculation version. Use comparable room, tile, and site assumptions when evaluating accuracy.</p>
    </section>
  );
}
