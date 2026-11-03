import Link from "next/link";

export const metadata = { title: "Account deleted" };

export default function AccountDeletedPage() {
  return (
    <main className="error-page">
      <section>
        <span className="field-kicker">TILELOOP / ACCOUNT</span>
        <h1>Account deleted.</h1>
        <p>Your account and its project records have been removed.</p>
        <div className="error-actions"><Link href="/">Return to TileLoop</Link></div>
      </section>
    </main>
  );
}
