"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getApplicationUrl, safeRedirectPath, isSupabaseConfigured } from "../../lib/supabase/config.js";
import { createClient, getAuthContext } from "../../lib/supabase/server.js";
import { createAdminClient } from "../../lib/supabase/admin.js";

const emailSchema = z.string().trim().email().max(254);
const passwordSchema = z.string().min(12).max(128);

function readString(formData, key) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function unavailableState() {
  return { error: "Authentication is not configured yet. Ask the site administrator to finish setup." };
}

export async function signInAction(_previousState, formData) {
  if (!isSupabaseConfigured()) return unavailableState();
  const parsedEmail = emailSchema.safeParse(readString(formData, "email"));
  const password = readString(formData, "password");
  if (!parsedEmail.success || !password || password.length > 128) {
    return { error: "Enter a valid email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsedEmail.data, password });
  if (error) return { error: "Email or password is incorrect." };

  redirect(safeRedirectPath(readString(formData, "next")));
}

export async function signUpAction(_previousState, formData) {
  if (!isSupabaseConfigured()) return unavailableState();
  const parsedEmail = emailSchema.safeParse(readString(formData, "email"));
  const password = readString(formData, "password");
  const confirmPassword = readString(formData, "confirmPassword");
  if (!parsedEmail.success) return { error: "Enter a valid email address." };
  if (!passwordSchema.safeParse(password).success) {
    return { error: "Use a password between 12 and 128 characters." };
  }
  if (password !== confirmPassword) return { error: "The passwords do not match." };

  const supabase = await createClient();
  const redirectTo = new URL("/auth/callback?next=/dashboard", getApplicationUrl()).toString();
  const { error } = await supabase.auth.signUp({
    email: parsedEmail.data,
    password,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) return { error: "We could not start registration. Check the email and try again." };
  return { success: "If registration was accepted, a confirmation link will arrive by email." };
}

export async function requestPasswordResetAction(_previousState, formData) {
  if (!isSupabaseConfigured()) return unavailableState();
  const parsedEmail = emailSchema.safeParse(readString(formData, "email"));
  if (!parsedEmail.success) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const redirectTo = new URL("/auth/callback?next=/reset-password", getApplicationUrl()).toString();
  const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail.data, { redirectTo });
  if (error) return { error: "We could not send the reset email right now. Please try again later." };
  return { success: "If an account exists for that email, a reset link will arrive shortly." };
}

export async function updatePasswordAction(_previousState, formData) {
  if (!isSupabaseConfigured()) return unavailableState();
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") return { error: "Your reset session expired. Request a new password reset link." };

  const password = readString(formData, "password");
  const confirmPassword = readString(formData, "confirmPassword");
  if (!passwordSchema.safeParse(password).success) {
    return { error: "Use a password between 12 and 128 characters." };
  }
  if (password !== confirmPassword) return { error: "The passwords do not match." };

  const { error } = await auth.supabase.auth.updateUser({ password });
  if (error) return { error: "We could not update the password. Request a new reset link and try again." };
  redirect("/dashboard");
}

export async function signOutAction() {
  const auth = await getAuthContext();
  if (auth.supabase) await auth.supabase.auth.signOut();
  redirect("/login");
}

export async function deleteAccountAction(_previousState, formData) {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") return { error: "Sign in again before deleting this account." };
  const admin = createAdminClient();
  if (!admin) return { error: "Account deletion is unavailable until the server-only Supabase secret key is configured." };

  const password = readString(formData, "password");
  const confirmation = readString(formData, "confirmation");
  if (confirmation !== "DELETE") return { error: "Type DELETE exactly to confirm account removal." };
  if (!password || password.length > 128 || !auth.claims.email) return { error: "Enter your current password to continue." };

  const { error: reauthenticationError } = await auth.supabase.auth.signInWithPassword({
    email: auth.claims.email,
    password,
  });
  if (reauthenticationError) return { error: "The password could not be verified. Nothing was deleted." };

  const { error: deletionError } = await admin.auth.admin.deleteUser(auth.claims.sub);
  if (deletionError) {
    console.error("Account deletion failed:", deletionError.status || "unknown");
    return { error: "Account deletion failed. No project data was intentionally removed; contact support." };
  }

  try {
    await auth.supabase.auth.signOut({ scope: "local" });
  } catch {
    // The auth user may already be removed; redirecting still completes cleanup.
  }
  redirect("/account/deleted");
}
