import Link from "next/link";

export default function NotFound() {
  return (
    <main className="error-page">
      <section>
        <span className="field-kicker">TILELOOP / 404</span>
        <h1>Page not found.</h1>
        <p>That address doesn’t match a TileLoop page or a project you can access.</p>
        <div className="error-actions"><Link href="/dashboard">Open your workspace</Link></div>
      </section>
    </main>
  );
}
