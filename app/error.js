"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({ error, reset }) {
  useEffect(() => {
    console.error("TileLoop page error:", error);
  }, [error]);

  return (
    <main className="error-page">
      <section>
        <span className="field-kicker">TILELOOP / RECOVERY</span>
        <h1>That didn’t go to plan.</h1>
        <p>The page hit an unexpected problem. Saved projects are stored in your account; retry or return to your workspace.</p>
        <div className="error-actions">
          <button type="button" onClick={() => reset()}>Try again</button>
          <Link href="/dashboard">Back to workspace</Link>
        </div>
      </section>
    </main>
  );
}
