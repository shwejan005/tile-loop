import { redirect } from "next/navigation";
import { connection } from "next/server";
import AuthForm from "../../components/AuthForm.jsx";
import AppHeader from "../../components/AppHeader.jsx";
import { isSupabaseConfigured } from "../../lib/supabase/config.js";
import { getAuthContext } from "../../lib/supabase/server.js";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  await connection();
  if (!isSupabaseConfigured()) redirect("/setup");
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") redirect("/login");
  return (
    <div className="app-shell auth-shell">
      <AppHeader email={auth.claims.email || ""} />
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <main id="main-content" className="auth-page">
        <section className="auth-card">
          <span className="field-kicker">ACCOUNT RECOVERY</span>
          <h1>Choose a new password.</h1>
          <p>Use at least 12 characters. Your password is handled by Supabase Auth.</p>
          <AuthForm mode="reset" />
        </section>
      </main>
    </div>
  );
}
