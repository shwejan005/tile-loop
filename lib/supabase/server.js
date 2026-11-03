import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseConfig, isSupabaseConfigured } from "./config.js";

export async function createClient() {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
  const { url, publishableKey } = getSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. The root Proxy refreshes
          // sessions and persists refreshed cookies on each matched request.
        }
      },
    },
  });
}

export async function getAuthContext() {
  if (!isSupabaseConfigured()) return { status: "unconfigured", supabase: null, claims: null };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error) {
      if (error.status === 401 || error.name === "AuthSessionMissingError") {
        return { status: "anonymous", supabase, claims: null };
      }
      return { status: "unavailable", supabase: null, claims: null };
    }
    return data?.claims?.sub
      ? { status: "authenticated", supabase, claims: data.claims }
      : { status: "anonymous", supabase, claims: null };
  } catch {
    return { status: "unavailable", supabase: null, claims: null };
  }
}

export async function requireAuthContext() {
  const auth = await getAuthContext();
  if (auth.status === "unconfigured") redirect("/setup");
  if (auth.status === "anonymous") redirect("/login");
  if (auth.status !== "authenticated") throw new Error("Account service is temporarily unavailable.");
  return auth;
}
