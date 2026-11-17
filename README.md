# TileLoop

TileLoop is B2B-first planning software for professional tile installers and contracting businesses. Installers and estimators plan jobs; homeowners and project clients can review a contractor-shared plan through a read-only link. Pricing and company-seat requirements remain unvalidated.

For a short introduction, see [PRESENTATION_SCRIPT.md](./PRESENTATION_SCRIPT.md). To run the product tour, see [DEMO_GUIDE.md](./DEMO_GUIDE.md).
For the timed evaluator walkthrough, see [DEMO_SCRIPT.md](./DEMO_SCRIPT.md). For the recurring competitor review and 15-benchmark scorecard, see [COMPETITOR_MONITORING.md](./COMPETITOR_MONITORING.md).
For independent ground-truth, installer outcome, and usability data collection, see [PILOT_STUDY.md](./PILOT_STUDY.md) and its blank CSV templates.

## Features

- Polygon room outlines, multiple areas, floor openings, obstacles/columns, and doorway markers.
- Straight, half-offset, one-third offset, two-thirds offset, diagonal, and 90° herringbone layouts with grout, orientation, kerf, and reserve settings. Herringbone requires 2:1 tile stock.
- Numbered cut pieces, interactive 2D/3D views, SVG export, and conservative shape-aware offcut candidates.
- Private projects and calculation history, multi-surface material takeoff, read-only share links, account backup/restore, installer comparisons, and carton rounding from a user-verified pack size.
- Version-linked field outcomes for stock consumed, optional installed quantity, breakage, reusable/discarded offcuts, installer/crew label, labor, and practicality; private cohort summaries by pattern, room geometry/size, tile format, material, and installer.
- Generic supplier catalog support. RAK UAE data is a staging import—not an ordering feed. See [SUPPLIER_FEED.md](./SUPPLIER_FEED.md) for the approved facts import.

## Run the demo locally

Requires Node.js 20.9+ and Docker Desktop.

```sh
npm ci
npm run supabase:start
```

Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the server-only `SUPABASE_SECRET_KEY` from `supabase status --output env`; set `APP_URL=http://127.0.0.1:3000`. Keep `.env.local` private. Apply any migrations that are not yet installed, preserving existing local data:

```sh
./node_modules/.bin/supabase migration up
npm run dev
```

`npm run supabase:reset` recreates the local database and removes its data. Use it only when you want a clean disposable database.

Open <http://127.0.0.1:3000> and choose **Try the interactive demo**, or go directly to <http://127.0.0.1:3000/demo>. The read-only demo includes a sample L-shaped room, obstacle, floor opening, half-offset layout, and illustrative pack size. Supabase Studio is at <http://127.0.0.1:54323>; local confirmation emails appear in Mailpit at <http://127.0.0.1:54324>.

## Verify

```sh
npm test
npm run supabase:test
npm run supabase:lint
npm run test:e2e
npm run build
npm audit
```

## Important limits

Polygon cuts and offcut reuse use conservative heuristic nesting; the result is not a proven optimum and needs installer review. Cut rotation is opt-in and only eligible rectangular cuts can rotate; check the product's grain or directional finish. Herringbone supports 2:1 tiles and warns about wider T-junction grout pockets. Floor-plan images can be traced manually; automatic plan recognition is not provided. Carton, price, and stock fields can be loaded from a reviewed supplier feed; no approved supplier feed or completed pilot outcomes are included. Public RAK data stays staging-only. Pilot metrics are descriptive—not proof of accuracy or savings. See [PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md) for current scope and limits.
