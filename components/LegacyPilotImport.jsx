"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Upload } from "lucide-react";
import {
  LEGACY_PILOT_STORAGE_KEY,
  PILOT_STORAGE_KEY,
  createPilotBackup,
  normalizePilotEntry,
  parsePilotBackup,
} from "../lib/pilot-data.js";
import { importLegacyPilotBackupAction } from "../app/actions/rooms.js";

function readLegacyEntries() {
  try {
    let key = PILOT_STORAGE_KEY;
    let raw = window.localStorage.getItem(key);
    let fromLegacy = false;
    if (raw === null) {
      key = LEGACY_PILOT_STORAGE_KEY;
      raw = window.localStorage.getItem(key);
      fromLegacy = raw !== null;
    }
    const records = JSON.parse(raw || "[]");
    if (!Array.isArray(records)) return { entries: [], key: null };
    return {
      entries: records.map((entry) => normalizePilotEntry(entry, { legacy: fromLegacy, allowInvalidEstimate: true })).filter(Boolean),
      key: raw === null ? null : key,
    };
  } catch {
    return { entries: [], key: null };
  }
}

export default function LegacyPilotImport() {
  const [entries, setEntries] = useState(() => readLegacyEntries().entries);
  const [localKey, setLocalKey] = useState(() => readLegacyEntries().key);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const fileInputRef = useRef(null);
  const router = useRouter();

  async function importEntries(nextEntries = entries, removeLocalKey = localKey) {
    if (!nextEntries.length) {
      setMessage("No prior room records were found in that backup.");
      return;
    }
    if (!window.confirm(`Import ${nextEntries.length} room records into a new private project? Illustrative demo rows will be skipped.`)) return;
    setPending(true);
    setMessage("");
    try {
      const backup = createPilotBackup(nextEntries);
      const result = await importLegacyPilotBackupAction(JSON.stringify(backup));
      if (result.error) {
        setMessage(result.error);
        return;
      }
      if (removeLocalKey) {
        window.localStorage.removeItem(removeLocalKey);
        if (removeLocalKey !== PILOT_STORAGE_KEY) window.localStorage.removeItem(PILOT_STORAGE_KEY);
        if (removeLocalKey !== LEGACY_PILOT_STORAGE_KEY) window.localStorage.removeItem(LEGACY_PILOT_STORAGE_KEY);
      }
      router.push(`/projects/${result.projectId}`);
      router.refresh();
    } catch (error) {
      setMessage(error.message || "Could not prepare the import.");
    } finally {
      setPending(false);
    }
  }

  async function readBackup(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (file.size > 1_000_000) {
      setMessage("Backup files must be smaller than 1 MB.");
      return;
    }
    try {
      const parsed = parsePilotBackup(await file.text());
      setEntries(parsed);
      setLocalKey(null);
      setMessage(`${parsed.length} backup records are ready to import.`);
    } catch (error) {
      setMessage(error.message || "Could not read this TileLoop backup.");
    }
  }

  return (
    <section id="legacy-import" className="legacy-import-panel">
      <div><span className="field-kicker">DATA MIGRATION</span><h2>Bring in earlier pilot records</h2><p>Import an earlier browser-local pilot log or its JSON backup into a new private project. Illustrative demo rows are never imported as installer results.</p></div>
      <div className="legacy-import-actions">
        <span className="legacy-import-count">{entries.length ? `${entries.length} records ready` : "No local records detected"}</span>
        <input ref={fileInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={readBackup} aria-label="Choose an earlier TileLoop JSON backup" />
        <button className="outline-button" type="button" onClick={() => fileInputRef.current?.click()}><FileUp size={13} /> Choose backup</button>
        <button className="primary-action" type="button" onClick={() => importEntries()} disabled={!entries.length || pending}><Upload size={13} /> {pending ? "Importing…" : "Import to project"}</button>
        {message && <p className="legacy-import-message" role="status">{message}</p>}
      </div>
    </section>
  );
}
