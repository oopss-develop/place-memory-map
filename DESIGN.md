---
name: Place Memory Map
description: A clean, organized private map journal using shadcn/ui New York and Neutral surfaces.
colors:
  primary: "#18181b"
  primary-foreground: "#fafafa"
  background: "#ffffff"
  foreground: "#18181b"
  card: "#ffffff"
  muted: "#f4f4f5"
  muted-foreground: "#71717a"
  sidebar: "#fafafa"
  border: "#e4e4e7"
  input: "#d4d4d8"
  ring: "#a1a1aa"
  destructive: "#dc2626"
  rating-gold: "#ffc400"
  rating-gold-deep: "#a16207"
typography:
  display:
    fontFamily: "var(--font-sans), sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-.02em"
  headline:
    fontFamily: "var(--font-sans), sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-.02em"
  title:
    fontFamily: "var(--font-sans), sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-.02em"
  section:
    fontFamily: "var(--font-sans), sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "var(--font-sans), sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "var(--font-sans), sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  sm: ".375rem"
  md: ".5rem"
  lg: ".625rem"
  sheet: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  control: "12px"
  md: "16px"
  gutter: "20px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-ghost:
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  input:
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  badge:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "24px"
  navigation:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.foreground}"
    width: "340px"
  place-sheet:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sheet}"
    padding: "20px"
---
# Design System: Place Memory Map

## Overview

**Creative North Star: "The Organized Map Workspace"**

The user-selected visual world is shadcn/ui New York with a Neutral base, Lucide icons, and Noto Sans KR by default. White content, soft gray navigation, thin boundaries, and compact typography make records and travel plans easy to scan.

The whole application shares this system: map journal, record drawer, account and preference menus, place details, visit and map dialogs, travel timetable and agenda, login, first-map setup, and offline screen. Warm notebook styling is superseded by the explicit request for a clean, organized shadcn interface.

**Key Characteristics:**

- Neutral surfaces and dark primary actions with consistent focus and disabled states.
- Compact operational typography and gently curved controls.
- Map-first desktop workspace and touch-friendly mobile sheets.
- Persistent, independent user font and color preferences.

## Colors

The default palette is neutral; meaningful accents belong to actions, errors, ratings, and user-selected themes.

### Primary

**Neutral Primary** commits actions and anchors the brand mark. **Primary Foreground** provides its readable inverse text.

### Secondary

The destructive color marks validation and destructive actions. Rating gold and its deeper outline remain reserved for stars and rating feedback.

### Neutral

Background and card provide white content surfaces. Sidebar provides a quiet navigation field. Muted supplies hover, selected, and recessed surfaces; muted foreground carries metadata. Border separates content; input distinguishes editable fields; ring identifies keyboard focus. Secondary, accent, and popover semantic roles inherit the corresponding neutral surface values in CSS.

**The Semantic Surface Rule.** Use semantic CSS variables so color preferences apply consistently to new surfaces.

### Preferences

Preserve theme IDs and browser storage: `notebook` now displays **뉴트럴** (Neutral), `pure` uses blue primary, `forest` green, `lavender` violet, and `dark` reverses neutral surfaces. These preferences keep the clean layout and type hierarchy. Compatibility aliases such as paper, ink, vermilion, and olive resolve to the new semantic roles; their names do not authorize notebook styling.

Existing map-pin rasters, numbered travel pins, photographs, provider tiles, and rating effects retain their established asset colors and interactions. They are legacy map/content assets, not a UI palette source.

## Typography

**Default Font:** Noto Sans KR, through the shared font alias. User options are Noto Sans KR, NanumSquare, Gowun Batang, and system-ui. The choice applies to app typography, including controls and detail content, independently of color theme, and persists per browser/device. NanumSquare is self-hosted with attribution.

The regular hierarchy uses label, body, section, title, and headline roles from the frontmatter. Login uses the restrained display role. Body text is regular; controls commonly use medium weight (500); section and dialog headings use semibold (600). Metadata and schedule times use tabular numerals where present.

Inputs use (16px) type on mobile. Existing dense timetable metadata also uses (11–13px); responsive planner headings use (18–20px), planner empty states and offline headings use (22px). These local exceptions do not introduce a second display hierarchy.

**The Preference Continuity Rule.** Keep size and hierarchy consistent when a member changes their font; do not assign a mandatory serif voice to memories.

## Layout

Desktop journal uses a fixed (340px) sidebar beside a flexible map in a viewport-height grid. Shared sidebar gutters are (20px), record-list gutters (12px), and the account footer anchors beneath scrolling records. Group picker, record/travel navigation, search, filters, and dated records follow a stable vertical order.

At (820px) and below, the map fills the viewport. A visible search entry sits above it; records use a focus-managed drawer with width `min(calc(100% - 32px), 390px)`. Mobile sidebar gutters use (16px). Bottom navigation is (64px) plus safe-area inset and has five destinations when travel navigation is enabled. Detail sheets and pin actions reserve this space.

