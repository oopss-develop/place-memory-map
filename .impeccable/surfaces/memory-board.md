# Shared memory board
Primary target: src/components/memory-board.tsx
Mode: Operate with a material canvas for remembering shared visits.

## Confirmed direction
The user chose a bright pegboard with masking tape. Preserve the existing Korean journal navigation and neutral controls. The board extends the journal, rather than replacing the app's design system. Use existing fonts; paper captions use a clear readable sans-serif face. Board-only palette: pegboard #f3ecdf, holes #aea18e, tape #d3b777, paper #fffdf7, notes #fff0ae / #f7d9d1 / #dce6d1 / #d9e7f0. Code-led implementation using actual WebGL geometry.

## First viewport
A compact header with map selection and explicit shared save, photo/note tools, zoom, and a large light pegboard. The photo tray is opened on demand. Selected-item properties sit on the right on desktop and below the canvas on mobile. Empty board offers the first photo or note. Existing visit photos remain the source of truth and are not copied or deleted by board edits.

## Signature interaction
Paper is anchored at the top; its free edge lifts toward the pointer and settles through a damped spring. Notes share the paper treatment. One React Three Fiber canvas with unscaled DOM measurements renders all paper and their attachments in the same item order; textures are capped at 512px on either edge; Moveable owns positioning, resizing and rotation of DOM targets. Touch release triggers a brief lift. Reduced motion keeps paper flat. Graphics failure retains ordinary photos and all editing.

## Persistence and access
One board per private group; members edit and save. The server enforces membership, source-photo ownership, limits and optimistic versions. Failed saves keep edits and their retry ID. Local drafts are user/group isolated and expire in seven days. Explicit conflict reload keeps the local arrangement in undo history. Board data is included in workspace backups; old backups remain valid.

## Acceptance
Photos and notes can be freely moved, rotated, resized, layered and removed. Removing board items leaves source records intact. Numeric controls and keyboard movement remain usable on mobile and with WebGL unavailable. Desktop and mobile screenshots, pointer gesture tests, hover/reduced-motion render checks, conflict/retry unit checks and embedded PostgreSQL permission/backup tests supply evidence.
