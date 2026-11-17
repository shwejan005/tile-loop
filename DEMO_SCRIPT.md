# TileLoop — five-minute evaluator demo

## Before the room

- Start the app with `npm run dev` and open `http://127.0.0.1:3000/demo` in the browser.
- Put the repository in an editor on a second screen. Keep the files listed below ready in tabs; use them only when explaining how a displayed result is produced.
- For the saved-project section, sign in to a prepared account with one project containing two surface plans that use different materials. For the evaluation section, use completed, consented pilot records. Do not seed illustrative values as if they were field evidence.
- If Supabase is unavailable, run the public demo through exports and use the source-file handoff for saved projects/evaluation. State that the authenticated database workflow needs a configured database; do not invent saved records.

## Run of show

| Time | On screen | Presenter script and action | Source file to open |
|---|---|---|---|
| **0:00–0:35** | Browser: `/` audience section, then `/demo` | Point to the B2B badge and audience cards. “TileLoop is B2B-first trade software for tile installers and contracting businesses. The installer or estimator plans the job; the homeowner or client gets a read-only review link. Pricing and team-seat needs are still unvalidated. This demo room is illustrative.” | `app/page.js`; `app/demo/page.js`; `PRODUCT_BRIEF.md` |
| **0:35–1:10** | Browser: room controls and model | Open **Room geometry** to show the L-shaped boundary, column, floor opening, and doorway. Change one room measurement or edit the outline; show the plan recompute. “Openings and obstacles change the installable area, not just the room’s gross rectangle.” | `components/RoomGeometryEditor.jsx`; `lib/geometry/operations.js` |
| **1:10–1:40** | Browser: pattern controls | Change half-offset to one-third offset, then choose **Start at top-left of room bounds**. Show the grid move. Leave cut rotation off for the sample’s directional-product caveat. “Six patterns are available. Origin and stock-cut rotation are explicit settings; rotation stays off unless the product allows it.” | `components/RoomPlanEditor.jsx`; `lib/planner.js`; `lib/layout/registry.js` |
| **1:40–2:15** | Browser: 2D, selected piece, then 3D | Click a perimeter piece in the opening 2D view to show its ID and maximum cut bounds. Switch to 3D and show that the selection remains. “The 2D and 3D views are driven from the same calculated pieces. The cut-size schedule and stock allocation below come from that plan.” | `components/RoomPlan2D.jsx`; `components/RoomScene.jsx`; `lib/layout/polygon.js` |
| **2:15–2:50** | Browser: metrics and cut schedule | Point out practical stock, buffered order, area-only lower bound, carton rounding, and the cut schedule. Open the offcut candidates. Say: “The nesting is conservative and heuristic. These are candidates for an installer to inspect, not a claim that the packing is globally optimal.” | `lib/cutting/nesting.js`; `components/RoomPlanEditor.jsx` |
| **2:50–3:20** | Browser: export controls | Click **CSV cut list** and show one row per positioned piece. Click **Print / PDF** and show the numbered drawing and cut table; save from the browser print dialog only if time allows. “Each row keeps its piece ID, source stock, dimensions, room location, and orientation.” | `lib/cut-list-export.js` |
| **3:20–4:00** | Prepared project: `/projects/[projectId]` | Show two saved surfaces, then the consolidated material takeoff. Create a read-only client link and open it in a private browser window. “The contractor owns the project; the homeowner or client can review it but cannot edit it.” | `app/(workspace)/projects/[projectId]/page.js`; `lib/material-takeoff.js`; `components/ProjectShareControl.jsx`; `app/share/[token]/page.js` |
| **4:00–4:30** | Saved room: outcome form | Show the field record fields for consumed/installed tiles, breakage, itemized reusable and discarded offcuts, installer label, time, and practicality. “The outcome stays attached to the saved calculation version, so we can compare the original estimate later.” | `components/InstallationOutcomeForm.jsx`; `app/actions/rooms.js` |
| **4:30–5:00** | `/evaluation` or closing slide | If consented pilot data exists, show its sample count and one cohort view. If it does not, show the empty state and say: “The targets are proposed; we will claim accuracy only after enough comparable completed jobs.” Close with “TileLoop’s differentiator is the feedback loop from plan to measured installation.” | `app/(workspace)/evaluation/page.js`; `lib/evaluation-metrics.js`; `lib/data/evaluation.js` |

## Presenter guardrails

- All public-demo dimensions and carton sizes are sample values. Do not describe them as a measured room or verified supplier data.
- Distinguish **planned stock**, **buffered order**, and **cartons to order**. The area-only value is a lower bound, not a purchase recommendation.
- Describe offcuts as candidates. A bounding-box fit does not verify tile grain, edge quality, defects, or job-site cutting constraints.
- Only show evaluation rates when the account contains real, permissioned installation outcomes. Keep each group’s sample count visible.
- Do not claim that a proposed target (for example, median APE ≤5%) has been achieved without field evidence.

## Reset after the demo

Revoke any temporary share link. Delete only the dedicated demo project/account through the app, and keep the anonymized acceptance fixtures separate from real installer outcomes.
