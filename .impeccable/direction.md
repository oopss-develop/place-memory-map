# Redesign contract — 2026-10-01

User direction: redesign the entire application to follow shadcn design patterns,
font sizes, and component placement. Warmth is unnecessary; prioritize a clean,
organized interface. This supersedes the previous field-notebook visual world.

Mode: Operate. Users record shared places on phones while out and organize records
and travel timetables on larger screens. Neutral light surfaces stay readable in
daylight; a neutral dark theme remains available for low-light use.

World: shadcn/ui New York, Neutral base, Lucide icons, Noto Sans KR by default.
Black primary actions, white content, soft gray navigation, thin gray boundaries.
Small, consistent controls and a 12/14/16/20/24px type scale. Preserve stored font
and color preferences, accessible lists, map interactions, data and permissions.

First viewport: a 340px navigation sidebar groups map selection, record/travel
navigation, search, filters and chronological records above the anchored account
footer. The map fills the remaining space. Mobile places search above the map,
keeps the record drawer and bottom navigation, and reserves 44px touch controls.

Signature interaction: selecting a dated record reveals a compact place sheet
while retaining geographic context; travel planning uses the same controls and
visual tokens in its timetable/map split. Keep existing native-dialog focus and
sticky mobile save/cancel actions.

Scope: main map and record drawer, account/theme/font menus, place details,
visit/map dialogs, travel header/timetable/agenda/dialogs, login, first-map setup,
offline screen, shared UI primitives and design documentation.

Validation: desktop/mobile screenshots, dark menu check, empty and populated
states, existing unit and interaction tests, TypeScript, ESLint and Next build.
Implementation is code-led because the user has already selected the UI language.
No imagery or decorative comp is necessary for this operational redesign.
