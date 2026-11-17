import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import AuthForm from "../../components/AuthForm.jsx";
import AppHeader from "../../components/AppHeader.jsx";
import { isSupabaseConfigured } from "../../lib/supabase/config.js";
import { getAuthContext } from "../../lib/supabase/server.js";

export const metadata = { title: "Create installer workspace" };

export default async function SignupPage() {
  await connection();
  if (!isSupabaseConfigured()) redirect("/setup");
  const auth = await getAuthContext();
  if (auth.status === "authenticated") redirect("/dashboard");

  return (
    <div className="app-shell auth-shell">
      <AppHeader />
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <main id="main-content" className="auth-page">
        <section className="auth-card">
          <span className="field-kicker">FOR TILE INSTALLERS + CONTRACTORS</span>
          <h1>Create your installer workspace.</h1>
          <p>Keep project plans and calculation history under your installer account. Customers can review plans through read-only links.</p>
          <AuthForm mode="signup" />
          <div className="auth-links"><span>Already have an account? <Link href="/login">Sign in</Link></span><small>We’ll send a verification link to your email.</small></div>
        </section>
      </main>
    </div>
  );
}
