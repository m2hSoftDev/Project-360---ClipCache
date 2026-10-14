# ClipCache — Project Context

## What we are building
ClipCache is a Chrome Extension (Manifest V3) that captures screenshots
(visible tab, window, full page, area), auto-saves them into IndexedDB,
and lets users view, edit, compare and export them from a Side Panel.

Free users: local storage only, max 20 screenshots.
Paid users: login/register, cloud sync to Supabase, higher limit.

This is a BSc CSE final-year project. Code must be clean, commented
where non-obvious, and easy to explain in a viva.

## Tech stack (do not change without asking)
- Chrome Extension, Manifest V3
- React 18 + TypeScript (strict mode)
- Vite + @crxjs/vite-plugin
- Tailwind CSS
- Zustand for state
- Dexie.js for IndexedDB (screenshot blobs and settings)
- Fabric.js for image editing
- Supabase (Auth, Postgres, Storage, Edge Functions) for paid users
- Stripe (test mode) for payments
- Vitest + React Testing Library; Playwright for E2E

## Architecture rules
1. The service worker holds NO state in memory. Always read/write IndexedDB.
2. Canvas and image stitching run in the Offscreen Document, not the service worker.
3. Side Panel and service worker communicate through typed messages defined in src/shared/messages.ts.
4. Content scripts only handle page-side UI (area selection overlay) and page info.
5. Never store the Supabase service_role key in the extension. Use the anon key only, with RLS enabled on every table.
6. Free-plan limit (20 screenshots) is checked in src/background/limits.ts and again in the Supabase Edge Function for paid sync.
7. Use IndexedDB for images, not chrome.storage.local.
8. chrome:// pages and Chrome Web Store pages cannot be captured. Show a clear message instead of failing silently.

## Folder layout
src/background/   service worker (index.ts, capture.ts, limits.ts)
src/content/      content scripts (areaSelect.ts)
src/offscreen/    canvas work (offscreen.html, stitch.ts)
src/sidepanel/    React app (pages/, components/, store/, lib/)
src/shared/       types.ts, messages.ts, logger.ts
supabase/         migrations/, functions/
tests/

## Data model
Dexie table `screenshots`: id (auto), createdAt, sourceUrl, pageTitle,
mode ('visible'|'window'|'full'|'area'), originalBlob, editedBlob|null,
editState (Fabric JSON)|null, width, height, isEdited.

Dexie table `settings`: key, value (theme, shortcuts).

Supabase: profiles(id, plan), screenshots(id, user_id, storage_path,
edited_path, source_url, mode, created_at). RLS: user_id = auth.uid().
Storage bucket `screenshots` (private), path `{user_id}/{id}.png`.

## Coding standards
- TypeScript strict; no `any` unless justified in a comment.
- Functional React components with hooks.
- One responsibility per file; keep files under about 250 lines.
- Name files in camelCase for logic, PascalCase for components.
- Every async storage call wrapped in try/catch with a user-visible error.
- No console.log in committed code; use a small logger in src/shared/logger.ts.
- Write unit tests for: limits.ts, Dexie helpers, stitch logic.

## Phase order
1 Setup → 2 Capture → 3 Full-page → 4 Gallery → 5-6 Editor →
7 Compare & export → 8 Supabase backend → 9 Paid features →
10 Testing → 11 Docs.
Do not start a phase until the previous phase works end to end.

## Definition of done (every feature)
- Works in Chrome (latest stable)
- No TypeScript errors, lint passes
- Unit test added for logic-heavy code
- Manual test steps written in docs/testing.md
