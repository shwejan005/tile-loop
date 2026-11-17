"use client";

import { useState, useTransition } from "react";
import { createProjectShareLinkAction, revokeProjectShareLinkAction } from "../app/actions/projects.js";

export default function ProjectShareControl({ projectId, hasActiveShare }) {
  const [active, setActive] = useState(hasActiveShare);
  const [sharePath, setSharePath] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function createLink() {
    setMessage("");
    startTransition(async () => {
      const result = await createProjectShareLinkAction(projectId);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setSharePath(`${window.location.origin}${result.path}`);
      setActive(true);
      setMessage("New read-only link created. Any previous link has been revoked.");
    });
  }

  function revokeLink() {
    setMessage("");
    startTransition(async () => {
      const result = await revokeProjectShareLinkAction(projectId);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setActive(false);
      setSharePath("");
      setMessage("Share link revoked.");
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(sharePath);
      setMessage("Link copied.");
    } catch {
      const field = document.getElementById(`share-link-${projectId}`);
      field?.focus();
      field?.select();
      setMessage("Select and copy the link from the field.");
    }
  }

  return (
    <section className="project-share-control" aria-labelledby="share-project-heading">
      <div><span className="field-kicker">SECONDARY AUDIENCE · HOMEOWNER / CLIENT</span><h2 id="share-project-heading">Read-only project handoff</h2><p>Share saved surface plans and cut quantities with a homeowner or project client. They can review the work but cannot edit this project.</p></div>
      <div className="project-share-actions">
        <button className="outline-button" type="button" onClick={createLink} disabled={pending}>
          {pending ? "Creating…" : active ? "Replace share link" : "Create read-only link"}
        </button>
        {active && <button className="text-button danger-text-button" type="button" onClick={revokeLink} disabled={pending}>Revoke link</button>}
      </div>
      {active && !sharePath && <p className="share-status">A link is active. Replace it to generate a fresh URL you can copy.</p>}
      {sharePath && <div className="share-url-row"><input id={`share-link-${projectId}`} aria-label="Read-only share URL" value={sharePath} readOnly /><button className="text-button" type="button" onClick={copyLink}>Copy link</button></div>}
      {message && <p className="share-status" role="status">{message}</p>}
    </section>
  );
}
