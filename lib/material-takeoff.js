function one(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

/** Consolidate independently calculated surfaces into a project-level material list. */
export function summarizeProjectMaterials(plans) {
  const materials = new Map();
  for (const plan of plans) {
    const snapshot = plan.latestSnapshot;
    const result = snapshot?.result_summary;
    if (!result) continue;
    const comparison = one(snapshot.installer_comparisons);
    const inputs = snapshot.inputs || {};
    const catalog = plan.catalog_item || inputs.catalogItem || null;
    const tileWidth = Number(plan.tile_width_mm ?? inputs.tileWidthMm ?? inputs.tileWidth);
    const tileLength = Number(plan.tile_length_mm ?? inputs.tileLengthMm ?? inputs.tileLength);
    const catalogId = plan.catalog_item_id || catalog?.id || null;
    const key = catalogId || `custom:${tileWidth}x${tileLength}`;
    const packSize = Number(catalog?.tiles_per_carton ?? inputs.tilesPerCarton) || null;
    const quantity = Number(result.orderQuantity ?? result.stockTiles ?? 0);
    if (!Number.isFinite(quantity) || quantity < 0) continue;

    const material = materials.get(key) || {
      key,
      label: catalog
        ? [catalog.brand, catalog.collection_name, catalog.product_name, catalog.color].filter(Boolean).join(" · ")
        : `Custom ${tileWidth} × ${tileLength} mm tile`,
      tileWidth,
      tileLength,
      packSize,
      stockTiles: 0,
      quantity: 0,
      installerEstimate: 0,
      surfaces: [],
    };
    material.stockTiles += Number(result.stockTiles || 0);
    material.quantity += quantity;
    material.installerEstimate += Number(comparison?.installer_estimate_tiles || 0);
    material.surfaces.push(plan.label);
    if (material.packSize !== packSize) material.packSize = null;
    materials.set(key, material);
  }

  return [...materials.values()].map((material) => {
    const cartons = material.packSize ? Math.ceil(material.quantity / material.packSize) : null;
    return {
      ...material,
      cartons,
      tilesToOrder: cartons ? cartons * material.packSize : material.quantity,
    };
  }).sort((left, right) => left.label.localeCompare(right.label));
}
