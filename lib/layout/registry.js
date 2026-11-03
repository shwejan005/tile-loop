export const DEFAULT_LAYOUT_PATTERN = "straight";

const strategies = Object.freeze({
  straight: Object.freeze({
    id: "straight",
    label: "Straight lay",
    availability: "supported",
    version: "straight-grid-v1",
  }),
  "half-offset": Object.freeze({
    id: "half-offset",
    label: "Half-offset",
    availability: "supported",
    version: "half-offset-grid-v1",
  }),
  diagonal: Object.freeze({
    id: "diagonal",
    label: "Diagonal",
    availability: "supported",
    version: "diagonal-grid-v1",
  }),
  herringbone: Object.freeze({
    id: "herringbone",
    label: "Herringbone",
    availability: "supported",
    version: "herringbone-domino-v1",
  }),
});

export function getLayoutStrategy(patternId = DEFAULT_LAYOUT_PATTERN) {
  return Object.hasOwn(strategies, patternId) ? strategies[patternId] : null;
}
