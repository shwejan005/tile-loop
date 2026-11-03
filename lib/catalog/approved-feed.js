const FEED_SCHEMA = "tileloop-approved-supplier-feed/v1";

function validDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validText(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

/** Validate a supplier's reviewed facts; never infer carton, price, or availability. */
export function normalizeApprovedSupplierFeed(feed, { publishApproved = false } = {}) {
  if (!feed || typeof feed !== "object" || feed.schema !== FEED_SCHEMA) {
    throw new TypeError(`Feed must use the ${FEED_SCHEMA} schema.`);
  }
  if (!validText(feed.supplierKey, 80) || !validText(feed.brand, 120)
    || !/^[A-Z]{2}$/.test(feed.marketCode || "")
    || !validText(feed.feedReference, 500)
    || !validDate(feed.verifiedAt)
    || !Array.isArray(feed.products) || feed.products.length < 1 || feed.products.length > 10000) {
    throw new TypeError("Supplier feed metadata is incomplete or invalid.");
  }
  const approval = feed.approval;
  if (publishApproved && (!validText(approval?.reviewedBy, 120) || !validDate(approval?.reviewedAt))) {
    throw new TypeError("Publishing requires a named reviewer and review timestamp in the feed.");
  }
  if (publishApproved && Date.parse(approval.reviewedAt) < Date.parse(feed.verifiedAt)) {
    throw new TypeError("The review timestamp cannot predate the supplier fact verification timestamp.");
  }

  const seenCodes = new Set();
  return feed.products.map((product, index) => {
    if (!product || typeof product !== "object"
      || !validText(product.supplierCode, 100)
      || !validText(product.productName, 240)
      || !validText(product.formatLabel, 80)
      || !Number.isFinite(product.widthMm) || product.widthMm < 1 || product.widthMm > 10000
      || !Number.isFinite(product.heightMm) || product.heightMm < 1 || product.heightMm > 10000
      || (product.thicknessMm != null && (!Number.isFinite(product.thicknessMm) || product.thicknessMm < 0.1 || product.thicknessMm > 100))
      || (product.qualityFlags != null && (!Array.isArray(product.qualityFlags) || product.qualityFlags.some((flag) => typeof flag !== "string")))) {
      throw new TypeError(`Supplier product ${index + 1} needs a code, name, format, and valid dimensions.`);
    }
    const productKey = product.supplierCode.trim().toUpperCase();
    if (seenCodes.has(productKey)) throw new TypeError(`Duplicate supplier code "${product.supplierCode}" in feed.`);
    seenCodes.add(productKey);

    const hasPack = Number.isInteger(product.tilesPerCarton) && product.tilesPerCarton >= 1 && product.tilesPerCarton <= 1000;
    const hasPrice = Number.isFinite(product.priceAmount) && product.priceAmount >= 0 && product.priceAmount <= 9999999999.99
      && Math.abs(product.priceAmount * 100 - Math.round(product.priceAmount * 100)) < 1e-7
      && /^[A-Z]{3}$/.test(product.priceCurrency || "")
      && ["tile", "carton", "m2"].includes(product.priceUnit);
    const hasStock = Number.isInteger(product.stockQuantity) && product.stockQuantity >= 0
      && ["tiles", "cartons", "m2"].includes(product.stockUnit)
      && validDate(product.stockUpdatedAt);
    const completeFacts = hasPack && hasPrice && hasStock;
    if (publishApproved && product.orderable === true && !completeFacts) {
      throw new TypeError(`Product "${product.supplierCode}" cannot be made orderable without carton, price, and dated stock facts.`);
    }

    const flags = [...new Set(product.qualityFlags || [])];
    if (!hasPack) flags.push("missing_verified_carton_quantity");
    if (!hasPrice) flags.push("missing_verified_price");
    if (!hasStock) flags.push("missing_verified_stock");
    if (publishApproved && product.orderable === true) {
      return {
        supplier_key: feed.supplierKey,
        market_code: feed.marketCode,
        supplier_code: product.supplierCode.trim(),
        brand: feed.brand,
        collection_name: product.collectionName || null,
        product_name: product.productName.trim(),
        color: product.color || null,
        format_label: product.formatLabel.trim(),
        width_mm: product.widthMm,
        height_mm: product.heightMm,
        thickness_mm: product.thicknessMm ?? null,
        tile_group: product.tileGroup || null,
        body_type: product.bodyType || null,
        surface_finish: product.surfaceFinish || null,
        structure: product.structure || null,
        edge: product.edge || null,
        sales_unit: product.salesUnit || null,
        is_decor: product.isDecor === true,
        source_page_url: product.sourcePageUrl || null,
        source_api_url: feed.feedReference,
        source_captured_at: feed.verifiedAt,
        quality_flags: flags.filter((flag) => !flag.startsWith("missing_verified_")),
        catalog_status: "published",
        tiles_per_carton: product.tilesPerCarton,
        price_amount: product.priceAmount,
        price_currency: product.priceCurrency,
        price_unit: product.priceUnit,
        stock_quantity: product.stockQuantity,
        stock_unit: product.stockUnit,
        stock_updated_at: product.stockUpdatedAt,
        facts_source_reference: feed.feedReference,
        facts_verified_at: feed.approval.reviewedAt,
        ordering_status: "orderable",
      };
    }

    return {
      supplier_key: feed.supplierKey,
      market_code: feed.marketCode,
      supplier_code: product.supplierCode.trim(),
      brand: feed.brand,
      collection_name: product.collectionName || null,
      product_name: product.productName.trim(),
      color: product.color || null,
      format_label: product.formatLabel.trim(),
      width_mm: product.widthMm,
      height_mm: product.heightMm,
      thickness_mm: product.thicknessMm ?? null,
      tile_group: product.tileGroup || null,
      body_type: product.bodyType || null,
      surface_finish: product.surfaceFinish || null,
      structure: product.structure || null,
      edge: product.edge || null,
      sales_unit: product.salesUnit || null,
      is_decor: product.isDecor === true,
      source_page_url: product.sourcePageUrl || null,
      source_api_url: feed.feedReference,
      source_captured_at: feed.verifiedAt,
      quality_flags: flags,
      catalog_status: "staging",
      tiles_per_carton: hasPack ? product.tilesPerCarton : null,
        price_amount: hasPrice ? product.priceAmount : null,
        price_currency: hasPrice ? product.priceCurrency : null,
        price_unit: hasPrice ? product.priceUnit : null,
        stock_quantity: hasStock ? product.stockQuantity : null,
        stock_unit: hasStock ? product.stockUnit : null,
      stock_updated_at: hasStock ? product.stockUpdatedAt : null,
      facts_source_reference: feed.feedReference,
      facts_verified_at: publishApproved ? feed.approval.reviewedAt : null,
      ordering_status: "planning-only",
    };
  });
}
