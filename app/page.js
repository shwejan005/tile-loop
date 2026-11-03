import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import AppHeader from "../components/AppHeader.jsx";
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
            <div className="eyebrow"><span className="eyebrow-chip">TILELOOP / FIELD PLANNING</span><span>MEASURE · PLAN · VERIFY</span></div>
            <h1>PLAN THE CUT.<br /><span>KNOW THE ASSUMPTIONS.</span></h1>
            <p>Model room areas and obstacles, inspect tile layouts and numbered cuts, then compare the plan with what installers actually use on site.</p>
            <div className="landing-actions"><Link className="primary-action inline-action" href={isSupabaseConfigured() ? "/signup" : "/setup"}>Create your workspace <span>→</span></Link><Link className="landing-secondary" href="/demo">Try the interactive demo</Link><Link className="landing-secondary" href="/login">Sign in</Link></div>
          </div>
          <div className="hero-side landing-points">
            <div className="hero-rule" />
            <p><span>01</span> POLYGON ROOM AREAS</p>
            <p><span>02</span> THREE LAYOUT PATTERNS</p>
            <p><span>03</span> NUMBERED CUTS + OUTCOMES</p>
          </div>
        </section>

        <section className="landing-details">
          <div><span className="section-index">01</span><h2>Plan. Inspect. Verify.</h2><p>TileLoop records versioned room geometry and layout assumptions, then lets a team compare the estimate with measured installation outcomes.</p></div>
          <div className="landing-boundary"><strong>Estimates need review</strong><p>Cut nesting is heuristic. Verify offcut use and carton quantities with the installer and product packaging; pilot statistics are not proof of savings.</p></div>
        </section>
      </main>
      <footer className="footer"><div className="footer-brand"><span className="brand-mark"><i /><i /><i /><i /></span><span>tileloop</span></div><p>Estimates, not a substitute for on-site professional judgment.</p><Link href={isSupabaseConfigured() ? "/signup" : "/setup"}>GET STARTED ↗</Link></footer>
    </div>
  );
}
