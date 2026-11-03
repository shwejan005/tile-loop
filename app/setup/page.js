import Link from "next/link";
import AppHeader from "../../components/AppHeader.jsx";

export const metadata = { title: "Connect your account service" };

export default function SetupPage() {
  return (
    <div className="app-shell auth-shell">
      <AppHeader />
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <main id="main-content" className="auth-page">
        <section className="auth-card setup-card">
          <span className="field-kicker">TILELOOP / CONFIGURATION</span>
          <h1>Connect the account service</h1>
          <p>This deployment needs a Supabase project before accounts or saved plans can be used.</p>
          <ol>
            <li>Start the local service with <code>npm run supabase:start</code>, or create a Supabase hosted project.</li>
            <li>Copy <code>.env.example</code> to <code>.env.local</code> and set the project URL and publishable key.</li>
            <li>Apply the database migration with <code>npm run supabase:reset</code>.</li>
          </ol>
          <Link className="text-link" href="/">Back to TileLoop</Link>
        </section>
      </main>
    </div>
  );
}
