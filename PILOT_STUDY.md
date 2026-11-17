# TileLoop installer pilot protocol

This is a field-study plan, not a report of completed research. The repository currently contains analytical acceptance fixtures, not a verified set of surveyed installer jobs or completed pilot outcomes. The anonymized five-room pilot data mentioned in the product brief was not present in the workspace when this protocol was prepared.

## Goals

1. Compare TileLoop room area and cut plans with independent references.
2. Compare planned practical stock with actual stock consumed, using one defined denominator.
3. Measure whether installers can complete a basic planning/export task without help.
4. Find workflow failures before making accuracy, waste, or time-saving claims.

## Participants and privacy

- Recruit at least 10 working tile installers for the usability round. A smaller sample can reveal defects but cannot establish the proposed 80% completion target.
- Collect consent before recording task outcomes. Do not collect customer names, site addresses, or floor-plan images unless they are necessary and separately authorized.
- Use pseudonymous `installer_id` and `project_id` values. Keep any identity key outside the project repository.
- Store installation measurements only with the installer’s permission. Tell participants what is retained and how they can request removal.
- Do not mix illustrative demo data, engineering fixtures, or unconfirmed historical counts into field-accuracy metrics.

## Fixed geometry and cut-reference dataset

Start with the 10 analytical geometry fixtures in `tests/benchmark-acceptance.test.js`. They are useful repeatable checks but are not surveyed-room evidence. For each real room, create a reference row in `GROUND_TRUTH_TEMPLATE.csv` and retain:

- measured room boundary, openings, obstacles, and doorway markers in millimetres;
- independently checked gross and usable area, including the calculation method;
- the exact tile size, grout, measured saw kerf, pattern, origin, and allowed stock direction;
- manually checked piece IDs, dimensions, locations, and stock-tile allocations;
- the independent checker and verification date.

Have a second person verify area and cut references without using TileLoop output. Freeze the reference version before comparing results. Keep later corrections as a new version with a reason.

## Installation outcome definition

For accuracy comparisons, use **actual tiles consumed from stock including broken tiles** as the denominator and benchmark `planned practical stock` against it:

`APE = |planned practical stock − actual tiles consumed| / actual tiles consumed × 100`

Record installed tile count separately when known. Breakage is a subset of tiles consumed. Record reusable and discarded offcuts as separate measured rectangles with width, length, and quantity; do not infer these from leftover area. Do not use purchase/carton quantity as actual consumption. If the count definition is unknown, mark it unknown and exclude it from accuracy metrics.

## Usability tasks

Ask each participant to work unaided. Start a timer at the first interaction and stop it when the requested artifact is complete.

1. Create a basic rectangular room with the stated dimensions.
2. Enter the tile format, grout, and known saw kerf.
3. Generate and inspect a straight layout.
4. Change to one requested offset pattern and choose the specified origin.
5. Find a named cut and report its dimensions and room location.
6. Export the CSV cut list and printable plan.
7. Save the plan and reopen it.

Record total time, layout-generation time, export time, whether help was needed, completion, incorrect inputs, task abandonment, and any data lost during normal editing. Do not count a developer coaching the participant as independent completion.

## Proposed analysis

- Geometry acceptance: compare 10/10 reference rooms; area error target ≤0.5%.
- Cut acceptance: compare every numbered piece, dimension, and position against frozen manual references; target 100% on the stated reference set.
- Accuracy pilot: report median APE, share within 5%, share within 10%, and signed bias, always with eligible sample count. The proposed thresholds (≤5%, ≥70%, ≥90%) remain unvalidated targets.
- Usability pilot: report median task times, unaided completion count, and observed data-loss events. The proposed target is at least 8/10 unaided completions for the basic task.
- Show results by pattern, room shape/size, tile format/material, and crew only where a group has enough observations to interpret. Preserve small-group sample counts and avoid predictive claims.

## Data capture files

- `GROUND_TRUTH_TEMPLATE.csv` — independent room/layout reference.
- `PILOT_OUTCOME_TEMPLATE.csv` — one completed installation per row.
- `INSTALLER_USABILITY_TEMPLATE.csv` — one participant/task set per row.
- `SUPPLIER_VERIFICATION_TEMPLATE.csv` — facts that must be checked before an orderable supplier import.

Keep completed study files in an access-controlled location. Do not commit participant or supplier data to Git.
