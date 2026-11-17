# TileLoop — four-minute demo script

**Open:** `http://127.0.0.1:3000/demo`. Use the sample values. The public demo needs no account and does not save changes. All sample quantities are illustrative.

## 0:00–0:30 | What has changed

**Show:** The demo banner and room plan.

**Say:**

> “Hi, I’m Shwejan. TileLoop helps tile installers plan a job before they cut. My first prototype handled a rectangular room and one straight layout. Since then, I’ve expanded it to room outlines, obstacles, openings, several patterns, numbered cut pieces, and both 2D and 3D views. I’ll show those planning improvements using sample data.”

## 0:30–1:10 | Model the room

**Show:** The L-shaped outline and the column, floor opening, and doorway marker in the geometry panel.

**Say:**

> “This sample is an L-shaped room. TileLoop treats the column and floor opening as areas not to tile. The doorway marks access along a wall; it does not remove floor area. I can also trace a room outline over a PNG, JPEG, or WebP floor-plan image. The trace is manual and uses the measured room dimensions—there’s no automatic plan recognition.”

**Optional, only if time:** In **Room outline**, choose **Custom polygon / multiple areas**, upload a prepared, non-sensitive plan image, click **Trace room outline**, add points, and choose **Use traced outline**. The image stays in the browser.

## 1:10–2:00 | Compare patterns and inspect a cut

**Show:** Change **Installation pattern** to **One-third offset**, then **Herringbone 90°**. Switch to 2D, select a cut piece, then switch to 3D.

**Say:**

> “The planner now supports straight, half-offset, one-third offset, two-thirds offset, diagonal, and 90-degree herringbone layouts. Herringbone requires a 2-to-1 tile format, and the planner flags grout-joint assumptions that need an installer’s check. Changing a pattern recalculates the pieces. I can select a piece to see its ID and dimensions, then inspect the same plan in 3D.”

> “For irregular cuts, the listed dimensions are maximum bounds, not the exact cut area.”

## 2:00–3:05 | Explain the quantities

**Show:** The estimate cards, cut schedule, and offcut candidates.

**Say:**

> “TileLoop separates the area-only minimum from the practical stock estimate. In this sample, the lower bound is 92 tiles; the cut-plan estimate is 95. Fifty pieces need cuts, grouped into 13 cut types. An 8 percent buffer gives 103 tiles. The illustrative pack size is eight, so carton rounding gives 13 cartons, or 104 tiles.”

> “The offcut panel shows candidate pieces and possible bounding-box fits. That is a suggestion, not proof an installer can reuse them. Nesting is heuristic, so the cut plan still needs a site review.”

## 3:05–3:35 | Show the handoff

**Show:** Select a piece ID, then use **CSV cut list**, **SVG plan**, or **Print / PDF**.

**Say:**

> “The plan is more than a picture: pieces have IDs, locations, dimensions, and source-stock assignments. I can inspect them here or export the cut list for review. This demo does not save a project or place an order.”

## 3:35–4:00 | Close with the pilot

**Say:**

> “The progress is a move from a simple room calculator toward a reviewable installation plan. The next test is to compare one measured job with an installer’s set-out and record actual tile use, breakage, and reusable offcuts. Until we collect that evidence, I’m not claiming verified waste savings or estimate accuracy.”
