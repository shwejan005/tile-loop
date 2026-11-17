import Link from "next/link";
import { signOutAction } from "../app/actions/auth.js";

export default function AppHeader({ email = "" }) {
  return (
    <header className="topbar app-topbar">
      <Link href={email ? "/dashboard" : "/"} className="brand" aria-label="TileLoop home">
        <span>TileLoop</span>
      </Link>
      {email ? (
        <nav className="account-nav" aria-label="Account navigation">
          <Link href="/dashboard">Projects</Link>
          <Link href="/evaluation">Evaluation</Link>
          <Link href="/account">Account</Link>
          <span className="account-email">{email}</span>
          <form action={signOutAction}><button className="header-button" type="submit">Sign out</button></form>
        </nav>
      ) : (
        <nav className="account-nav" aria-label="Account navigation">
          <Link href="/login">Sign in</Link>
          <Link className="header-button" href="/signup">Create installer account</Link>
        </nav>
      )}
    </header>
  );
}
