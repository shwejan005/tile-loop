"use client";

import { useActionState } from "react";
import { deleteAccountAction } from "../app/actions/auth.js";

export default function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(deleteAccountAction, { error: "" });
  return (
    <form className="delete-account-form" action={formAction}>
      <label htmlFor="delete-confirmation">Type DELETE to confirm</label>
      <input id="delete-confirmation" name="confirmation" autoComplete="off" required />
      <label htmlFor="delete-password">Current password</label>
      <input id="delete-password" name="password" type="password" autoComplete="current-password" required />
      {state.error && <p className="auth-feedback auth-error" role="alert">{state.error}</p>}
      <button className="danger-button" type="submit" disabled={pending}>{pending ? "Deleting account…" : "Delete account and all project data"}</button>
      <p className="microcopy">This permanently deletes this account, its projects, room plans, calculation history, and comparisons.</p>
    </form>
  );
}
