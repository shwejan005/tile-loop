"use client";

import { useActionState } from "react";
import {
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from "../app/actions/auth.js";

const INITIAL_STATE = { error: "", success: "" };

export default function AuthForm({ mode, next = "/dashboard", initialError = "" }) {
  const actions = {
    login: signInAction,
    signup: signUpAction,
    forgot: requestPasswordResetAction,
    reset: updatePasswordAction,
  };
  const [state, formAction, pending] = useActionState(actions[mode], { ...INITIAL_STATE, error: initialError });

  return (
    <form className="auth-form" action={formAction}>
      {mode !== "reset" && <label>Email address<input autoComplete="email" name="email" type="email" maxLength={254} required /></label>}
      {mode === "login" && <input name="next" type="hidden" value={next} />}
      {(mode === "login" || mode === "signup" || mode === "reset") && (
        <label>{mode === "reset" ? "New password" : "Password"}<input autoComplete={mode === "login" ? "current-password" : "new-password"} name="password" type="password" minLength={12} maxLength={128} required /></label>
      )}
      {(mode === "signup" || mode === "reset") && (
        <label>Confirm password<input autoComplete="new-password" name="confirmPassword" type="password" minLength={12} maxLength={128} required /></label>
      )}
      {state.error && <p className="auth-feedback auth-error" role="alert">{state.error}</p>}
      {state.success && <p className="auth-feedback auth-success" role="status">{state.success}</p>}
      <button className="primary-action" type="submit" disabled={pending}>
        {pending ? "Please wait…" : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Update password"}
      </button>
    </form>
  );
}
