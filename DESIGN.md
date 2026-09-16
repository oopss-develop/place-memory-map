---
name: Place Memory Map
description: A private shared map journal with the character of a working travel field notebook.
colors:
  primary: "#d84c32"
  primary-dark: "#a93324"
  paper: "#f4efdf"
  paper-deep: "#e9e0c8"
  ink: "#162d38"
  ink-muted: "#5c6966"
  olive: "#69784d"
  rule: "#c8c0a9"
  sheet: "#fffdf6"
typography:
  display:
    fontFamily: "var(--font-serif), serif"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "var(--font-sans), sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "var(--font-sans), sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: ".06em"
rounded:
  control: "7px"
  panel: "11px"
  chip: "999px"
spacing:
  xs: "5px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    background: "{colors.primary}"
    color: "{colors.sheet}"
    borderRadius: "{rounded.control}"
    fontWeight: 700
  input:
    background: "{colors.sheet}"
    color: "{colors.ink}"
    borderColor: "{colors.rule}"
    borderRadius: "{rounded.control}"
---

# Design System: Place Memory Map

## Sidebar system (September 16 revision)

### User-selectable font

The account menu provides four independent font preferences: Noto Sans KR
(default), NanumSquare, Gowun Batang, and system-ui. Each option previews its
own typeface. The choice applies throughout the app via the `--font-sans` and
`--font-serif` aliases, including controls and memory details, and persists in
local storage per browser/device. Color themes do not change this choice.
Typography sizes, weights, and spacing below remain consistent across fonts.
NanumSquare's original 400/700/800 WOFF files are self-hosted with attribution.

The navigation sidebar uses Noto Sans KR throughout, including map names,
record titles, dates and the account area. This supersedes the sidebar-specific
serif, numbered index and notebook-rule treatments described below.

- Heading: 18px / 700; item and control: 15px / 600; metadata: 13px / 400–600.
- Line height: 1.5. Numerals in metadata use tabular figures.
- Shared gutters: 24px desktop, 20px mobile; section spacing: 20–24px.
- Search and map picker: 48px overall height; filters: 40px minimum.
- Records show a 36px thumbnail of their selected map pin, not a sequence number.
- Selection uses a theme-aware filled background and one-pixel outline.
- Dividers and hover surfaces use theme variables. Date icons remain upright.
- The account footer anchors the sidebar; its menu layers above the search box.
- Long names wrap; record subtitles truncate; counts never shrink.

The sidebar is an operational list, with a flat surface and no decorative
vertical notebook rule. Serif remains available for memory detail content.

## Mobile usability (September 16 revision)

- Keep a labeled place-search entry visible above the map. Opening search focuses
  the input during the tap; failed searches offer a direct manual-pin action.
- The record drawer leaves a 32px backdrop edge (390px maximum width), blocks
  interaction with the map, traps keyboard focus, and closes with Escape, its
  close button, or a backdrop tap. Closed drawers are hidden from navigation.
- The 64px bottom navigation adds the device's bottom safe area. Map controls,
  notices, install prompts, and record sheets account for that space and notches.
- Use 44px minimum touch controls and 16px form inputs on mobile. Keep the map
  pin action labeled, and show an explicit cancel state while placing a pin.
- Record details have a persistent expand/close toolbar and independently
  scrolling content. Expanded details stop below the map toolbar and above the
  navigation. Editing and deletion actions have full touch targets.
- Visit entry uses a full-width bottom dialog with a sticky save/cancel bar.
  Validation and save errors appear inside the dialog, and saving disables
  dismissal. Short landscape screens allow the drawer itself to scroll.

These rules supersede the original mobile dimensions and control sizes below;
the notebook palette, theme/font choices, and desktop split layout remain.

## Overview

**Creative North Star: "The Working Travel Field Notebook"**

The interface feels like a notebook that is actively used on a trip, not a themed scrapbook. Warm paper, ruled divisions, editorial serif headings, compact date marks, and real visit photography give memories a physical home while the map remains the dominant working surface.

The system is calm and information-dense. Vermilion marks location and commitment; olive signals filters and metadata; blue-black ink carries the narrative. It explicitly rejects generic dashboard tiles, glass surfaces, purple gradients, inflated marketing headlines, and decorative AI imagery.

**Key Characteristics:**

- Map-first split workspace on desktop and map-plus-bottom-sheet on mobile.
- Restrained physical cues: rules, paper tones, date stamps, and attached photographs.
- Small-radius rectangular controls; pills only for tags, filters, and people.
- Korean editorial serif for memory titles, clear sans-serif for operation.

## Colors

The palette is warm, muted, and functional, with one decisive vermilion action color.

### Primary

- **Travel Pin Vermilion:** Commits saves, marks pins, and identifies the selected record.
- **Dried Vermilion:** Hover and strong warning state for the primary accent.

### Secondary

- **Field Olive:** Filters, dates, categories, and quiet utility metadata.

### Neutral

