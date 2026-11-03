"use client";

import { useActionState } from "react";
import { createProjectAction } from "../app/actions/projects.js";

export default function ProjectForm() {
  const [state, formAction, pending] = useActionState(createProjectAction, { error: "" });
  return (
    <form className="project-create-form" action={formAction}>
      <label htmlFor="project-name">Project name</label>
      <div><input id="project-name" name="name" maxLength={100} placeholder="e.g. Al Noor apartment" required /><button type="submit" disabled={pending}>{pending ? "Creating…" : "Create project"}</button></div>
      {state.error && <p className="auth-feedback auth-error" role="alert">{state.error}</p>}
    </form>
  );
}
