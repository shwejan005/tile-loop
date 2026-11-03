# TileLoop — product direction

TileLoop is a supplier-independent planning platform for tile installers and their customers. It connects measured room geometry to layout options, numbered cuts, material estimates, project history, and verified installation outcomes.

## Build principles

- Geometry, layout strategies, cutting, materials, visualization, and evaluation stay modular and versioned.
- A feature is supported only when its calculations and limitations are tested; estimates expose assumptions and are not presented as guarantees.
- Offcuts and carton rounding must not overstate material savings. Manual pack sizes are labeled as user-entered.
- Supplier data needs provenance and review. RAK is one adapter, not the product identity; missing price, stock, or carton facts are never invented.
- Pilot conclusions must be measured across comparable jobs before making claims about accuracy, practicality, or waste reduction.

## Current supported scope

The app supports polygon room zones with rectangular obstacles/openings and doorway markers; straight, half-offset, diagonal, and 2:1 herringbone layouts; manual image tracing; numbered cut shapes; interactive 2D/3D inspection; SVG export; kerf-aware conservative nesting; offcut fit candidates; supplier-feed fields; and recorded actual tile use, breakage, labor, and practicality.

No approved carton/price/stock feed is currently included. Current cut packing is heuristic, image outlines are traced manually, and an installer must review feasibility before ordering or cutting.