- **Notebook Paper:** Main bound-paper surface and page field.
- **Aged Paper:** Footer and recessed notebook regions.
- **Blue-Black Ink:** Primary text, dark controls, and avatars.
- **Soft Ink:** Supporting copy and secondary metadata.
- **Pencil Rule:** Dividers, input strokes, and notebook structure.
- **Fresh Sheet:** Raised records, detail sheets, and input fill.

### Named Rules

**The Functional Ink Rule.** Vermilion locates or commits, olive classifies, and blue-black communicates; do not swap these roles for decoration.

**The Paper Majority Rule.** Warm neutral fields occupy most of every screen so accent colors remain meaningful.

## Typography

**Display Font:** Gowun Batang (with serif fallback)  
**Body Font:** Noto Sans KR (with sans-serif fallback)  
**Label/Mono Font:** Noto Sans KR; record numbers use the system monospace fallback.

**Character:** The serif voice is personal and literary without becoming ornamental. The sans-serif voice keeps search, forms, and metadata brisk and legible.

### Hierarchy

- **Display** (700, 43–72px, 1.12): Authentication and first-use statements only.
- **Headline** (700, 24–25px, 1.25): Notebook section and place names.
- **Title** (700, 17–19px, 1.25): Visit rows and group selection.
- **Body** (400, 15–16px, 1.5–1.7): Notes and explanatory content.
- **Label** (700–800, 11–13px, .04–.12em): Dates, categories, and operational labels.

### Named Rules

**The Memory Voice Rule.** Use the serif face for places, memories, and reflective prose; keep operational text in sans-serif.

## Layout

Desktop uses a fixed 374px notebook index beside a flexible map. The sidebar's 28px inner red rule anchors content at a 44–46px left inset. Mobile switches to a full-viewport map, an off-canvas 92vw record index, a 64px bottom navigation, and a detail sheet above it. Spacing follows a compact 5/8/16/24/32px rhythm, with denser metadata inside record rows.

## Elevation & Depth

The default system is flat and divided by pencil rules. Shadows appear only where a paper object genuinely lifts over the map: search results, visit detail sheets, dialogs, notices, and the notebook edge. They are soft ambient shadows, never hard offset decoration.

### Shadow Vocabulary

- **Notebook Edge** (`9px 0 28px rgba(45, 42, 31, .12)`): Separates the bound index from the map.
- **Raised Paper** (`0 22px 55px rgba(36, 39, 31, .26)`): Visit detail sheet over the map.
- **Modal Paper** (`0 30px 90px rgba(20, 31, 32, .42)`): Focused visit entry dialog.

### Named Rules

**The Physical Cause Rule.** A shadow is allowed only when a paper layer is visibly above another surface.

## Shapes

Controls use restrained 6–9px radii, larger paper panels use 11–12px, and filters or people use full pills. The distinctive pin mark combines a round head with one tightened lower corner. Borders stay one pixel and slightly warm, like pencil or aged rule ink.

## Components

### Buttons

- **Shape:** Compact rectangular controls with gently curved corners (7–9px).
- **Primary:** Vermilion fill, fresh-sheet text, 42–50px touch height, strong sans-serif label.
- **Hover / Focus:** Darken to dried vermilion; use the shared 3px amber focus outline.
- **Secondary / Ghost:** Transparent or fresh-sheet fill with a warm one-pixel stroke.

### Chips

- **Style:** Compact 12px labels; inactive filters are transparent, selected filters use field olive and fresh-sheet text.
- **State:** Full-pill geometry is reserved for filters, tags, and participant selectors.

### Cards / Containers

- **Corner Style:** 9–12px, never a grid of uniformly floating cards.
- **Background:** Fresh sheet over map; notebook paper for structural surfaces.
- **Shadow Strategy:** Only raised paper layers receive ambient depth.
- **Border:** One-pixel warm pencil rule.
- **Internal Padding:** 16–20px for detail content.

### Inputs / Fields

- **Style:** Fresh-sheet fill, warm one-pixel stroke, 7–9px radius, 42px minimum height.
- **Focus:** Vermilion border with a quiet translucent ring.
- **Error / Disabled:** Error copy uses dried vermilion; disabled actions reduce opacity without removing their label.

### Navigation

The desktop notebook index is persistent. Mobile navigation is a flat four-item paper strip; the active destination is vermilion, while list content moves in as a bound sheet from the left.

### Visit Detail Sheet

The signature content object attaches a real visit photo to a fresh paper sheet, followed by a date/category line, serif place name, address, memory, tags, companions, and a small edit action. On mobile it rises from the map edge and must remain dismissible without losing map context.

## Do's and Don'ts

### Do:

- **Do** let the map and member photographs carry visual interest.
- **Do** use rules and paper tone to establish hierarchy before adding a shadow.
- **Do** keep core controls at least 42px tall and preserve visible keyboard focus.
- **Do** label demonstration content explicitly as synthetic.

### Don't:

- **Don't** introduce glassmorphism, purple gradients, oversized marketing copy, or decorative AI illustrations.
- **Don't** turn every piece of information into a rounded floating card.
- **Don't** use vermilion as ambient decoration; reserve it for location, selection, and commitment.
- **Don't** simulate paper with noisy fake grain; the ruled structure is enough.
