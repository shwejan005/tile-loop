"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function AccountBackupImport() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function restoreBackup() {
    if (!file) return;
    startTransition(async () => {
      setMessage("");
      let contents;
      let summary;
      try {
        contents = await file.text();
        summary = JSON.parse(contents);
      } catch {
        setMessage("Choose a valid TileLoop account JSON backup.");
        return;
      }
      if (summary?.schema !== "tileloop-account-export/v1" || !Array.isArray(summary.projects)) {
        setMessage("This file is not a supported TileLoop account backup.");
        return;
      }
      const confirmed = window.confirm(
        `Restore ${summary.projects.length} project${summary.projects.length === 1 ? "" : "s"} as new copies in this account? Existing projects will not be overwritten.`,
      );
      if (!confirmed) return;

      try {
        const response = await fetch("/api/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: contents,
        });
        const result = await response.json();
        if (!response.ok) {
          setMessage(result.error || "Could not restore this backup.");
          return;
        }
        setMessage(`Restored ${result.restoredProjects} projects, ${result.restoredRoomPlans} room plans, and ${result.restoredOutcomes} installation outcomes.`);
        setFile(null);
        router.refresh();
      } catch {
        setMessage("The restore request could not reach TileLoop. Try again when you are online.");
      }
    });
  }

  return (
    <div className="account-backup-import">
      <label className="input-label" htmlFor="account-backup-file">TileLoop account backup <span>JSON · MAX 20 MB</span></label>
      <input id="account-backup-file" type="file" accept="application/json,.json" onChange={(event) => setFile(event.target.files?.[0] || null)} />
      <button className="outline-button" type="button" disabled={!file || isPending} onClick={restoreBackup}>
        {isPending ? "Restoring backup…" : "Restore as new projects"}
      </button>
      {message && <p className="account-backup-message" role="status">{message}</p>}
      <p className="microcopy">Restores room plans, calculation history, installer estimates, and field outcomes as new project copies. Existing data is not replaced.</p>
    </div>
  );
}
