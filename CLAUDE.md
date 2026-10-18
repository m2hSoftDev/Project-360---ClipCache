# ClipCache — Project Context

## What we are building
ClipCache is a Chrome Extension (Manifest V3, version 0.1.0) that captures
screenshots, auto-saves them to IndexedDB, and lets users view, crop, edit,
compare and export them from a Side Panel.

- Open the Side Panel with the toolbar icon.
- Capture with the shortcut Alt+Shift+S (visible tab, no picker).
- Captures are stored locally. Each capture auto-saves with no manual step.

Free users: local only, max 20 screenshots.
Paid users (later phase): login, cloud sync to Supabase, higher limit.

This is a BSc CSE final-year project. Code must be clean, commented where
non-obvious, and easy to explain in a viva.

## Current status
- Phase 1 (setup, side panel opens from toolbar): DONE.
- Phase 2 (capture, auto-save, crop, recent tray): DONE.
- Phase 3 (gallery, full-size preview, limit, cascade delete): DONE.
- Phase 4 (editor with Crop, Blur, Draw, Text, Arrow, Undo, Redo, Reset, Save, Back, plus composite export, arrow tip alignment, undo/redo shortcuts, and delete key fixes): DONE.
- Shortcuts: the only capture shortcut is the Chrome command "capture-visible-v2", default Alt+Shift+S, changed only at chrome://extensions/shortcuts.
- Phase 5 (compare view with before/after slider, PNG/JPG download to local disk with JPG white background, and PNG clipboard copy): DONE.
- Phase 6 onward: not started.

## Tech stack (do not change without asking)
- Chrome Extension, Manifest V3
- React 18 + TypeScript (strict mode)
- Vite + @crxjs/vite-plugin
- Tailwind CSS
- Zustand (state)
- Dexie.js (IndexedDB) for screenshots and settings
- dexie-react-hooks (useLiveQuery) for reactive lists
- Fabric.js (editor, Phase 4–5)
- Supabase and Stripe (paid features, later phase only)
- Vitest + React Testing Library; Playwright for E2E

Do NOT use:
- getDisplayMedia (the browser picker must never appear for the shortcut)
- localStorage or chrome.storage.local for images
- A web app router or service worker logic outside the extension

## Capture rules
1. Shortcut Alt+Shift+S runs chrome.tabs.captureVisibleTab from the service
   worker. No picker, no user prompt.
2. Default shortcut is Alt+Shift+S, set in manifest "commands" and changeable
   at chrome://extensions/shortcuts.
3. Full-page capture uses chrome.debugger (Page.captureScreenshot with
   captureBeyondViewport). Detach the debugger in a finally block.
4. Window capture captures the active tab in the current window.
5. Area capture: after a capture, the user drags a rectangle in the Side
   Panel. Crop is done on a canvas and saved as a NEW record. The original is
   never changed.
6. chrome://, edge://, and Chrome Web Store pages cannot be captured. Show a
   clear message instead of failing silently.
7. Every capture auto-saves to Dexie before the UI shows "Captured".

## Architecture rules
1. The service worker holds NO state in memory. Read and write Dexie.
2. Canvas work (crop, stitch, export) runs in an offscreen document if
   needed, not in the service worker.
3. Side Panel and service worker talk through typed messages defined in
   src/shared/messages.ts.
4. Content scripts only handle page-side UI (area selection overlay) and
   page info.
5. Never store the Supabase service_role key in the extension. Use only the
   anon key, with RLS on every table.
6. The free limit (20) is checked in src/background/limits.ts before a save.
   Count all rows in the screenshots table.

## Side Panel layout rules
1. Design for widths from 320 px to 500 px. Test at 360 px.
2. Images use max-width: 100%, height: auto, and are centered inside a
   scrollable container. A full image must always be visible.
3. Use ResizeObserver to read the displayed image size.
4. Crop coordinates: convert displayed pixels to natural pixels using
   naturalWidth / displayedWidth (and the same for height) before cropping.
5. Thumbnail grids use CSS grid with minmax(140px, 1fr). Labels sit in a bar
   below the thumbnail, never on top of the image.
6. Object URLs: create with URL.createObjectURL and call URL.revokeObjectURL
   when the component unmounts.

## Data model
Dexie database name: ClipCacheDB

Table `screenshots`, schema '++id, createdAt, mode, isEdited, parentId':
- id (auto)
- createdAt (number, Date.now())
- sourceUrl (string, may be empty)
- pageTitle (string, may be empty)
- mode: exactly one of 'visible' | 'window' | 'full' | 'area'
- originalBlob (Blob)
- editedBlob (Blob | null)
- editState (object | null, Fabric JSON in Phase 4+)
- width, height (number, natural pixels)
- isEdited (boolean)
- parentId (number | null): for crops, the id of the original capture

Table `settings`, key 'key':
- key (string), value (any). Example keys: 'shortcuts', 'theme'.

Do not add other mode values. Do not use 'screen', 'tab', 'paste', or
'upload'.

Supabase (later phase):
profiles(id, plan, created_at)
screenshots(id, user_id, storage_path, edited_path, source_url, mode,
width, height, created_at). RLS: user_id = auth.uid().
Storage bucket 'screenshots' (private), path {user_id}/{id}.png.

## Folder layout
src/background/   service worker (index.ts, capture.ts, limits.ts)
src/content/      content scripts (areaSelect.ts, later)
src/offscreen/    canvas work (only if needed)
src/sidepanel/    React app (pages/, components/, store/, lib/)
src/shared/       types.ts, messages.ts, logger.ts
supabase/         migrations/, functions/ (later phase)
tests/            unit tests (Vitest)
docs/             testing.md, architecture.md

## Coding standards
- TypeScript strict; no `any` unless justified in a comment.
- Functional components with hooks; one responsibility per file; keep files
  under about 250 lines.
- Files: camelCase for logic, PascalCase for components.
- Every async storage call wrapped in try/catch with a user-visible error.
- No console.log; use src/shared/logger.ts.
- Unit tests required for: limits, Dexie helpers, crop math, mode validation.

## Testing rules
- Every bug fix gets a regression test where possible.
- Update docs/testing.md with manual steps for every feature.
- Manual test on a real Chrome profile after each phase.

## Phase order (do not reorder)
1 Setup → 2 Capture → 3 Gallery + full-size preview + limit →
4 Editor → 5 Compare and export → 6 Supabase → 7 Auth and sync →
8 Stripe → 9 Testing and docs.
Do not start a phase until the previous one works end to end.

## REQUIRED FEATURE: Editing tools (Phase 4, never skip)
The full-size preview (Phase 3) must show editing tools. Phase 3 builds the
preview with the toolbar visible but disabled, labeled "Coming in Phase 4".
Phase 4 enables and builds these tools in the same preview page:

Crop, Blur, Draw, Text, Arrow, Undo, Redo, Reset, Save, Back.

The editor is a core requirement of ClipCache. A preview without editing
tools is incomplete. Do not mark Phase 3 done unless the disabled toolbar is
present.

## Definition of done
- Works in latest Chrome, at 360 px side panel width
- No TypeScript or lint errors
- Unit tests pass
- Manual test steps in docs/testing.md
- Agent explains the change in plain language