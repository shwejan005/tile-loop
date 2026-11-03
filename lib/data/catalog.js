import "server-only";

import { cache } from "react";
import { requireAuthContext } from "../supabase/server.js";

export const getPublishedCatalogItems = cache(async function getPublishedCatalogItems(marketCode = "AE") {
  const { supabase } = await requireAuthContext();
  const { data, error } = await supabase
    .from("catalog_items")
    .select("id, brand, supplier_code, product_name, collection_name, color, format_label, width_mm, height_mm, thickness_mm, body_type, surface_finish, structure, edge, tile_group, quality_flags, source_page_url, tiles_per_carton, price_amount, price_currency, price_unit, stock_quantity, stock_unit, stock_updated_at, ordering_status, facts_source_reference, facts_verified_at")
    .eq("market_code", marketCode)
    .eq("catalog_status", "published")
    .order("brand")
    .order("collection_name")
    .order("product_name")
    .limit(1000);
  if (error) throw new Error("Could not load the product catalog.");
  return data || [];
});
