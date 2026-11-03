# TileLoop — product direction

TileLoop is a supplier-independent planning platform for tile installers and their customers. It connects measured room geometry to layout options, numbered cuts, material estimates, project history, and verified installation outcomes.

## Build principles

- Geometry, layout strategies, cutting, materials, visualization, and evaluation stay modular and versioned.
- A feature is supported only when its calculations and limitations are tested; estimates expose assumptions and are not presented as guarantees.
- Offcuts and carton rounding must not overstate material savings. Manual pack sizes are labeled as user-entered.
- Supplier data needs provenance and review. RAK is one adapter, not the product identity; missing price, stock, or carton facts are never invented.
- Pilot conclusions must be measured across comparable jobs before making claims about accuracy, practicality, or waste reduction.

## Current supported scope

The app supports polygon room zones with rectangular obstacles/openings and doorway markers; straight, half-offset, and diagonal layouts; numbered cut shapes; interactive 2D/3D inspection; SVG export; kerf-aware conservative nesting; offcut fit candidates; user-entered carton rounding; project history; and recorded actual tile use, breakage, labor, and practicality.

Herringbone, image-based plan import, supplier-backed purchasing quantities, and validated savings claims remain future work. Current cut packing is heuristic, and an installer must review feasibility before ordering or cutting.
