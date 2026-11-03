import assert from "node:assert/strict";
import test from "node:test";
import { normalizeApprovedSupplierFeed } from "../lib/catalog/approved-feed.js";

const feed = {
  schema: "tileloop-approved-supplier-feed/v1",
  supplierKey: "example-supplier",
  brand: "Example Tiles",
  marketCode: "US",
  feedReference: "https://supplier.example/catalog-feed/2026-11-03",
  verifiedAt: "2026-11-03T10:00:00.000Z",
  approval: { reviewedBy: "Catalog operator", reviewedAt: "2026-11-03T11:00:00.000Z" },
  products: [{
    supplierCode: "EX-600",
    productName: "Example Porcelain",
    collectionName: "Field",
    formatLabel: "600x600mm",
    widthMm: 600,
    heightMm: 600,
    tilesPerCarton: 4,
    priceAmount: 24.5,
    priceCurrency: "USD",
    priceUnit: "carton",
    stockQuantity: 80,
    stockUnit: "cartons",
    stockUpdatedAt: "2026-11-03T09:30:00.000Z",
    orderable: true,
  }],
};

test("unapproved supplier feed facts remain staging-only and missing facts stay null", () => {
  const [row] = normalizeApprovedSupplierFeed({
    ...feed,
    products: [{ ...feed.products[0], tilesPerCarton: undefined, priceAmount: undefined, priceCurrency: undefined, stockQuantity: undefined, stockUpdatedAt: undefined }],
  });
  assert.equal(row.catalog_status, "staging");
  assert.equal(row.ordering_status, "planning-only");
  assert.equal(row.tiles_per_carton, null);
  assert.equal(row.price_amount, null);
  assert.equal(row.stock_quantity, null);
  assert.ok(row.quality_flags.includes("missing_verified_carton_quantity"));
});

test("publishing an approved complete feed requires reviewer and source provenance", () => {
  const [row] = normalizeApprovedSupplierFeed(feed, { publishApproved: true });
  assert.equal(row.catalog_status, "published");
  assert.equal(row.ordering_status, "orderable");
  assert.equal(row.tiles_per_carton, 4);
  assert.equal(row.price_amount, 24.5);
  assert.equal(row.price_currency, "USD");
  assert.equal(row.price_unit, "carton");
  assert.equal(row.stock_quantity, 80);
  assert.equal(row.stock_unit, "cartons");
  assert.equal(row.facts_source_reference, feed.feedReference);
  assert.equal(row.facts_verified_at, feed.approval.reviewedAt);
});

test("invalid publication, duplicate SKU, and invented currency data are rejected", () => {
  assert.throws(() => normalizeApprovedSupplierFeed({
    ...feed,
    products: [{ ...feed.products[0], tilesPerCarton: undefined }],
  }, { publishApproved: true }), /carton, price, and dated stock/);
  assert.throws(() => normalizeApprovedSupplierFeed({ ...feed, approval: null }, { publishApproved: true }), /named reviewer/);
  assert.throws(() => normalizeApprovedSupplierFeed({ ...feed, products: [feed.products[0], feed.products[0]] }), /Duplicate supplier code/);
  assert.throws(() => normalizeApprovedSupplierFeed({ ...feed, products: [{ ...feed.products[0], priceUnit: undefined }] }, { publishApproved: true }), /carton, price, and dated stock/);
  assert.throws(() => normalizeApprovedSupplierFeed({ ...feed, products: [{ ...feed.products[0], stockUnit: undefined }] }, { publishApproved: true }), /carton, price, and dated stock/);
});
