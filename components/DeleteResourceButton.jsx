"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteProjectAction, deleteRoomPlanAction } from "../app/actions/projects.js";

export default function DeleteResourceButton({ type, projectId, roomPlanId, label }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function remove() {
    const prompt = type === "project"
      ? `Delete “${label}” and all its room plans and calculation history? This cannot be undone.`
      : `Delete room plan “${label}” and its calculation history? This cannot be undone.`;
    if (!window.confirm(prompt)) return;
    setMessage("");
    startTransition(async () => {
      const result = type === "project"
        ? await deleteProjectAction(projectId)
        : await deleteRoomPlanAction(projectId, roomPlanId);
      if (result?.error) {
        setMessage(result.error);
        return;
      }
      if (type === "room") {
        router.replace(`/projects/${projectId}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="delete-resource-wrap">
      <button className="danger-button" type="button" onClick={remove} disabled={pending}>
        <Trash2 size={14} /> {pending ? "Deleting…" : type === "project" ? "Delete project" : "Delete room plan"}
      </button>
      {message && <span className="delete-resource-message" role="alert">{message}</span>}
    </div>
  );
}
