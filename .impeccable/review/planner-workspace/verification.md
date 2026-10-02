# Shared record and travel workspace

Validated 2026-10-02.

- Record and travel selectors share WorkspacePicker, including keyboard selection, checked state, themed popup and 48px triggers.
- Travel navigation groups maps, trips and dated itineraries above anchored secondary actions. The main workspace prioritizes the current trip and schedule creation.
- Mobile uses a dismissible, focus-managed navigation drawer; the date and view controls remain visible in the workspace.
- Rendered at widths 320, 390, 1024, 1440 and 1900. No horizontal document overflow; mobile timetable retains over 620px of workspace height in the example state.
- Browser regression suite: 50 passed, 14 device-specific skips. Covers records, map selection, themes/fonts, schedule editing, dragging/resizing, touch scrolling, routes and Excel export.
- TypeScript and lint for changed source/test files passed.
- Production build passed.
- Corrected the offline map fallback stacking so map switches remain usable when external tiles fail.

PNG captures use explicitly labeled example trips and schedules in demo mode. They do not validate live provider tiles or production authentication.
