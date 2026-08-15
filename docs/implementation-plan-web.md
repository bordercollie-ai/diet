---
title: "Diet Web/PWA implementation plan"
type: implementation-plan
status: active
version: "1.1"
date: 2026-08-12
updated: 2026-08-13
current_phase: W7
---

# Web/PWA implementation plan

Read `docs/prd.md`, `docs/prd-web.md`, and ADR 0002 first. Implement phases in order; domain calculations, validation, backup, and merge logic remain independent of Svelte and browser adapters.

## Global rules

- Svelte + TypeScript + Vite; use `pnpm` in `web/`.
- IndexedDB only: no account, server, cloud sync, or runtime network dependency.
- Deterministic tests cover domain behavior; browser checks cover offline/PWA/accessibility flows.
- Invalid input and failed imports must be visible and must not produce partial writes.
- Keep dependencies limited to the existing Svelte/Vite toolchain.

## Store boundary

```text
load() -> AppData
save(AppData) -> Result
export() -> BackupFile
import(BackupFile) -> ImportPreview | ImportError
```

## Completed phases

| Phase | Date | Outcome | Files / checks |
| --- | --- | --- | --- |
| W0 | 2026-08-12 | Toolchain and in-memory store spike | `web/{package,index,src,tests,public}`; build, check, 3 store tests. |
| W1 | 2026-08-12 | Local domain and IndexedDB persistence | `store.ts`, `indexeddb.ts`, `App.svelte`, store tests; 7 tests. |
| W2 | 2026-08-12 | Food search and daily logging | `store.ts`, `App.svelte`, styles, store tests; 10 tests. |
| W3 | 2026-08-12 | Profiles and targets | PRDs, `store.ts`, `App.svelte`, store tests; 11 tests. |
| W4 | 2026-08-12 | Backup, restore and PWA UX | `store.ts`, `App.svelte`, `sw.js`, store tests; 13 tests. |
| W5 | 2026-08-12 | Accessibility and browser acceptance | UI library/config, `App.svelte`, styles; manual Safari/Chromium review. |
| W6 | 2026-08-13 | UI/UX polish | `App.svelte`, pages and styles; responsive, keyboard, theme and state review. |
| W9 | 2026-08-13 | Componentization | `App.svelte`, `src/pages/`, UI tests; 19 domain and 7 UI tests. |

All completed phases passed `pnpm check`, `pnpm build`, and their listed test suites. Browser automation was intentionally not added; Safari/Chromium coverage was manual.

## W7 — official food import tools

**Status:** in progress (2026-08-13); depends on W6.

### Scope and rules

- Development-time scripts only; no PWA runtime networking.
- Request only official public pages at low frequency; emit reviewable, source-dated local JSON.
- Do not invent translations. Chinese names require a reviewed mapping.

### Progress and handoff

- **Files changed:** `scripts/import_mcdonalds_japan.py`, `scripts/output/`, `web/src/data/mcdonalds_japan.json`, `web/src/data/starbucks_japan.json`, `web/src/domain/store.ts`, domain/UI tests, and `web/package.json`.
- McDonald's Japan importer is in `scripts/import_mcdonalds_japan.py`.
- It produced 202 unique, app-format records in `web/src/data/mcdonalds_japan.json`, also retained as a raw audit file in `scripts/output/`.
- The dataset is bundled as immutable food data and searchable by Japanese and English names. Domain and UI coverage verifies Big Mac lookup/logging and dataset validation.
- Starbucks Japan's nutrition calculator (menu.starbucks.co.jp) is JS/AJAX-driven and blocks automated requests (403), so there is no importer script. `web/src/data/starbucks_japan.json` is hand-curated from the official site's per-drink nutrition tables, pasted and transcribed one size/temperature at a time; each record's `serving` records the size and hot/ice shown on the official page. 16 records cover 4 drinks (Starbucks Latte, Sweet Milk Coffee, Bitter Cream Coffee, Cappuccino) across their published size/temperature combinations.
- `Food` gained an optional `detail` field (salt, fiber, sugar, sodium, potassium, trans fat, saturated fat, caffeine) to carry Starbucks' finer-grained published nutrients without changing the core `Nutrition` totals used elsewhere (targets, daily totals).
- Node-based tests require Node >=23.6 because they load TypeScript and JSON ESM imports directly; this minimum is recorded in `web/package.json`.
- **Checks:** Python fixture parsing; `pnpm check`; `pnpm build`; 20 domain tests; 4 UI tests.
- **Risk:** No reviewed Chinese mappings exist. Product-page markup can change. Starbucks dataset is manually transcribed (no automated re-fetch) and only covers the 4 drinks/sizes provided so far.
- **Next:** supply a reviewed mapping and rerun McDonald's importer; add more Starbucks drinks/sizes as data is provided; consider a separate 7-Eleven importer.

### Exit criteria

The importer emits app-compatible records with reviewed Chinese mappings, without runtime networking or access-control bypasses.

## Out-of-band feature: add a custom food to today's meal from its detail view, with CI test workflow

