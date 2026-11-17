# TileLoop — final five-minute product demo

This is a spoken walkthrough for evaluators. It explains the buyer, the installer workflow, what the calculations mean, and what TileLoop has not validated yet.

## Before the demo

### Before demo day

The current checkout uses Next.js 16.4.4. Its security gate stopped the local dev server and production build. Update to the patched 16.4.5 release, then rerun the build and browser checks before presenting. See the [Next.js November 2026 security release](https://nextjs.org/blog/november-2026-security-release).

After the framework update:

1. Start local Supabase with `npm run supabase:start`.
2. Start TileLoop with `npm run dev`.
3. Open the landing page at `http://127.0.0.1:3000` and the public demo at `http://127.0.0.1:3000/demo`.
4. Sign in to a dedicated evaluator account. Prepare one clearly named sample project with two saved surfaces using different materials. Keep every invented or example value labeled **illustrative**.
5. If you have permissioned, completed pilot records, prepare one real outcome for the evaluation page. If you do not, leave that page empty and say so directly. Never create fake installation outcomes to make the charts look complete.
6. Open a private browser window for the read-only share link. Keep the app in the first window.
7. Put the source files listed in the run of show into editor tabs on a second screen. Stay in the product unless an evaluator asks how a result is produced.

The public `/demo` is read-only: it does not save a project or create an order. The prepared signed-in project demonstrates saving, sharing, and field outcomes.

## Run of show

### 0:00–0:30 — Explain who TileLoop serves

**On screen:** Open `/`. Point to the “B2B / TILE INSTALLER SOFTWARE” label, then the two audience cards.

**Say:**

> “TileLoop is an early B2B-first planning product for professional tile installers and contracting businesses. The buyer hypothesis is the installation-business owner or contractor; the estimator or installer is the daily user. A homeowner or client is a secondary audience who can review a contractor-shared plan without editing it. Pricing, company seats, and willingness to pay have not been validated yet.”

**Then:** Select **Try the interactive demo**.

**If asked about the business model:** TileLoop currently supports individual account ownership and read-only project sharing. It does not yet have billing, company administration, or multi-user editing.

**Source tabs:** `app/page.js`, `PRODUCT_BRIEF.md`.

### 0:30–0:55 — Set the sample-data context

**On screen:** At `/demo`, point to the “B2B installer workflow · interactive demo” banner and the room drawing.

**Say:**

> “This is the working planner, using a sample L-shaped room. The overall room bounds are 5,200 by 4,200 millimetres. The example uses 600 by 300 millimetre tiles, a 3 millimetre grout joint, a 1 millimetre saw kerf, an 8 percent order buffer, and an illustrative pack of eight tiles per carton. These are demo inputs, not a surveyed job or verified supplier data.”

**Then:** Point out the three numbered walkthrough links: **Room geometry**, **Layout and cuts**, and **Material estimate**.

**Source tabs:** `app/demo/page.js`, `lib/demo-sample.js`.

### 0:55–1:25 — Show the measured room model

**On screen:** Open the **Room geometry** disclosure. Point to the L-shaped outline, column, floor opening, and doorway marker.

**Say:**

> “The room model distinguishes the floor boundary from features inside it. The column and floor opening are excluded from the tiled area. The doorway marks access along a wall; it does not subtract floor area. I can edit the geometry or dimensions, and the plan recalculates from those inputs.”

Avoid changing the sample dimensions during this short run; keeping them unchanged makes the quantities later in the demo match the displayed example. If an evaluator asks, choose **Room outline → L-shaped room** and use **Apply L-shape** to show the editable geometry controls.

**Source tabs:** `components/RoomGeometryEditor.jsx`, `lib/geometry/operations.js`.

### 1:25–2:00 — Show layout changes and inspection

**On screen:** In **Installation pattern**, switch from **Half-offset (50%)** to **One-third offset**. Show the layout recompute, then restore **Half-offset (50%)**. Select a perimeter cut in 2D; switch to **3D**, then return to **2D**.

**Say:**

> “The same measured room can be evaluated with six supported patterns: straight, half-offset, one-third offset, two-thirds offset, diagonal, and 2:1 herringbone. Changing the pattern changes the tile positions and edge cuts. Selecting a piece gives its ID and dimensions; the 3D view uses the same calculated pieces, so I can inspect that position from another view.”

The selected polygon cut is reported by its **maximum bounds**. Do not describe those bounds as the exact area or shape of a non-rectangular cut.

**If 3D is slow or unavailable:** Stay in 2D and explain that the product has both views. Do not spend demo time troubleshooting WebGL.

**Source tabs:** `components/RoomPlanEditor.jsx`, `components/RoomPlan2D.jsx`, `components/RoomScene.jsx`, `lib/layout/registry.js`.

### 2:00–2:45 — Explain the estimate instead of just reading it

**On screen:** Scroll to the four estimate cards and the **Every edge, accounted for** cut schedule. Expand a grouped piece-ID list if visible.

**Say:**

> “The estimate separates coverage from cutting and ordering. For this sample, the area-only lower bound is 92 tiles. That is a coverage reference; it does not include cut or kerf losses. The practical stock plan is 95 tiles, including 50 cut pieces across 14 cut types. The 8 percent buffer brings the calculated quantity to 103 tiles. With the sample pack size of eight, the suggested order is 13 cartons, which is 104 physical tiles after carton rounding.”

Then add:

> “The app keeps those numbers separate so the area minimum is not mistaken for an order recommendation. The pack size is entered for this demo and is not verified supplier data.”

Point to **Offcut candidates** and say:

> “The five displayed offcut candidates are possible reuse opportunities for an installer to review. The nesting is heuristic: fit in two dimensions does not prove the piece is usable after considering grain, defects, edge quality, or site cutting constraints.”

**Source tabs:** `lib/planner.js`, `lib/cutting/nesting.js`, `components/RoomPlanEditor.jsx`.

### 2:45–3:10 — Hand off a usable cut schedule

**On screen:** Click **CSV cut list** and show the downloaded file. Click **Print / PDF**; show the numbered drawing and schedule in the print preview, then cancel the dialog.

**Say:**

> “The cut schedule groups matching sizes for review, while the export retains the positioned piece IDs and source-stock allocation. An installer can use the CSV for the cut data or print the numbered plan with its schedule. These are planning outputs; cuts and quantities still need site verification.”

**Source tabs:** `lib/cut-list-export.js`, `app/api/export/route.js`.

### 3:10–3:50 — Show the contractor project and client handoff

**On screen:** Switch to the prepared signed-in project. Show the two surface plans and the **Consolidated takeoff**. Click **Create read-only link** (or **Replace share link** if one is active), then open the displayed URL in the prepared private window.

**Say:**

> “A contractor project can hold separate floor, wall, or accent surfaces. The takeoff groups quantities by material and rounds cartons per product. The contractor owns the project; a customer gets this read-only view of the saved plans and quantities, not access to edit the estimate.”

Do not spend time creating a second project live. The prepared project should already contain the two illustrative surface plans.

**Source tabs:** `app/(workspace)/projects/[projectId]/page.js`, `lib/material-takeoff.js`, `components/ProjectShareControl.jsx`, `app/share/[token]/page.js`.

### 3:50–4:25 — Explain the feedback loop

**On screen:** Return to a saved room plan and point to **Record the installation**. Show consumed tiles, breakage, installed tiles, reusable offcuts, discarded material, installer label, time, and practicality fields. Do not submit example numbers as actual job data.

**Say:**

> “After the job, the installer can record how many tiles were taken from stock, including breakage, how many were installed, and what remained reusable or was discarded. That record stays attached to the saved calculation version. Keeping consumed and installed counts separate makes later comparisons clearer.”

**Source tabs:** `components/InstallationOutcomeForm.jsx`, `app/actions/rooms.js`.

### 4:25–5:00 — Close on evidence, not promises

**On screen:** Open **Evaluation** if the prepared account has real, permissioned outcomes. Keep the sample count visible and choose one cohort. If there are no real records, show the empty state instead.

**Say when real records exist:**

> “These are descriptive results from [N] completed jobs in this account. We group comparable work and show the sample size beside each result. The percentage error compares planned stock with recorded tiles consumed, where consumed includes breakage. This is evidence to inspect, not a guarantee of future accuracy.”

**Say when there are no real records:**

> “The evaluation view is ready, but this account does not yet have completed pilot outcomes. The accuracy numbers are proposed targets, not achieved results. We need enough comparable completed jobs before making an accuracy or savings claim.”

**Close:**

> “TileLoop connects a measured room to a reviewable layout and cut plan, then gives installers a way to compare the estimate with what happened on site. The product hypothesis is that this measured feedback loop can make future planning more accountable.”

**Source tabs:** `app/(workspace)/evaluation/page.js`, `lib/evaluation-metrics.js`, `lib/data/evaluation.js`.

## Likely evaluator questions

**Who pays, and who uses it?** The current buyer hypothesis is an installation-business owner or contractor. Estimators and installers are daily users. This is a B2B positioning hypothesis; pricing and purchasing evidence are not validated.

**Is this a consumer app?** No. The primary workflow is for trade businesses. Homeowners and project clients can receive a read-only handoff.

**How accurate are the estimates?** Geometry and supported layouts are tested against reference cases. Real-world material accuracy is not established until comparable completed-job outcomes have been collected and reviewed.

**Does TileLoop optimize every offcut?** No. It proposes heuristic, kerf-aware reuse candidates. The installer confirms whether a remnant is practical for the material and job.

**Can customers order tile from the app?** Not in this demo. Carton rounding uses the entered pack size. There is no approved live supplier feed or verified ordering workflow.

**What happens when the plan changes?** The layout and displayed estimate recalculate from the edited inputs. A saved recalculation creates a new version, preserving the assumptions used by earlier comparisons.

## Source-file quick reference

| When an evaluator asks… | Open |
|---|---|
| How is the B2B position stated? | `app/page.js`, `PRODUCT_BRIEF.md` |
| How does the sample room get created? | `lib/demo-sample.js` |
| How are room boundaries and openings represented? | `components/RoomGeometryEditor.jsx`, `lib/geometry/operations.js` |
| How do pattern and tile calculations work? | `lib/planner.js`, `lib/layout/registry.js`, `lib/layout/polygon.js` |
| How are offcuts considered? | `lib/cutting/nesting.js` |
| How does a client share work? | `components/ProjectShareControl.jsx`, `supabase/migrations/20261116000001_project_shares.sql` |
| How are field metrics computed? | `lib/evaluation-metrics.js`, `lib/data/evaluation.js` |

## After the demo

Revoke the temporary share link. Delete only the dedicated evaluator project or account. Keep illustrative fixtures separate from permissioned installation outcomes.
