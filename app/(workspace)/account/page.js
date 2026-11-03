import Link from "next/link";
import AuthForm from "../../../components/AuthForm.jsx";
import DeleteAccountForm from "../../../components/DeleteAccountForm.jsx";
import { getAuthContext } from "../../../lib/supabase/server.js";
import { isSupabaseConfigured } from "../../../lib/supabase/config.js";
import { redirect } from "next/navigation";

export const metadata = { title: "Account settings" };

export default async function AccountPage() {
  if (!isSupabaseConfigured()) redirect("/setup");
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") redirect("/login");

  return (
    <main id="main-content" className="workspace-main account-page">
      <span className="field-kicker">ACCOUNT / PRIVATE WORKSPACE</span>
      <h1>Account settings</h1>
      <section className="account-panel"><div><span className="field-kicker">SIGNED IN AS</span><strong>{auth.claims.email}</strong></div><Link href="/forgot-password">Reset password</Link></section>
      <section className="account-panel"><div><span className="field-kicker">DATA PORTABILITY</span><h2>Download your data</h2><p>Export projects, room inputs, saved calculation results, and installer comparisons as JSON.</p></div><a className="primary-action" href="/api/export">Download account data</a></section>
      <section className="account-panel account-delete-panel"><div><span className="field-kicker">PERMANENT ACTION</span><h2>Delete account</h2><p>All project data is owned by this account and will be deleted with it.</p></div><DeleteAccountForm /></section>
      <p className="account-privacy-note">Read the <Link href="/privacy">privacy and data-use notice</Link>.</p>
    </main>
  );
}
