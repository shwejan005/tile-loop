import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import AppHeader from "../components/AppHeader.jsx";
import LandingProductPreview from "../components/LandingProductPreview.jsx";
import { getAuthContext } from "../lib/supabase/server.js";
import { isSupabaseConfigured } from "../lib/supabase/config.js";

export default async function HomePage() {
  await connection();
  if (isSupabaseConfigured()) {
    const auth = await getAuthContext();
    if (auth.status === "authenticated") redirect("/dashboard");
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <main id="main-content">
        <section className="hero landing-hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-chip">B2B / TILE INSTALLER SOFTWARE</span><span>FOR INSTALLERS + CONTRACTORS</span></div>
            <h1>PLAN THE CUT.<br /><span>KNOW THE ASSUMPTIONS.</span></h1>
            <p>Built for professional tile installers and contracting businesses: plan layouts, review cuts, and record actual job use. Homeowners and project clients can view a read-only plan shared by their installer.</p>
            <div className="landing-actions"><Link className="primary-action inline-action" href={isSupabaseConfigured() ? "/signup" : "/setup"}>Create installer workspace</Link><Link className="landing-secondary" href="/demo">Try the interactive demo</Link><Link className="landing-secondary" href="/login">Sign in</Link></div>
          </div>
          <LandingProductPreview />
        </section>

        <section className="landing-audience" aria-label="TileLoop audience and business model">
          <article className="landing-audience-card">
            <span className="field-kicker">PRIMARY MARKET · B2B</span>
            <h2>Tile installers and contractors</h2>
            <p>Buyer hypothesis: an installation-business owner or contractor. Daily user: an estimator or installer; owner-operators may be both. They manage room plans, material estimates, and job outcomes.</p>
          </article>
          <article className="landing-audience-card landing-audience-secondary">
            <span className="field-kicker">SECONDARY ROLE · CLIENT VIEWER</span>
            <h2>Homeowners and project clients</h2>
            <p>They can review a contractor-shared plan through a read-only link. They are not the primary buyer or planning user.</p>
          </article>
          <p className="landing-model-note"><strong>Business model status</strong> TileLoop is positioned as B2B trade software. Pricing and packaging are not validated; the current product has individual account ownership, with no billing or company-seat management.</p>
        </section>

        <section className="landing-details">
          <div><span className="section-index">01</span><h2>Plan. Inspect. Verify.</h2><p>TileLoop records versioned room geometry and layout assumptions, then lets the account owner compare an estimate with measured installation outcomes.</p></div>
          <div className="landing-boundary"><strong>Estimates need review</strong><p>Cut nesting is heuristic. Verify offcut use and carton quantities with the installer and product packaging; pilot statistics are not proof of savings.</p></div>
        </section>
      </main>
      <footer className="footer"><div className="footer-brand">TileLoop</div><p>Estimates, not a substitute for on-site professional judgment.</p><Link href={isSupabaseConfigured() ? "/signup" : "/setup"}>GET STARTED</Link></footer>
    </div>
  );
}
