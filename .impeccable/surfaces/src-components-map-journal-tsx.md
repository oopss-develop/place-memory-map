---
version: 1
slug: "src-components-map-journal-tsx"
primary_target: "src/components/map-journal.tsx"
related_targets: ["src/app/globals.css", "src/components/trip-planner.tsx", "src/app/timetable.css", "src/components/ui", "src/components/font-preference.tsx", "src/lib/themes.ts", "src/lib/fonts.ts"]
---

# Whole-app map workspace

Mode: Operate. This surface covers the whole-app shadcn redesign authorized on 2026-10-01.

## Direction contract

THESIS: Record and revisit shared places through a clean, organized map workspace, with consistent typography and control placement across records and travel planning.

OWN-WORLD: shadcn/ui New York, Neutral base, Lucide icons, and Noto Sans KR by default. White content, soft gray navigation, dark primary actions, thin neutral boundaries, and compact 12/14/16/20/24px hierarchy; login uses 26px. DESIGN.md and .impeccable/design.json describe the final source tokens. Warm notebook styling is superseded.

STORY: A member chooses a shared map, searches or manually pins a place, adds a dated visit, then browses records and place history. Travel planning reuses places while preserving visit records. Keep data, sharing permissions, error recovery, accessible record lists, and existing interaction behavior.

FIRST VIEWPORT: Desktop uses a 340px sidebar grouping map choice, record/travel navigation, search, filters, and chronological records over an anchored account footer; the map fills the remaining space. Mobile keeps visible place search above the map, a focus-managed record drawer, bottom navigation, safe-area spacing, and at least 44px touch controls.

FORM: Apply the system to the map and record drawer, account/theme/font menus, place details, visit/map dialogs, trip header/timetable/agenda/dialogs, login, first-map setup, offline screen, and shared UI primitives. Selecting a dated record reveals a compact sheet while retaining geographic context. Mobile detail content scrolls under persistent expand/close controls; visit and planner save/cancel actions stay sticky. Inputs use 16px mobile text. Preserve native-dialog focus and saving protections.

PREFERENCES: Stored notebook ID now labels Neutral; pure remains blue, forest green, lavender violet, and dark neutral dark mode. Noto Sans KR, NanumSquare, Gowun Batang, and system-ui remain independent persistent font choices.

ASSETS: Existing map-pin and numbered-pin rasters, user photos, provider maps, and rating feedback remain unchanged content/interaction assets. No new raster imagery was required or generated; asset colors do not establish a second UI system.

FINISH: Whole-app desktop/mobile review, dark preference checks, unit/interaction tests, TypeScript, ESLint, and production build are recorded in .impeccable/verification.md. The design handoff replaces superseded notebook documentation with the shipped Neutral system.
