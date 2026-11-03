import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import AuthForm from "../../components/AuthForm.jsx";
import AppHeader from "../../components/AppHeader.jsx";
import { isSupabaseConfigured } from "../../lib/supabase/config.js";
import { getAuthContext } from "../../lib/supabase/server.js";

export const metadata = { title: "Create your account" };

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
          <span className="field-kicker">YOUR PRIVATE WORKSPACE</span>
          <h1>Plan with confidence.</h1>
          <p>Create an account to keep projects and calculation history together.</p>
          <AuthForm mode="signup" />
          <div className="auth-links"><span>Already have an account? <Link href="/login">Sign in</Link></span><small>We’ll send a verification link to your email.</small></div>
        </section>
      </main>
    </div>
  );
}
