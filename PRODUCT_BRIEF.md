# TileLoop — product direction

TileLoop is a supplier-independent planning platform for tile installers and their customers. It connects measured room geometry to layout options, numbered cuts, material estimates, project history, and verified installation outcomes.

## Market position and business model

TileLoop is **B2B-first trade software** for professional tile installers, tile contractors, and flooring installation businesses. The buyer hypothesis is an installation-business owner or contractor; daily users are estimators and installers. In an owner-operated business, the buyer and daily user may be the same person. Customers/homeowners are a secondary audience who can review a contractor-shared project through a read-only link. TileLoop is not currently a separate consumer room-planning product.

This is a product-positioning hypothesis, not validated market research. Pricing, packaging, willingness to pay, and company-seat requirements have not been tested. The current product has individual account ownership and project sharing, but no billing, organization administration, or multi-user editing.

## Build principles

- Geometry, layout strategies, cutting, materials, visualization, and evaluation stay modular and versioned.
- A feature is supported only when its calculations and limitations are tested; estimates expose assumptions and are not presented as guarantees.
- Offcuts and carton rounding must not overstate material savings. Manual pack sizes are labeled as user-entered.
- Supplier data needs provenance and review. RAK is one adapter, not the product identity; missing price, stock, or carton facts are never invented.
- Pilot conclusions must be measured across comparable jobs before making claims about accuracy, practicality, or waste reduction.

## Current supported scope

The app supports polygon room zones with rectangular obstacles/openings and doorway markers; six layouts (straight, half-offset, one-third offset, two-thirds offset, diagonal, and 2:1 herringbone); centered or top-left origin; opt-in rotation for eligible rectangular cuts; manual image tracing; numbered cut shapes; interactive 2D/3D inspection; SVG, CSV, and print-to-PDF exports; heuristic kerf-aware stock nesting; project-level multi-surface material takeoff; private read-only project links; account backup and restore; and version-linked installation outcomes with consumed and installed tile counts, breakage, itemized reusable/discarded offcuts, installer label, labor, and practicality.

The private pilot evaluation groups measured jobs by pattern, geometry, room-size band, tile format, product, and installer label. These descriptive cohorts show sample size and do not make predictive claims. The monthly vendor comparison is tracked in [COMPETITOR_MONITORING.md](./COMPETITOR_MONITORING.md), and the evaluator walkthrough is in [DEMO_SCRIPT.md](./DEMO_SCRIPT.md).

No approved carton/price/stock feed or real pilot outcomes are currently included. Current cut packing is heuristic, image outlines are traced manually, and an installer must review feasibility before ordering or cutting. Proposed acceptance thresholds remain targets until verified against surveyed rooms and completed installations.
