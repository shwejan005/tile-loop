import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeRakTile, parseFormatMillimeters } from "../lib/catalog/normalize.js";

const ORIGIN = "https://www.rakceramics.com";
const SEARCH_PATH = "/uae/en/api/products/tiles/tiles/search/";
const DETAIL_PATH = "/uae/en/api/products/tiles/tile/detail/";
const DEFAULT_OUTPUT = "data/catalog/rak-uae-staging.json";
const USER_AGENT = "TileLoopCatalogSync/0.1 (public product metadata; media assets are not fetched)";
const CATALOG_SCHEMA = "tileloop-catalog-staging/v1";

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function validateSourceUrl(input) {
  const url = new URL(input, ORIGIN);
  if (url.origin !== ORIGIN || !url.pathname.startsWith("/uae/en/api/products/tiles/")) {
    throw new Error(`Refusing to request an unexpected source URL: ${url.origin}${url.pathname}`);
  }
  return url;
}

async function fetchJson(input, retries = 3) {
  const url = validateSourceUrl(input);
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(20000),
    });
    if (response.ok) {
      const type = response.headers.get("content-type") || "";
      if (!type.includes("application/json")) throw new Error(`Expected JSON from ${url.pathname}.`);
      return response.json();
    }
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === retries - 1) {
      const error = new Error(`Catalog endpoint returned HTTP ${response.status} for ${url.pathname}.`);
      error.status = response.status;
      throw error;
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : (attempt + 1) * 1500);
  }
  throw new Error("Catalog request failed after retries.");
}

