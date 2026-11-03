import nextEnv from "@next/env";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { normalizeApprovedSupplierFeed } from "../lib/catalog/approved-feed.js";

nextEnv.loadEnvConfig(process.cwd());

async function main() {
  const args = process.argv.slice(2);
  const inputPath = args.find((arg) => !arg.startsWith("--"));
  if (!inputPath) throw new Error("Usage: npm run catalog:import-approved -- feed.json [--publish-approved] [--dry-run]");
  const publishApproved = args.includes("--publish-approved");
  const dryRun = args.includes("--dry-run");
  const feed = JSON.parse(await readFile(inputPath, "utf8"));
  const rows = normalizeApprovedSupplierFeed(feed, { publishApproved });
  const summary = {
    products: rows.length,
    staged: rows.filter((row) => row.catalog_status === "staging").length,
    published: rows.filter((row) => row.catalog_status === "published").length,
    orderable: rows.filter((row) => row.ordering_status === "orderable").length,
    dryRun,
  };
  if (dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: secretKey } = process.env;
  if (!url || !secretKey) throw new Error("Set the Supabase URL and server-only secret key before importing.");
  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  for (let start = 0; start < rows.length; start += 100) {
    const { error } = await supabase
      .from("catalog_items")
      .upsert(rows.slice(start, start + 100), { onConflict: "supplier_key,market_code,supplier_code" });
    if (error) throw new Error(`Supplier feed import failed at row ${start + 1}: ${error.code || "unknown"}`);
  }
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error.message || "Supplier feed import failed.");
  process.exitCode = 1;
});
