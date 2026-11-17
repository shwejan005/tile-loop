# TileLoop monthly competitor and benchmark review

**Baseline reviewed:** 2026-11-16

**Competitors in scope:** MeasureSquare, Layometry, TilePlan Pro (`tileplan.cc`)
**Benchmark source:** user-proposed 15 acceptance targets. They are product targets, not claimed industry standards.

## Monitoring status

This file defines the monthly review and records its first baseline. A recurring event could not be activated because no calendar is connected to the available Calendar integration. To enable it, connect a calendar in **Notion Settings → Mail & Calendar**; then create a first-Monday monthly review at 09:00 Asia/Kolkata. Re-run the source review and refresh every row below; do not assume a feature still exists just because it appeared in an earlier review.

## How to run each monthly review

1. Open the official product, help, release notes, pricing, and export pages listed under [Source register](#source-register). Record the review date and the page's publication/release date where available.
2. Check all 15 criteria in the scorecard. Record a direct source link and a short evidence note for each changed or newly verified competitor claim. Use **Not publicly documented** when the sources do not establish a capability; do not turn that into a claim that the competitor lacks it.
3. For TileLoop, inspect the current implementation and evidence from the fixed acceptance dataset. A feature existing in code is not a pass. Mark **Pass** only when the stated threshold is demonstrated; otherwise use **Partial**, **Fail**, or **Not verified**.
4. Preserve old monthly snapshots. In the new issue, summarize only meaningful changes: new/removed capabilities, pattern coverage, pricing/plan changes, export changes, collaboration, supplier data, and material accuracy evidence.
5. Separate vendor claims, hands-on observations, and TileLoop's own measured results. Competitor marketing claims are not independent validation.

### Status labels

- **Pass:** the target was verified against its stated acceptance condition.
- **Partial:** some capability exists, but one or more required pieces or proof are missing.
- **Fail:** a measured result misses the stated target.
- **Not verified:** no adequate test, source, or pilot evidence was available.
- **Not publicly documented:** official competitor sources reviewed did not establish the capability.

## First-run findings

The TileLoop column below includes source review and local acceptance tests. The fixed analytic fixture tests are not a substitute for measured plans or independent installer review. Relevant implementation is in [`lib/geometry/room.js`](lib/geometry/room.js), [`lib/geometry/operations.js`](lib/geometry/operations.js), [`lib/planner.js`](lib/planner.js), [`lib/layout/`](lib/layout/), [`lib/cutting/nesting.js`](lib/cutting/nesting.js), [`components/RoomPlanEditor.jsx`](components/RoomPlanEditor.jsx), [`components/RoomPlan2D.jsx`](components/RoomPlan2D.jsx), [`components/RoomScene.jsx`](components/RoomScene.jsx), [`components/InstallationOutcomeForm.jsx`](components/InstallationOutcomeForm.jsx), and [`lib/data/evaluation.js`](lib/data/evaluation.js).

| # | Benchmark and proposed acceptance target | TileLoop baseline | MeasureSquare public baseline | Layometry public baseline | TilePlan Pro public baseline |
|---|---|---|---|---|---|
| **1 · P0** | **Room geometry:** 10/10 known plans; area error ≤0.5%; mm inputs; exclusions update usable area. | **Pass for fixed analytic fixtures; field validation pending.** Added 10 rectangular, L-shaped, irregular, pillar, opening and multi-obstacle cases with exact reference areas and bounds; all fall within 0.5%. A separate check verifies obstacle changes update usable area. These hand-authored references are not surveyed installer plans. | Official pages describe room/area drawing, imported plans, openings and curved shapes in its takeoff products. No independently measured 0.5% result found. | Help describes polygon floors, uneven surfaces, connected walls/floors, openings, niches and columns. No independent 10-room accuracy result found. | FAQ documents scaled layouts and multi-wall mode with doors, windows, niches and obstacles. No independent 0.5% benchmark found. |
| **2 · P0** | **Tile layout:** zero overlaps/out-of-bounds errors; consistent grout and pattern; correct edge cuts on every supported layout. | **Partial.** Added containment and pairwise non-overlap checks for all six patterns across rectangular, L-shaped, irregular and obstacle rooms. Centered and top-left origin are configurable. Grout pitch and exact alignment still lack independent manual references for every pattern; herringbone warns about widened T-junctions. | Product pages describe a tile-pattern library, custom patterns, pattern position/layout direction and 3D review. Exact zero-error results are not publicly established. | Help describes straight/running-bond, rotation, orientation, centering and offset controls with live views. No independent zero-error suite found. | FAQ advertises 14 patterns; the how-to guide describes independent wall surfaces and obstacles. No independent zero-error suite found. |
| **3 · P0** | **Cut calculation:** every partial tile has a location and dimensions; no missing/duplicate cuts; 100% reference agreement. | **Partial.** Added one manually derived 3500 × 2800 mm reference case: all 30 piece coordinates/sizes are compared with the reference grid, including all 18 cuts; IDs and stock assignments are unique/consistent. More reference cases are needed before claiming general 100% agreement. | MeasureSquare documents Cut and Fit views and tile-cut visualization. No public 100% ground-truth comparison found. | Help describes labelled cuts, per-material cut lists, and PDF/CSV output. No independent 100% ground-truth comparison found. | FAQ says it calculates perimeter cuts geometrically and deduplicates exact dimensions. This is a vendor claim, not independent verification. |
| **4 · P0** | **Material estimate:** separate theoretical, practical, and carton-rounded order quantities; visible assumptions; carton rounding always correct. | **Partial.** UI now distinguishes an area-only lower bound, practical stock plan, buffer-adjusted order, and carton-rounded quantity. Added arithmetic checks for reserve and carton rounding. Carton facts remain manual/unverified and stock nesting remains heuristic. | Official material describes automatic product-usage estimates and product catalogs; editions also describe waste/layout optimization. Exact carton rounding behavior and independent accuracy were not established in this review. | Help describes full/cut/total counts and says breakage is not included; the installer adds a margin. No verified live carton feed was established. | FAQ/how-to describe material estimates, tiles per box, price per box and pattern waste settings. No independent rounding audit found. |
| **5 · P0** | **2D/3D consistency:** plan, cut list and material quantity stay synchronized after every supported edit. | **Partial.** The public demo E2E now verifies a selected piece stays selected when switching 2D → 3D → 2D. The shared plan object drives both renderers and the estimate. It does not yet compare every rendered tile position to the cut list after every edit. | Official pages describe instant 3D review and worksheet/report outputs. No independent synchronization test found. | Official help describes cut geometry and live 3D in one planner. No independent synchronization test found. | Official FAQ describes scaled layouts; how-to describes a 2.5D room preview. No independent synchronization test found. |
| **6 · P1** | **Patterns:** minimum 4 common patterns; competitive target 6–8; configurable offsets/orientations; all patterns valid in rectangular and irregular rooms. | **Partial.** Six patterns are implemented: straight, 50% half-offset, one-third offset, two-thirds offset, diagonal and 2:1 herringbone. Automated geometry checks cover rectangular, L-shaped, irregular and obstacle rooms. Centered/top-left origins are configurable. Cut rotation on stock is an explicit opt-in for rectangular cuts; manual cut references do not cover every pattern. | Official pages advertise a sophisticated pattern library, custom shapes, tile replacement and randomized layouts; the exact supported count depends on product/edition. | Help documents straight and running-bond patterns, arbitrary grid rotation and offsets; it does not establish 6–8 patterns. | Official pattern gallery/FAQ lists 14: straight, running bond, 1/3 offset, diagonal, herringbone variants, checkerboard, basket-weave variants, wood-strip, chevron, mosaic pinwheel, Chantilly and Versailles. |
| **7 · P1** | **Offcut reuse:** valid packing, source tracking, kerf/orientation constraints, no overlaps or double use; reusable/waste clearly distinguished. | **Partial.** Deterministic guillotine packing compares three sort orders, tracks source stock, respects kerf and can opt into rotating eligible rectangular cuts. Tests verify a compatible reuse, bounds, and non-overlap. It remains heuristic, polygon cuts stay unrotated, and offcuts carried from earlier jobs are not allocated. Recorded reusable/discarded field material is now captured after installation. | MeasureSquare's official FAQ says Cut and Fit can reuse cut waste within the same room or wall. Verify exact behavior in a hands-on benchmark; marketing/FAQ text alone does not prove all constraints. | The reviewed help describes a waste preview and cut list, but did not establish multi-cut offcut allocation. Mark as not publicly documented until verified. | Reviewed official FAQ/how-to describe cut counts and cut lists; reusable-stock allocation was not established. |
| **8 · P1** | **Cut-list/export:** printable PDF, CSV, project import/export, drawing, dimensions, IDs, quantities, locations and reuse status. | **Partial.** CSV includes each positioned piece, its stock source, size, room location and stock rotation; a self-contained numbered print view can be saved as PDF. Account JSON now exports and restores project copies with history and outcomes. Prior-job offcuts are explicitly not allocated; the CSV marks this. Cross-device restore depends on the configured account database. | Official pages list worksheets, reports, quotes, PDF/Excel/CAD exports across product editions. Confirm exact edition and cut-list fields during hands-on checks. | Official help describes PDF working drawings and CSV cut lists; signed-in projects also have JSON export/import. | Official Pro help describes branded PDF with scaled diagram and deduplicated cut list; FAQ describes shareable layouts. CSV capability was not confirmed in the official Pro pages reviewed. |
| **9 · P1** | **Multiple materials/surfaces:** separate specs, patterns and quantities per material, plus consolidated project totals. | **Partial.** Projects support multiple surface plans with separate dimensions, pattern, grout and product/custom material. The consolidated takeoff groups identical materials and rounds cartons after summing. A single polygon room still uses one tile product; mixed material zones inside one surface are not modeled. | Stone & Tile product pages describe rooms/elevations, product assignment, grouping and multi-product slab workflows. Confirm flooring SKU details by edition. | Help documents per-surface materials and different-tile zones with separate totals/cut lists. | Help describes multi-wall surfaces and per-surface patterns; different materials and consolidated multi-material totals need direct confirmation. |
| **10 · P1** | **Save/share:** projects, revisions, export/restore, read-only sharing and cross-device access. | **Partial.** Authenticated projects and immutable calculation history are saved; account backups restore as new project copies. Owners can rotate/revoke read-only share links. Cross-device access depends on a reachable Supabase deployment; database migration and authenticated E2E are pending local Docker availability. | Official product/pricing pages describe cloud sync and project/report workflows for relevant editions. Check exact sharing and restore behavior by edition. | Help/FAQ describe guest browser storage, signed-in cross-device workspace, JSON backup/import, CSV and PDF. | Official Pro guide describes cloud dashboard saves and revocable public read-only client links; branded PDF export is documented. |
| **11 · P2** | **Estimate vs actual:** preserve planned estimate and installer estimate; record actual, breakage, reusable and discarded tiles. | **Implemented; field evidence pending.** Immutable snapshots keep the original plan and installer count. Outcome records distinguish total stock consumed (including breakage), optional installed count, broken tiles, itemized reusable/discarded offcuts, installer label, labor and practicality. A migration labels legacy rows `legacy-unknown`; only explicitly confirmed comparable outcomes enter accuracy metrics. Migration has not been applied locally because Docker is unavailable. | Post-install estimate-to-actual capture was not publicly documented in the official pages reviewed. | Post-install estimate-to-actual capture was not publicly documented in the official pages reviewed. | Post-install estimate-to-actual capture was not publicly documented in the official pages reviewed. |
| **12 · P2** | **Accuracy analytics:** proposed median APE ≤5%; ≥70% within 5%; ≥90% within 10%; no persistent bias, on comparable completed jobs. | **Metrics implemented; target unverified.** APE uses actual consumed tiles as the denominator. The page reports median APE, threshold rates, mean bias, and sample sizes. Real job evidence is not in the repository, so proposed targets cannot be claimed. | No public comparable-job accuracy dataset or post-install error distribution found. | No public comparable-job accuracy dataset or post-install error distribution found. | FAQ makes anecdotal claims about ordering close to actual use but does not publish a comparable multi-job error dataset in the reviewed source. |
| **13 · P2** | **Historical intelligence:** evidence-linked analysis by shape, tile, pattern, size, installer and project size. | **Implemented as private descriptive cohorts; evidence pending.** The evaluation page groups eligible jobs by pattern, room geometry, area band, tile format, product and installer/crew label. Each group displays sample count, median APE, within-5% share and mean bias; legacy outcomes are excluded from accuracy metrics. No predictive claims are made. | Project histories and business estimating are described, but filtered historical installation-waste analytics were not publicly documented. | Saved project workspace is documented; aggregated historical installation-performance analytics were not publicly documented. | Project dashboards and saved projects are documented; aggregated installation-performance analytics were not publicly documented. |
| **14 · P2** | **Supplier catalog:** verified dimensions, carton, price, supplier and stock; freshness/provenance; update path. | **Partial / gap.** Generic supplier catalog fields, staging/published states, source references and verification constraints exist. README says no approved carton/price/stock feed is included; RAK UAE data is staging-only. Catalog support should not be described as live ordering. | Official pages describe built-in product catalogs and supplier/labor costs in relevant products. Confirm feed coverage, update cadence, and carton/stock provenance in a product demo. | Product/material data is configurable per surface; a live supplier stock/price feed was not established by reviewed public sources. | Product dimensions and box price/quantity can be entered in the calculator; a verified supplier availability feed was not established. |
| **15 · P2** | **Usability:** basic plan ≤3 min, layout ≤1 min, export ≤30 sec; ≥80% unaided completion; zero normal-edit data loss. | **Not verified.** No timed installer study, completion rate, or data-loss study was found in the repository. Run with at least 10 target installers and record task times, completion, errors and lost work. | Official marketing presents takeoff/report workflows, but no comparable independent task-time study was found. | Official help describes a no-signup, adaptive web workflow; no comparable task-time study found. | Official how-to documents onboarding and a free calculator; no comparable task-time study found. |

### Priority readout

- **P0 reliability:** The 10 analytic geometry fixtures, containment/non-overlap checks, manually derived cut case, carton arithmetic, and 2D/3D selection E2E are in place. Independent surveyed-room and installer cut references are still required before claiming the proposed accuracy thresholds.
- **P1 parity:** TileLoop now has six patterns, centered/top-left origin, optional rectangular cut rotation, project-level multi-material takeoff, account backup/restore, read-only project sharing, CSV/print export, and within-job heuristic nesting. Remaining product limits include non-optimal packing, no carried-over offcut inventory, and one tile product per surface.
- **P2 differentiation:** Version-linked outcomes capture consumed and installed counts, breakage, itemized reusable/discarded remnants, installer label, labor, and practicality. Private descriptive cohorts can be grouped by pattern, room shape/size, format, material, and installer. No real pilot outcomes have been supplied, so the performance targets remain unverified.
- **External dependencies:** A recurring calendar event still needs a connected calendar. A real reviewed supplier feed, pilot installers, consented completed jobs, and a reachable Supabase/Docker environment are not present in this workspace.
- **Evidence quality:** The competitor columns summarize official vendor materials checked for this baseline. They are capability claims, not independent tests. Recheck editions, current features, pricing, and availability during each monthly review.

## Monthly issue template

Copy this block for each monthly run and fill every line; use **No change found** only after checking the source.

```text
Review date / reviewer:
Sources checked (with last-updated dates):

MeasureSquare changes:
Layometry changes:
TilePlan Pro changes:

Benchmark changes (1–15):
1 Geometry:
2 Layout accuracy:
3 Cut accuracy:
4 Material quantities:
5 2D/3D synchronization:
6 Pattern coverage:
7 Offcut reuse:
8 Cut list and export:
9 Multiple materials/surfaces:
10 Save and share:
11 Estimate versus actual:
12 Accuracy over projects:
13 Historical intelligence:
14 Supplier catalogue:
15 Installer usability:

TileLoop acceptance dataset run and result:
New evidence / unresolved claims:
Recommended product action:
```

## Local verification performed

- `npm test`: **51 passed, 0 failed**, covering 10 analytic room references, all six patterns across four room-shape/obstacle cases, reference cut schedules, cut nesting/rotation, backup validation, cohort grouping, project material takeoff, and exports.
- `npm run test:e2e`: **2 passed, 4 skipped**. Coverage includes the B2B audience positioning at desktop and mobile widths, compact geometry disclosure, image tracing, pattern changes, padded 2D bounds, CSV and print exports, and selection persistence across 2D/3D switching. Four authenticated flows were skipped after the test harness found local Supabase and Mailpit unreachable.
- `npm run build`: **passed** on Next.js 16.4.4, including the project, evaluation, restore, and share routes.
- `npm audit`: **0 vulnerabilities** in the dependency audit.
- `npm run supabase:lint`: **blocked** because Postgres at `127.0.0.1:54322` refused the connection. The three newest migrations and authenticated flows still need database-backed validation after Docker/Supabase is available.
- `git diff --check`: passed after the implementation changes and final UI pass.

## Remaining work that needs external evidence or configuration

- Connect a calendar in **Notion Settings → Mail & Calendar** before creating the recurring first-Monday event. The available Calendar integration reported no connected calendar; the monthly procedure and issue template are ready here.
- Populate `GROUND_TRUTH_TEMPLATE.csv` with independently checked surveyed plans and manual cut references for every supported pattern. Current fixtures are analytic, not field surveys.
- Recruit installers and complete the consented study using `PILOT_STUDY.md` and the three data templates. Do not claim the accuracy/usability thresholds before real samples meet them.
- Obtain a supplier-authored source feed and complete `SUPPLIER_VERIFICATION_TEMPLATE.csv` before publishing supplier facts as orderable.
- Apply the pending Supabase migrations in a reachable local or deployed database, then run the authenticated E2E and database lint checks. The code build does not apply database changes.

## Source register

**MeasureSquare**

- [MeasureSquare 8 product page](https://measuresquare.com/product/measuresquare-8/)
- [MeasureSquare products overview](https://measuresquare.com/products/)
- [Stone & Tile product and pricing](https://measuresquare.com/pricing/stone-tile/)
- [Official Cut and Fit FAQ](https://account.measuresquare.com/FAQ/RefFaqDetail.asp?ID=%7B93236733-16E8-4BA1-B76A-194F1EE5A500%7D)

**Layometry**

- [Official planner help](https://layometry.com/en/help)
- [Official FAQ](https://layometry.com/en/faq)
- [Official release changelog](https://layometry.com/en/changelog)
- [Product overview](https://layometry.com/en)

**TilePlan Pro (`tileplan.cc`)**

- [Official FAQ](https://tileplan.cc/faq)
- [Pattern library](https://www.tileplan.cc/patterns)
- [Official how-to and sharing/export guide](https://www.tileplan.cc/how-to)
- [Product homepage](https://tileplan.cc/)
- [Cost calculator](https://tileplan.cc/cost-calculator)

## Baseline source notes

The initial competitor scan used official vendor product/help/release pages, reviewed on 2026-11-16. Notable dated evidence: Layometry's changelog labels release 0.0.5 Beta as released 2026-09-07. Product features and pricing may change before the next review; check the live source pages again rather than carrying forward these findings.
