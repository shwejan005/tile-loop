import assert from "node:assert/strict";
import test from "node:test";
import { summarizeProjectMaterials } from "../lib/material-takeoff.js";

function surface(label, { productId = "sku-1", packSize = 8, orderQuantity = 7, stockTiles = 6, dimensions = [600, 600] } = {}) {
  return {
    label,
    catalog_item_id: productId,
    catalog_item: productId ? { id: productId, brand: "Tile Co", product_name: "Stone", tiles_per_carton: packSize } : null,
    tile_width_mm: dimensions[0],
    tile_length_mm: dimensions[1],
    latestSnapshot: {
      result_summary: { stockTiles, orderQuantity },
      inputs: { tilesPerCarton: packSize },
    },
  };
}

test("project takeoff consolidates same-material surface quantities before carton rounding", () => {
  const materials = summarizeProjectMaterials([
    surface("Bathroom floor", { orderQuantity: 7, stockTiles: 6 }),
    surface("Shower wall", { orderQuantity: 7, stockTiles: 5 }),
  ]);

  assert.equal(materials.length, 1);
  assert.equal(materials[0].quantity, 14);
  assert.equal(materials[0].stockTiles, 11);
  assert.equal(materials[0].cartons, 2);
  assert.equal(materials[0].tilesToOrder, 16);
  assert.deepEqual(materials[0].surfaces, ["Bathroom floor", "Shower wall"]);
});

test("project takeoff keeps different products separate and flags inconsistent pack sizes", () => {
  const materials = summarizeProjectMaterials([
    surface("Floor", { productId: "sku-a", packSize: 6, orderQuantity: 7 }),
    surface("Wall", { productId: "sku-b", packSize: 4, orderQuantity: 5 }),
    surface("Niche", { productId: "sku-a", packSize: null, orderQuantity: 2 }),
  ]);

  assert.equal(materials.length, 2);
  const materialA = materials.find((entry) => entry.key === "sku-a");
  assert.equal(materialA.packSize, null);
  assert.equal(materialA.cartons, null);
  assert.equal(materialA.tilesToOrder, 9);
  assert.equal(materials.find((entry) => entry.key === "sku-b").tilesToOrder, 8);
});

test("custom material groups use tile format and can round using a known carton size", () => {
  const materials = summarizeProjectMaterials([
    surface("Floor", { productId: null, packSize: 4, orderQuantity: 3, dimensions: [300, 600] }),
    surface("Accent", { productId: null, packSize: 4, orderQuantity: 2, dimensions: [300, 600] }),
  ]);

  assert.equal(materials.length, 1);
  assert.equal(materials[0].label, "Custom 300 × 600 mm tile");
  assert.equal(materials[0].cartons, 2);
  assert.equal(materials[0].tilesToOrder, 8);
});
