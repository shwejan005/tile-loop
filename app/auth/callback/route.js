import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server.js";
import { getApplicationUrl, isSupabaseConfigured, safeRedirectPath } from "../../../lib/supabase/config.js";

export async function GET(request) {
  if (!isSupabaseConfigured()) return redirectWithoutCache(new URL("/setup", request.url));

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeRedirectPath(url.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectWithoutCache(new URL(next, getApplicationUrl()));
  }
  return redirectWithoutCache(new URL("/login?error=confirmation", getApplicationUrl()));
}

function redirectWithoutCache(url) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
