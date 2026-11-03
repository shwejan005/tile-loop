export function parseFormatMillimeters(label) {
  if (typeof label !== "string") return null;
  const match = label.trim().match(/^([\d.]+)\s*[x×]\s*([\d.]+)\s*(cm|mm)$/i);
  if (!match) return null;
  const scale = match[3].toLowerCase() === "cm" ? 10 : 1;
  const width = Number(match[1]) * scale;
  const height = Number(match[2]) * scale;
  if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) return null;
  return { widthMm: width, heightMm: height };
}

function specValue(specs, label) {
  const key = label.trim().toLowerCase();
  return specs.find((spec) => String(spec.label || "").trim().toLowerCase() === key)?.value ?? null;
}

function millimeters(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/[\d.]+/);
  return match ? Number(match[0]) : null;
}

function codeParts(value) {
  if (typeof value !== "string") return null;
  const [family, variant] = value.split("-");
  if (!family || !variant) return null;
  return { family: family.split(".")[0], color: variant.split(/[.]/)[0] };
}

function assetCodeMismatch(product) {
  const expected = codeParts(product.tile_code);
  const image = product.image?.full_size;
  if (!expected || !image) return false;
  try {
    const filename = decodeURIComponent(new URL(image).pathname.split("/").at(-1) || "");
    const escapedFamily = expected.family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const actual = filename.match(new RegExp(`${escapedFamily}-([A-Z0-9]{3})-`, "i"))?.[1];
    return Boolean(actual && actual.toUpperCase() !== expected.color.toUpperCase());
  } catch {
    return false;
  }
}

/** Normalize one supplier variant without copying media assets or inventing missing facts. */
export function normalizeRakTile(product, { market = "AE", sourceUrl, collectedAt = new Date().toISOString() } = {}) {
  const formatLabel = product.size?.name || specValue(product.specs || [], "Size");
  const dimensions = parseFormatMillimeters(formatLabel);
  const reportedWidth = Number(product.size?.width);
  const reportedHeight = Number(product.size?.height);
  const qualityFlags = [];

  if (!product.tile_code) qualityFlags.push("missing_product_code");
  if (!dimensions) qualityFlags.push("unparsed_format_label");
  if (dimensions && Number.isFinite(reportedWidth) && Math.abs(reportedWidth * 10 - dimensions.widthMm) > 0.01) {
    qualityFlags.push("reported_width_disagrees_with_format_label");
  }
  if (dimensions && Number.isFinite(reportedHeight) && Math.abs(reportedHeight * 10 - dimensions.heightMm) > 0.01) {
    qualityFlags.push("reported_height_disagrees_with_format_label");
  }
  if (assetCodeMismatch(product)) qualityFlags.push("image_color_code_disagrees_with_product_code");
  if (!specValue(product.specs || [], "Thickness")) qualityFlags.push("missing_thickness");
  qualityFlags.push("carton_pack_data_not_in_public_search_api");
  qualityFlags.push("price_and_stock_not_in_public_search_api");

  const sourcePage = product.url && sourceUrl ? new URL(product.url, sourceUrl).toString() : null;
  return {
    source: "rak-ceramics-public-catalog",
    market,
    supplierCode: product.tile_code || null,
    productName: product.name || null,
    collectionName: product.series_name || null,
    collectionSourceId: product.series_id || null,
    color: product.secondary_color_name || specValue(product.specs || [], "Color"),
    formatLabel: formatLabel || null,
    dimensionsMm: dimensions,
    tileGroup: product.tile_group || specValue(product.specs || [], "Product type"),
    body: specValue(product.specs || [], "Typology"),
    finish: specValue(product.specs || [], "Surface look"),
    structure: specValue(product.specs || [], "Structure"),
    edge: specValue(product.specs || [], "Edge"),
    thicknessMm: millimeters(specValue(product.specs || [], "Thickness")),
    salesUnit: specValue(product.specs || [], "Unity measure"),
    isDecor: product.is_decor === true,
    sourcePage,
    sourceApi: sourceUrl || null,
    collectedAt,
    qualityStatus: qualityFlags.length ? "needs_review" : "unverified",
    qualityFlags,
    carton: null,
    price: null,
    stock: null,
    // Media URLs are intentionally omitted: RAK's robots.txt disallows /media/.
  };
}