**Status:** done (2026-08-15).

- **Scope:** clicking a custom food in the Foods tab now opens a "Custom food" detail/edit sheet with an "Add to today's meal" action that records one serving directly at the current time (no quantity/time step) and shows a confirmation toast. Custom foods are now listed most recently updated first.
- **Files changed:** `web/src/domain/store.ts` (added `Food.updatedAt`, stamped by `createFood`/`updateFood`), `web/src/pages/FoodSheet.svelte` (title renamed to "Custom food", added "Add to today's meal"), `web/src/pages/MealSheet.svelte` (fixed a pre-existing bug where creating a food inline during meal search never advanced past the search step because the check ran after the new food already matched the live search), `web/src/pages/FoodsPanel.svelte` (sort by `updatedAt` desc), `web/src/App.svelte` (`addFoodToMeal` records the entry directly via `createMealEntry`, no meal-sheet UI), `web/tests/App.test.ts`, `web/tests/FoodsPanel.test.ts`, `web/tests/store.test.ts`, `web/tests/setup.ts` (stubbed `Element.prototype.animate`, missing in jsdom, needed once a test triggers the toast's fade transition).
- **CI:** `.github/workflows/deploy-pages.yml` now runs a `test` job (`pnpm check`, `pnpm run test`, `pnpm run test:ui`) on push/PR to `web/**` before the existing `deploy` job (gated on `test` passing, PRs only run tests, not deploy).
- **Checks:** `pnpm check`; `pnpm build`; 20 domain tests; 11 UI tests — all pass, exit code 0.
- **Risk:** none known; the inline-food-creation fix also unblocked several previously-broken pre-existing UI tests unrelated to this feature (a stale "Record a meal" vs. "Add a meal" button-name mismatch was also corrected in tests).

## Deferred work

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| W8 | Persisted Chinese/English UI selection and complete message translation. | Both languages retain accessible core flows without changing domain/storage/backup behavior. |
| W10 | Decide between History API, custom drag, or Drawer for sheet dismissal. | Selected gesture works without regressing sheet accessibility. |
| W11 | Fix visible gap between the fixed bottom `<nav>` and Mobile Safari's own bottom toolbar (iPhone, non-installed tab). | No visible blank gap between navbar and Safari chrome across Safari tab and installed/standalone modes, verified on-device. |

### W11 — bottom nav / Safari toolbar gap (unresolved)

**Status:** deferred (2026-08-15); not blocking other phases.

- **Symptom:** on iPhone Safari (regular browser tab, not added to Home Screen), a blank gap appears between the fixed bottom nav (`App.svelte`, `<nav>`) and Safari's own bottom toolbar. Reported and confirmed via on-device screenshots.
- **Attempts tried, in order:**
  1. Made `nav`/`main` `env(safe-area-inset-bottom)` padding conditional on `installed` (`display-mode: standalone`) so it only applies when actually installed. Did not close the gap.
  2. Tightened nav padding/button sizes (`py-2`→`py-0`, `Button size="lg"`→`icon-sm`) to rule out oversized padding. Gap persisted.
  3. Restructured `nav` out of `position: fixed` into a `min-h-[100dvh] flex flex-col` document-flow layout (bottom nav as a normal flex child, no `fixed`). User rejected this approach — reverted.
  4. Reverted to `position: fixed; bottom: 0` on `nav` with unconditional `padding-bottom: env(safe-area-inset-bottom, 0px)` (the generally-recommended pattern), and `main` given matching `pb-[calc(4rem+env(safe-area-inset-bottom))]` clearance. This is the current state in `App.svelte`. Gap still not confirmed fixed by the user.
- **Current code state:** `App.svelte` `<nav>` is `fixed inset-x-0 bottom-0` with `pb-[env(safe-area-inset-bottom,0px)]`; `<main>` has `pb-[calc(4rem+env(safe-area-inset-bottom))]`. `installed` (`$state`, driven by `matchMedia('(display-mode: standalone)')` and the `appinstalled` event) is still used elsewhere (theme/install-prompt logic around line 401) — do not remove it.
- **Suspected cause (unconfirmed):** likely Mobile Safari's known fixed-positioning-vs-toolbar viewport quirk (fixed elements can anchor to the largest/layout viewport rather than the visual viewport while the collapsible toolbar is shown), possibly combined with how `safe-area-inset-bottom` is reported differently depending on whether Safari's own chrome is visible.
- **Next steps for whoever picks this up:** reproduce on-device (regular Safari tab, not standalone), inspect actual computed `env(safe-area-inset-bottom)` and nav bounding box vs. visual viewport (e.g. via Safari Web Inspector over USB, or `window.visualViewport`), before trying further CSS changes. Consider `100dvh`/`interactive-widget` viewport meta options or a `window.visualViewport` resize listener as alternatives if plain CSS can't solve it.

## Handoff protocol

Before a phase, mark it in progress and read its section. On completion, record date, changed files, commands/results, risks or decisions, and the next ready phase. Do not start a phase until its dependencies are done.
