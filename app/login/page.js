import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import AuthForm from "../../components/AuthForm.jsx";
import AppHeader from "../../components/AppHeader.jsx";
import { safeRedirectPath, isSupabaseConfigured } from "../../lib/supabase/config.js";
import { getAuthContext } from "../../lib/supabase/server.js";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }) {
  await connection();
  if (!isSupabaseConfigured()) redirect("/setup");
  const auth = await getAuthContext();
  const params = await searchParams;
  const next = safeRedirectPath(params?.next);
  if (auth.status === "authenticated") redirect(next);

  return (
    <div className="app-shell auth-shell">
      <AppHeader />
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <main id="main-content" className="auth-page">
        <section className="auth-card">
          <span className="field-kicker">PRIVATE WORKSPACE</span>
          <h1>Welcome back.</h1>
          <p>Sign in to open your projects and saved room plans.</p>
          <AuthForm mode="login" next={next} initialError={params?.error === "confirmation" ? "The confirmation link expired or could not be verified. Request a new link or sign in." : ""} />
          <div className="auth-links"><Link href="/forgot-password">Forgot password?</Link><span>New to TileLoop? <Link href="/signup">Create an account</Link></span></div>
        </section>
      </main>
    </div>
  );
}
