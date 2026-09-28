# Timetable verification — 2026-09-28

- TypeScript: passed.
- ESLint: no errors; pre-existing image/pulse-overlay warnings remain.
- Vitest: 33 tests passed, including local-clock layout, API validation/errors, and failed/conflicting save behavior.
- Playwright: 46 passed, 14 device-specific skips across the full suite. New coverage includes desktop brushing/move/resize, mobile long press versus scrolling, search/manual fallback, source-record preservation, reload persistence, overnight blocks, compact entries, grouped coordinates and keyboard selection.
- Production Next.js build: passed. The first sandboxed attempt could not download the existing Google fonts; the same build succeeded with network access.
- SQL: all migrations applied in order on temporary PGlite PostgreSQL. The checked-in `supabase/tests/timetables.sql` ran with equivalent assertion functions (PGlite does not bundle pgTAP), passing 35 assertions. Auth/storage schemas were local test shims. These validate real PostgreSQL constraints, RLS, RPC permissions, version conflicts, local timestamps and atomic rollback; they do not establish live Supabase/PostgREST deployment or simultaneous multi-connection locking behavior.
- Native `supabase test db`: not run here; the Supabase CLI/local Docker daemon is unavailable. The pgTAP file is ready for the normal Supabase test environment.
- Live Kakao/OSM provider rendering and production deployment were not performed. UI tests use the demo map and stubbed place-search responses.
- Visual review: default-theme desktop/mobile evidence in this directory. The finish reviewer requested compact 15-minute blocks, then scored that fix resolved with disposition **ship** for its review scope. No new raster assets ship in the app.
- Existing unrelated modifications in `.env.example`, `.gitignore`, and `tests/e2e/app.spec.ts` were retained. Existing `.gitignore` whitespace warnings were not changed.
