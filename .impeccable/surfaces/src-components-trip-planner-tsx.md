---
version: 1
slug: "src-components-trip-planner-tsx"
primary_target: "src/components/trip-planner.tsx"
related_targets: ["src/components/timetable-grid.tsx","src/app/timetable.css"]
---

# Travel timetable surface

Mode: Operate. This extends the existing map journal; it does not replace its visual identity.

## Direction contract

THESIS: Select a period of time, attach a destination, and immediately locate that plan on the shared map. Trips and memories remain separate.

OWN-WORLD: Inherit the existing paper/surface/ink/vermilion theme variables, user font settings, 7px controls, compact metadata, notebook dividers and accessible focus treatment.

STORY: A member chooses or names a trip, brushes a time range, searches or reuses a place, then checks the pin and adjusts the schedule. Failed saves retain the existing schedule; stale edits cannot overwrite collaborators.

FIRST VIEWPORT: Compact trip and date controls precede date columns on the left and a map with an ordered agenda on the right. Mobile uses one date column and time/map tabs. The primary action is 일정 추가. Selected events expose full times and editing actions.

FORM: User-selected desktop split and mobile tabs, inherited-surface extension; no visual-world roll or image comp. Signature interaction: brushing a quarter-hour range previews its geometry before the place picker opens. Motion uses existing map selection feedback, respects reduced motion, and does not obscure schedule content.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

No new raster assets or global design tokens are introduced. Existing DESIGN.md remains authoritative.
