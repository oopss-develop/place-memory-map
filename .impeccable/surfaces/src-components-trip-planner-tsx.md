---
version: 1
slug: "src-components-trip-planner-tsx"
primary_target: "src/components/trip-planner.tsx"
related_targets: ["src/components/timetable-grid.tsx", "src/app/timetable.css", "src/components/ui"]
---

# Travel timetable surface

Mode: Operate. Inherit the Neutral shadcn New York system in DESIGN.md and the whole-app redesign contract in .impeccable/direction.md.

## Direction contract

THESIS: Select a period of time, attach a destination, and immediately locate that plan on the shared map. Trips and memories remain separate.

OWN-WORLD: Clean neutral surfaces, thin semantic borders, shared compact controls, Lucide icons, and the same user-selected font and color preferences as the journal. The former paper/ink/vermilion variable names are compatibility aliases; they do not authorize warm notebook styling. Default primary actions are neutral dark, and metadata is muted.

STORY: A member chooses or names a trip, brushes a time range, searches or reuses a place, then checks the pin and adjusts the schedule. Failed saves retain the existing schedule; stale edits cannot overwrite collaborators.

FIRST VIEWPORT: Inherit the record workspace. A 340px navigation sidebar (280px at intermediate widths) groups shared map selection, record/travel navigation, shared travel picker, chronological day rows, and anchored secondary actions. WorkspacePicker is shared with the journal, including 48px triggers and keyboard menus. The main area exposes the current travel heading and primary add action above a 76px date bar and 1.08fr / 1fr timetable/map split. Mobile uses a focus-managed navigation drawer, one current date column, and time/map tabs to preserve workspace height. Agenda rows repeat record-list hierarchy with separate time and place lines.

FORM: Preserve time brushing, moving, resizing, overlaps, overnight segments, export, shared-location selection, and numbered map pins. Planner dialogs use neutral card surfaces, 20px headings, inline errors, and sticky save/cancel actions; mobile editable inputs use 16px text and controls reserve 44px targets. Dense timetable metadata and resize handles remain local geometry exceptions.

FINISH: Reviewed and verified with the whole-app handoff in .impeccable/verification.md; DESIGN.md and schemaVersion 2 design.json now record the shipped system.

No new raster assets were introduced. Existing numbered map pins and provider assets retain their appearance and behavior without defining the UI palette.
