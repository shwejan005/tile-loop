import { redirect } from "next/navigation";
import { connection } from "next/server";
import AppHeader from "../../components/AppHeader.jsx";
import { getAuthContext } from "../../lib/supabase/server.js";

export default async function WorkspaceLayout({ children }) {
  await connection();
  const auth = await getAuthContext();
  if (auth.status === "unconfigured") redirect("/setup");
  if (auth.status === "anonymous") redirect("/login");
  if (auth.status !== "authenticated") throw new Error("Account service is temporarily unavailable.");

  return (
    <div className="app-shell">
      <AppHeader email={auth.claims.email || ""} />
      <a className="skip-link" href="#main-content">Skip to main content</a>
      {children}
    </div>
  );
}
