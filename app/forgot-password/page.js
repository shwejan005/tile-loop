import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import AuthForm from "../../components/AuthForm.jsx";
import AppHeader from "../../components/AppHeader.jsx";
import { isSupabaseConfigured } from "../../lib/supabase/config.js";

export const metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage() {
  await connection();
  if (!isSupabaseConfigured()) redirect("/setup");
  return (
    <div className="app-shell auth-shell">
      <AppHeader />
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <main id="main-content" className="auth-page">
        <section className="auth-card">
          <span className="field-kicker">ACCOUNT RECOVERY</span>
          <h1>Reset your password.</h1>
          <p>If an account exists for the email, we’ll send a one-time reset link.</p>
          <AuthForm mode="forgot" />
          <div className="auth-links"><Link href="/login">Back to sign in</Link></div>
        </section>
      </main>
    </div>
  );
}
