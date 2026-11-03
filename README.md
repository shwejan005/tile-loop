# TileLoop

TileLoop is a brand-independent tile installation planner. It helps installers model room areas, compare tile layouts, inspect cuts, estimate material, and record what happened on site.

For a short introduction, see [PRESENTATION_SCRIPT.md](./PRESENTATION_SCRIPT.md). To run the product tour, see [DEMO_GUIDE.md](./DEMO_GUIDE.md).

## Features

- Polygon room outlines, multiple areas, floor openings, obstacles/columns, and doorway markers.
- Straight, half-offset, diagonal, and 90° herringbone layouts with grout, orientation, kerf, and reserve settings. Herringbone requires 2:1 tile stock.
- Numbered cut pieces, interactive 2D/3D views, SVG export, and conservative shape-aware offcut candidates.
- Private projects and calculation history, installer comparisons, carton rounding from a user-verified pack size, and actual installation outcomes with a pilot evaluation page.
- Generic supplier catalog support. RAK UAE data is a staging import—not an ordering feed. See [SUPPLIER_FEED.md](./SUPPLIER_FEED.md) for the approved facts import.

## Run the demo locally

Requires Node.js 20.9+ and Docker Desktop.

```sh
npm ci
npm run supabase:start
npx supabase status --output env
```

Copy `.env.example` to `.env.local`. Set the Supabase URL and publishable key from the status output, the server-only `SUPABASE_SECRET_KEY`, and `APP_URL=http://127.0.0.1:3000`. Then run:

```sh
npm run supabase:reset
npm run dev
```

Open <http://127.0.0.1:3000> and choose **Try the interactive demo**, or go directly to <http://127.0.0.1:3000/demo>. The read-only demo includes a sample L-shaped room, obstacle, floor opening, half-offset layout, and illustrative pack size. Local confirmation emails appear in Mailpit at <http://127.0.0.1:54324>.

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

Polygon cuts and offcut reuse use conservative bounding-box nesting; the result is not a proven optimum and needs installer review. Herringbone supports 2:1 tiles and warns about wider T-junction grout pockets. Floor-plan images can be traced manually; automatic plan recognition is not provided. Carton, price, and stock fields can be loaded from a reviewed supplier feed; no approved supplier feed is included. Public RAK data stays staging-only. Pilot metrics are descriptive—not proof of accuracy or savings. See [PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md) for the short product direction.
