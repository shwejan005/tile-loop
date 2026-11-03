import Link from "next/link";
import AppHeader from "../../components/AppHeader.jsx";

export const metadata = { title: "Privacy and data use" };

export default function PrivacyPage() {
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="privacy-page">
        <span className="field-kicker">TILELOOP / PRIVACY</span>
        <h1>Privacy and data use</h1>
        <p>TileLoop uses Supabase Auth to manage account email and sign-in credentials. Room measurements, project labels, calculation snapshots, and installer estimates are stored in the configured Supabase project and are private to the account that created them.</p>
        <h2>How data is used</h2>
        <p>Project data is used to calculate, display, and preserve tile-planning results. The current app does not include advertising or product analytics. Do not enter personal data about customers or workers in project labels or comparison notes.</p>
        <h2>Retention and deletion</h2>
        <p>Records remain until the account owner deletes a project or deletes the account. Account deletion requires a current password and permanently removes the account’s project data.</p>
        <h2>Service provider and deployment</h2>
        <p>Authentication and database processing are provided by the Supabase project selected by the service operator. Before public launch, the operator must publish their legal identity, contact address, hosting region, retention policy, and any jurisdiction-specific privacy terms.</p>
        <Link href="/">Back to TileLoop</Link>
      </main>
    </div>
  );
}