async function robotsAllows(path) {
  const response = await fetch(new URL("/robots.txt", ORIGIN), {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Could not verify robots.txt (HTTP ${response.status}); refusing to crawl.`);

  const groups = [];
  let agents = [];
  let rules = [];
  const flush = () => {
    if (agents.length) groups.push({ agents, rules });
    agents = [];
    rules = [];
  };
  for (const rawLine of (await response.text()).split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0].trim();
    if (!line) continue;
    const [rawName, ...rest] = line.split(":");
    const name = rawName.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (name === "user-agent") {
      if (rules.length) flush();
      agents.push(value.toLowerCase());
    } else if ((name === "disallow" || name === "allow") && agents.length) {
      rules.push({ kind: name, path: value });
    }
  }
  flush();

  const matchingGroups = groups.filter((group) => group.agents.includes("*"));
  const matchingRules = matchingGroups.flatMap((group) => group.rules)
    .filter((rule) => rule.path && path.startsWith(rule.path))
    .sort((a, b) => b.path.length - a.path.length);
  if (matchingRules[0]?.kind === "disallow") throw new Error(`robots.txt disallows crawling ${path}.`);
}

async function fetchListings(delayMs) {
  await robotsAllows(new URL(SEARCH_PATH, ORIGIN).pathname);
  let nextUrl = new URL(SEARCH_PATH, ORIGIN).toString();
  const pages = [];
  let facets = [];
  let totalItems = null;
  while (nextUrl) {
    const page = await fetchJson(nextUrl);
    if (!Array.isArray(page.results) || !page.pagination) throw new Error("Unexpected RAK search response shape.");
    if (!pages.length) {
      facets = page.filters || [];
      totalItems = page.pagination.total_items ?? null;
    }
    pages.push(page);
    console.log(`Read catalog page ${page.pagination.current_page ?? pages.length}/${page.pagination.total_pages ?? "?"}: ${page.results.length} groups`);
    nextUrl = page.pagination.next_page_url || null;
    if (nextUrl) {
      validateSourceUrl(nextUrl);
      await sleep(delayMs);
    }
    if (pages.length > 100) throw new Error("Unexpected pagination loop; stopped after 100 pages.");
  }
  return { pages, facets, totalItems };
}

function getFilterOptions(facets, name) {
  return facets.find((facet) => facet.filter_name === name)?.options || [];
}

function normalizeListings(pages, facets) {
  const collectionIds = new Map(getFilterOptions(facets, "collections_for_search")
    .map((option) => [String(option.label).trim().toLowerCase(), option.value]));
  const variants = [];

  for (const page of pages) {
    for (const group of page.results) {
      const collectionId = collectionIds.get(String(group.series_name).trim().toLowerCase()) || null;
      for (const size of group.sizes || []) {
        const parsedUrl = new URL(size.url, ORIGIN);
        const formatId = parsedUrl.searchParams.get("sizes_for_search");
        const dimensions = parseFormatMillimeters(size.name);
        variants.push({
          collectionName: group.series_name,
          collectionSourceId: collectionId,
          color: group.color_name,
          colorSourceId: group.secondary_color_id || null,
          formatLabel: size.name,
          formatSourceId: formatId ? Number(formatId) : null,
          dimensionsMm: dimensions,
          tileGroupHint: group.order_is_decor ? "Decor" : "Base",
          isDecor: group.order_is_decor === true,
          sourcePage: group.url ? new URL(group.url, ORIGIN).toString() : null,
        });
      }
    }
  }
  return variants;
}

function detailUrlFor(variant) {
  if (!variant.collectionSourceId || !variant.colorSourceId || !variant.formatSourceId) return null;
  const url = new URL(DETAIL_PATH, ORIGIN);
  url.searchParams.set("collections_for_search", String(variant.collectionSourceId));
  url.searchParams.set("secondary_colors_for_search", String(variant.colorSourceId));
  url.searchParams.set("sizes_for_search", String(variant.formatSourceId));
  if (variant.isDecor) url.searchParams.set("tile_groups_for_search", "2");
  return url.toString();
}

function variantKey(variant) {
  return [variant.collectionSourceId, variant.colorSourceId, variant.formatSourceId, variant.isDecor ? "decor" : "base"].join("|");
}

function variantKeyFromSourceUrl(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    return [
      url.searchParams.get("collections_for_search"),
      url.searchParams.get("secondary_colors_for_search"),
      url.searchParams.get("sizes_for_search"),
      url.searchParams.get("tile_groups_for_search") === "2" ? "decor" : "base",
    ].join("|");
  } catch {
    return null;
  }
}

async function writeCatalog(outputPath, catalog) {
  await mkdir(dirname(outputPath), { recursive: true });
  const tempPath = `${outputPath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(catalog, null, 2)}\n`);
  await rename(tempPath, outputPath);
}

export async function syncRakCatalog({ detailLimit = 0, delayMs = 1500, output = DEFAULT_OUTPUT, resume = false } = {}) {
  const { pages, facets, totalItems } = await fetchListings(delayMs);
  const variants = normalizeListings(pages, facets);
  const outputPath = resolve(process.cwd(), output);
  let previous = null;
  if (resume) {
    try {
      previous = JSON.parse(await readFile(outputPath, "utf8"));
      if (previous.schema !== CATALOG_SCHEMA) throw new Error("The resume file is not a TileLoop catalog snapshot.");
    } catch (error) {
      if (error.code === "ENOENT") throw new Error("Cannot resume: the staging output file does not exist.");
      throw error;
    }
  }

  const currentVariantKeys = new Set(variants.map(variantKey));
  const products = new Map((previous?.products || [])
    .filter((product) => currentVariantKeys.has(variantKeyFromSourceUrl(product.sourceApi)))
    .map((product) => [`${product.market}:${product.supplierCode}`, product]));
  const detailErrors = new Map();
  for (const item of previous?.detailErrors || []) {
    const key = variantKey(item.variant);
    if (key && currentVariantKeys.has(key)) detailErrors.set(key, item);
  }
  const processed = new Set(previous?.processedVariantKeys || []);
  if (resume && !previous?.processedVariantKeys) {
    for (const product of products.values()) {
      const key = variantKeyFromSourceUrl(product.sourceApi);
      if (key) processed.add(key);
    }
    for (const [key, item] of detailErrors) {
      if (!item.error.includes("HTTP 403") && !item.error.includes("HTTP 429")) processed.add(key);
    }
  }
  for (const key of [...processed]) if (!currentVariantKeys.has(key)) processed.delete(key);

  const now = new Date().toISOString();
  const pendingVariants = variants.filter((variant) => !processed.has(variantKey(variant)));
  const requestedCount = detailLimit === Infinity ? pendingVariants.length : Math.min(detailLimit, pendingVariants.length);
  let detailQueriesAttempted = 0;
  let accessLimited = false;
  if (requestedCount > 0) await robotsAllows(new URL(DETAIL_PATH, ORIGIN).pathname);

  for (let index = 0; index < requestedCount; index += 1) {
    const variant = pendingVariants[index];
    const key = variantKey(variant);
    const sourceApi = detailUrlFor(variant);
    if (!sourceApi) {
      detailErrors.set(key, { variant, error: "Missing collection/color/format source ID." });
      processed.add(key);
      continue;
    }
    try {
      detailQueriesAttempted += 1;
      const details = await fetchJson(sourceApi);
      const matching = (details.results || []).filter((product) =>
        (!product.series_id || String(product.series_id) === String(variant.collectionSourceId))
        && (!product.secondary_color_id || String(product.secondary_color_id) === String(variant.colorSourceId))
        && (!product.size?.id || String(product.size.id) === String(variant.formatSourceId))
        && (variant.isDecor ? product.is_decor === true : product.is_decor !== true));
      for (const product of matching) {
        const normalized = normalizeRakTile(product, { sourceUrl: sourceApi, collectedAt: now });
        const productKey = `${normalized.market}:${normalized.supplierCode || key}`;
        products.set(productKey, normalized);
      }
      processed.add(key);
      if (!matching.length) detailErrors.set(key, { variant, error: "No matching product detail returned." });
      else detailErrors.delete(key);
    } catch (error) {
      detailErrors.set(key, { variant, error: error.message || "Detail request failed." });
      if (error.status === 403 || error.status === 429 || error.status >= 500) {
        accessLimited = true;
        console.warn(`The detail endpoint returned HTTP ${error.status}. Stopping and preserving resumable staging data.`);
        await writeCatalog(outputPath, buildCatalog("paused-access-limited"));
        break;
      }
      if (error.status && error.status < 500) processed.add(key);
    }

    if (index + 1 < requestedCount) await sleep(delayMs);
    if ((index + 1) % 10 === 0 || index + 1 === requestedCount) {
      await writeCatalog(outputPath, buildCatalog("partial"));
      console.log(`Read ${index + 1}/${requestedCount} product detail queries; ${products.size} unique SKUs, ${detailErrors.size} flagged queries`);
    }
  }

  const detailStatus = accessLimited
    ? "paused-access-limited"
    : processed.size >= variants.length
      ? (detailErrors.size ? "complete-with-errors" : "complete")
      : "partial";
  const catalog = buildCatalog(detailStatus);
  await writeCatalog(outputPath, catalog);
  console.log(`Wrote staging catalog to ${outputPath}`);
  console.log(JSON.stringify(catalog.source));
  return catalog;

  function buildCatalog(detailStatus) {
    return {
      schema: CATALOG_SCHEMA,
      source: {
        brand: "RAK Ceramics",
        market: "AE",
        searchEndpoint: new URL(SEARCH_PATH, ORIGIN).toString(),
        retrievedAt: now,
        totalSearchGroups: totalItems,
        searchPages: pages.length,
        formatAssociations: variants.length,
        detailQueriesRequested: variants.length,
        detailQueriesAttempted: (previous?.source?.detailQueriesAttempted || 0) + detailQueriesAttempted,
        detailQueriesCompleted: processed.size,
        uniqueProductsWithDetails: products.size,
        detailQueriesFlagged: detailErrors.size,
        detailStatus,
        mediaFetched: false,
        authoritativeForOrdering: false,
      },
      facets: facets.map((facet) => ({
        name: facet.filter_name,
        label: facet.label,
        options: (facet.options || []).map(({ label, value }) => ({ label, value })),
      })),
      listedVariants: variants,
      products: [...products.values()],
      detailErrors: [...detailErrors.values()],
      processedVariantKeys: [...processed],
    };
  }
}

function cliOptions(args) {
  const readOption = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const allDetails = args.includes("--all-details");
  const detailLimit = allDetails ? Infinity : Number(readOption("details") || 0);
  const delayMs = Number(readOption("delay-ms") || 1500);
  const output = readOption("output") || DEFAULT_OUTPUT;
  const resume = args.includes("--resume");
  if (!(detailLimit === Infinity || (Number.isInteger(detailLimit) && detailLimit >= 0))) {
    throw new Error("--details must be a non-negative integer; use --all-details for the full detail crawl.");
  }
  if (!Number.isInteger(delayMs) || delayMs < 500 || delayMs > 10000) throw new Error("--delay-ms must be between 500 and 10000.");
  return { detailLimit, delayMs, output, resume };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = cliOptions(process.argv.slice(2));
    await syncRakCatalog(args);
  } catch (error) {
    console.error(error.message || "Catalog sync failed.");
    process.exitCode = 1;
  }
}