The travel planner inherits the record workspace: a (340px) navigation sidebar, reduced to (280px) at intermediate widths, groups map choice, record/travel navigation, travel choice, dated itinerary rows, and footer actions. Record and travel selectors use the same WorkspacePicker component, (48px) triggers, keyboard navigation, selected indicators, and themed menus. The main area contains the travel heading and primary add action above a (76px) date bar and timetable/map split (approximately 1.08fr / 1fr). Mobile hides navigation in a focus-managed drawer and keeps date controls and time/map tabs above the current day's workspace. The map agenda repeats the record-list pattern with separate time and place lines.

Login has a centered (360px maximum) column; first-map setup uses (400px maximum). Dialogs and scroll areas respect viewport height and safe areas. Use the observed (4/8/12/16/20/24/32px) spacing steps for alignment.

## Elevation & Depth

Structural navigation is flat, separated by tonal surfaces and one-pixel borders. Shared cards and buttons use subtle low shadows. Floating menus and notices use the popover shadow; place sheets and dialogs use the overlay shadow. The CSS defines popover as `0 4px 16px rgb(0 0 0 / .1)` and overlay as `0 16px 48px rgb(0 0 0 / .16)`.

**The Workspace Layer Rule.** Keep permanent workspace regions flat; use elevation to distinguish controls and content that float over the map.

Existing search overlays, desktop planner notices, and map markers retain local shadow declarations. Their legacy tints and pin drop shadows are not new reusable elevation tokens.

## Shapes

Use gently curved rectangles: small, medium, and large shared radii are in the frontmatter. Custom detail and planner sheets use the sheet radius. Badges and avatars remain round. Timetable events use a compact (6px) radius. Use one-pixel neutral borders and avoid restoring ruled notebook decoration.

## Components

### Buttons

Shared buttons expose default, secondary, outline, ghost, and destructive variants. Default uses primary and primary foreground, medium labels, and (16px) horizontal padding. Outline uses the input border; ghost gains an accent surface on hover. Shared default height is (36px), small is (32px), large is (44px). Mobile shared buttons and icon controls use (44px) minimum targets. Custom map pin and visit save actions use (48px) on mobile.

Shared primitives show a translucent (3px) ring on keyboard focus, while native/custom controls use a (2px) outline or an offset ring. Preserve the visible treatment appropriate to each component. Disabled actions reduce opacity and prevent interaction.

### Inputs / Fields

Inputs have thin input borders, rounded corners, muted placeholder text, compact padding, and a visible ring on focus. Shared input height is (36px) desktop and at least (44px) mobile; visit fields are (48px) mobile. Invalid fields use destructive borders/rings and inline error copy. Forms keep labels and validation adjacent to the relevant field.

### Cards / Containers

Shared cards use the large radius, a neutral border, subtle shadow, and (24px) content padding. Custom place sheets use (20px) content padding and overlay elevation. Keep structural lists and timetable regions flat.

### Chips / Badges

Badges use compact labels and round geometry. Filters use small rounded rectangles, with muted hover/selected fill and a border. Selection must remain understandable through text, state, and geometry.

### Navigation

Record/travel and planner source/view toggles use a muted grouped track and a selected surface. Dated record rows use compact (32px) pin thumbnails, medium titles, muted summaries, and an outlined accent selection. Account menus preserve theme and font previews. Lucide icons accompany readable labels or accessible names.

### Place Details and Dialogs

Selecting a record reveals a compact place sheet while keeping map context. Mobile detail content scrolls independently beneath persistent expand/close controls. Visit and planner dialogs retain native dialog focus behavior; mobile save/cancel actions remain sticky and saving prevents accidental dismissal. Preserve inline validation and save errors.

### Timetable

Time brushing previews a range before destination selection. Events expose selected state and full details through the selection panel; movement, resizing, overlap, overnight segments, and numbered map pins retain existing behavior. Timetable geometry and small resize handles are task-specific controls, not general touch-size primitives.

## Do's and Don'ts

### Do:

- Do inherit semantic colors and shared UI primitives across every app surface.
- Do preserve independent stored font and color preferences.
- Do use at least 44px mobile touch targets and 16px editable input text.
- Do retain visible keyboard focus, accessible record lists, and sticky mobile save actions.
- Do let the map, photographs, and existing pins carry content-specific visual interest.

### Don't:

- Don't restore warm paper surfaces, vermilion actions, notebook rules, or mandatory serif memory headings.
- Don't introduce a separate color, typography, or control system for travel planning.
- Don't infer reusable UI colors from preserved map tiles or pin assets.
- Don't obscure inline errors or dismiss a form while saving.

## Search, Recovery and Photos

Workspace selectors share searchable menu content. Record search explicitly distinguishes new place discovery from stored records; detailed filters remain in the scrollable list area. Recovery banners, empty results, undo and save results use semantic status copy. Deletion uses one native confirmation dialog with an explicit destructive action. Photos open a keyboard-accessible enlargement dialog with navigation and individual deletion. Mobile travel defaults to spacious numbered daily itinerary rows with visible time, place, memo, overnight/overlap labels and 44px edit/map actions.
