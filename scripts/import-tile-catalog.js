import nextEnv from "@next/env";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());

async function main() {
  const inputPath = process.argv[2] || ".cache/rak-uae-staging.json";
  if (process.argv.includes("--publish-reviewed")) {
    throw new Error("Bulk publishing is disabled. Review and publish catalog records through an explicit, audited operator workflow.");
  }
  const catalog = JSON.parse(await readFile(inputPath, "utf8"));
  if (catalog.schema !== "tileloop-catalog-staging/v1" || !Array.isArray(catalog.products)) {
    throw new Error("Input must be a TileLoop catalog staging snapshot.");
  }

  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: secretKey } = process.env;
  if (!url || !secretKey) throw new Error("Set the Supabase URL and server-only secret key before importing.");
  if (!catalog.products.length) throw new Error("The staging file has no detailed products. Run the scraper with --details first.");

  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const rows = catalog.products.map((product) => ({
    supplier_key: "rak-ceramics-public-catalog",
    market_code: product.market,
    supplier_code: product.supplierCode,
    brand: "RAK Ceramics",
    collection_name: product.collectionName,
    product_name: product.productName,
    color: product.color,
    format_label: product.formatLabel,
    width_mm: product.dimensionsMm?.widthMm,
    height_mm: product.dimensionsMm?.heightMm,
    thickness_mm: product.thicknessMm,
    tile_group: product.tileGroup,
    body_type: product.body,
    surface_finish: product.finish,
    structure: product.structure,
    edge: product.edge,
    sales_unit: product.salesUnit,
    is_decor: product.isDecor,
    source_page_url: product.sourcePage,
    source_api_url: product.sourceApi,
    source_captured_at: product.collectedAt,
    quality_flags: product.qualityFlags,
    catalog_status: "staging",
  }));

  const batchSize = 100;
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const { error } = await supabase
      .from("catalog_items")
      .upsert(batch, { onConflict: "supplier_key,market_code,supplier_code" });
    if (error) throw new Error(`Catalog import failed for batch ${start / batchSize + 1}: ${error.code || "unknown"}`);
    console.log(`Imported ${Math.min(start + batch.length, rows.length)}/${rows.length} catalog items`);
  }

  const flagged = rows.filter((row) => row.quality_flags.length > 0).length;
  console.log(JSON.stringify({ imported: rows.length, flaggedForReview: flagged, published: false }, null, 2));
  console.log("Items remain staging-only. Review them through an explicit, audited operator workflow before publication.");
}

main().catch((error) => {
  console.error(error.message || "Catalog import failed.");
  process.exitCode = 1;
});
