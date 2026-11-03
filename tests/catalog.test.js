import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRakTile, parseFormatMillimeters } from "../lib/catalog/normalize.js";

test("catalog format labels normalize centimeters to millimeters", () => {
  assert.deepEqual(parseFormatMillimeters("6.5x26cm"), { widthMm: 65, heightMm: 260 });
  assert.deepEqual(parseFormatMillimeters("162 × 324 cm"), { widthMm: 1620, heightMm: 3240 });
  assert.deepEqual(parseFormatMillimeters("600x1200mm"), { widthMm: 600, heightMm: 1200 });
  assert.equal(parseFormatMillimeters("large format"), null);
});

test("catalog normalization flags upstream size and image mismatches instead of hiding them", () => {
  const product = normalizeRakTile({
    name: "Creative Concrete P Brick White",
    tile_code: "A42WCTVB-WHE.I6X0U",
    series_id: "8016",
    series_name: "Creative Concrete P Brick",
    secondary_color_name: "WHITE",
    tile_group: "Base",
    is_decor: false,
    size: { name: "6.5x26cm", width: 6, height: 26 },
    image: { full_size: "https://example.invalid/25-A42WCTVB-ANT-M6X0U.jpg" },
    specs: [
      { label: "Typology", value: "CERAMIC WHITE BODY" },
      { label: "Surface look", value: "MATT" },
      { label: "Edge", value: "STRAIGHT" },
      { label: "Thickness", value: "8.5 mm" },
      { label: "Unity measure", value: "M²" },
    ],
    url: "/uae/en/example-product/",
  }, { sourceUrl: "https://www.rakceramics.com/uae/en/api/products/tiles/tile/detail/" });

  assert.equal(product.dimensionsMm.widthMm, 65);
  assert.equal(product.thicknessMm, 8.5);
  assert.ok(product.qualityFlags.includes("reported_width_disagrees_with_format_label"));
  assert.ok(product.qualityFlags.includes("image_color_code_disagrees_with_product_code"));
  assert.ok(product.qualityFlags.includes("carton_pack_data_not_in_public_search_api"));
  assert.equal("imageUrl" in product, false);
});
