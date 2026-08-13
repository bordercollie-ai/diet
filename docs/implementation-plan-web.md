---
title: "Diet Web/PWA implementation plan"
type: implementation-plan
status: planned
version: "1.0"
date: 2026-08-12
current_phase: W6
---

# Web/PWA implementation plan

This is the executable specification for the Web/PWA track. Read `docs/prd-web.md`, `docs/prd.md`, and ADR 0002 first. Do not mix this plan with the native SwiftUI plan or its failed device/signing trials.

## Global rules

- **Architecture:** minimal Svelte + TypeScript + Vite 7.
- **Storage:** IndexedDB only; no account, server, cloud sync, or network runtime dependency.
- **Domain:** calculations, validation, backup, and merge logic stay independent from Svelte and browser adapters.
- **Testing:** deterministic tests cover domain behavior; browser checks cover PWA, accessibility, and acceptance flows.
- **Errors:** invalid input and failed imports are visible and never silently produce success-shaped data.
- **Dependencies:** use pnpm and avoid dependencies beyond the Svelte/Vite toolchain.

## Public interface

Keep the application-facing local store boundary small:

```text
load() -> AppData
save(AppData) -> Result
export() -> BackupFile
import(BackupFile) -> ImportPreview | ImportError
```

The domain module owns nutrition totals, target estimation, backup validation, and merge semantics. Browser adapters own IndexedDB, file selection/download, and installation capability detection.

## Web Phase W0 — toolchain and architecture spike

**Status:** done (2026-08-12; Svelte + TypeScript + Vite 7)

### TDD slices

1. A fresh application state can be loaded and saved through the public store interface.
2. A valid backup can be exported and imported without changing supported data.
3. Malformed or unsupported backup data returns an error and leaves existing data unchanged.

### Exit criteria

The Web toolchain is recorded, deterministic store tests pass, the app shell builds, and the manifest/Service Worker endpoints are available from a local preview.

### Handoff

- **Files changed:** `web/package.json`, `web/pnpm-lock.yaml`, `web/index.html`, `web/jsconfig.json`, `web/src/App.svelte`, `web/src/app.css`, `web/src/main.ts`, `web/src/domain/store.ts`, `web/tests/store.test.ts`, `web/public/manifest.webmanifest`, `web/public/sw.js`; removed generated starter assets.
- **Checks:** `cd web && pnpm test` passed 3 tests; `pnpm exec svelte-check --tsgo --tsconfig ./jsconfig.json` passed with 0 errors and 0 warnings; `pnpm build` passed with Vite 7.3.6; local preview returned valid app shell, manifest, and Service Worker responses.
- **Unresolved risks:** IndexedDB is not implemented; W0 uses an in-memory adapter. Browser installation UX and offline cache behavior need browser acceptance coverage.
- **Next ready phase:** W1 — local domain and persistence.

## Web Phase W1 — local domain and persistence

**Status:** done (2026-08-12)

### Handoff

- **Files changed:** `web/package.json`, `web/src/App.svelte`, `web/src/domain/store.ts`, `web/src/storage/indexeddb.ts`, `web/tests/store.test.ts`.
- **Checks:** `cd web && pnpm test` passed 7 tests; `pnpm check` passed with 0 errors and 0 warnings; `pnpm build` passed with Vite 7.3.6; `git diff --check` passed.
- **Unresolved risks:** IndexedDB behavior still needs Safari/Chromium browser acceptance coverage; no browser automation dependency was added.
- **Next ready phase:** W2 — food search and daily logging.

### TDD slices

- stable IDs and reload persistence
- bundled foods are read-only; user foods are editable/deletable
- meal snapshots survive later food edits
- invalid food, quantity, and nutrition inputs are rejected
- meal records use a default current time instead of meal categories

### Exit criteria

The app launches offline, persists domain data through IndexedDB, and passes deterministic domain/persistence tests.

## Web Phase W2 — food search and daily logging

**Status:** done (2026-08-12); depends on W1

### Handoff

- **Files changed:** `web/src/domain/store.ts`, `web/src/App.svelte`, `web/src/app.css`, `web/tests/store.test.ts`.
- **Checks:** `cd web && pnpm test` passed 10 tests; `pnpm check` passed with 0 errors and 0 warnings; `pnpm build` passed with Vite 7.3.6; `git diff --check` passed.
- **Unresolved risks:** Safari/Chromium browser acceptance of the interactive flow remains for W5; no browser automation dependency was added.
- **Next ready phase:** W3 — profile and targets.

### TDD slices

- search localized food names
- create, edit, delete, and reload a user food
- record, edit, delete, and reload meals with a default current time
- calculate scaled daily calories and macros while excluding other dates

### Exit criteria

Offline users can complete the core food and meal logging flow and see correct totals after reload.

## Web Phase W3 — profile and targets

**Status:** done (2026-08-12); depends on W2

### Handoff

- **Files changed:** `docs/prd.md`, `docs/prd-web.md`, `web/src/domain/store.ts`, `web/src/App.svelte`, `web/tests/store.test.ts`.
- **Checks:** `cd web && pnpm test` passed 11 tests; `pnpm check` passed with 0 errors and 0 warnings; `pnpm build` passed with Vite 7.3.6; `git diff --check` passed.
- **Unresolved risks:** Safari/Chromium browser acceptance of profile and targets remains for W5.
- **Decision:** target calculation includes target weight and target date; daily calories use the exact requested rate without a deficit/surplus cap. Meal planning is out of scope.
- **Next ready phase:** W4 — backup, restore, and PWA UX.

### TDD slices

- deterministic target estimation and invalid-profile rejection
- target weight/date validation and exact daily calorie adjustment
- per-field manual target overrides and restoration of estimates
Target calories use Mifflin–St Jeor maintenance calories plus `(targetWeight - currentWeight) * 7700 / daysUntilTarget`; the requested adjustment is not capped. Activity includes a BMR-only option for users who want no activity multiplier. Protein uses target weight and the remaining macro targets are derived from calories.

### Exit criteria

Users can enter a profile, review/override targets, and view progress.

## Web Phase W4 — backup, restore, and PWA UX

**Status:** done (2026-08-12); depends on W1 and W2

### Handoff

- **Files changed:** `web/src/domain/store.ts`, `web/src/App.svelte`, `web/tests/store.test.ts`, `web/public/sw.js`.
- **Checks:** `cd web && pnpm test` passed 13 tests; `pnpm check` passed with 0 errors and 0 warnings; `pnpm build` passed with Vite 7.3.6; `git diff --check` passed.
- **Unresolved risks:** Safari/Chromium browser acceptance of backup restore, installation UX, and offline reload remains for W5; browser-specific install prompts remain capability-dependent.
- **Decision:** imports validate and preview before committing, then merge foods and meals by ID, replacing matching records while preserving unrelated local records.
- **Next ready phase:** W5 — accessibility and browser acceptance.

### TDD slices

- export/import preview and version validation
- ID-based merge with replacement and preservation of unrelated records
- failed import leaves the existing store unchanged
- file selection/download errors are visible
- install prompt/detection is available where supported and the app remains usable where unavailable

### Exit criteria

Versioned JSON backup/restore and required PWA installation experience work offline without data loss.

## Web Phase W5 — accessibility and browser acceptance

**Status:** done (2026-08-12); depends on W3 and W4

### Handoff

- **Files changed:** `web/components.json`, `web/jsconfig.json`, `web/package.json`, `web/pnpm-lock.yaml`, `web/src/App.svelte`, `web/src/app.css`, `web/src/lib/`, `web/tsconfig.json`, `web/vite.config.js`.
- **Checks:** `cd web && pnpm test` passed 13 tests; `pnpm check` passed with 0 errors and 0 warnings; `pnpm build` passed with Vite 7.3.6; production preview returned 200 for `/`, `/manifest.webmanifest`, and `/sw.js`; `git diff --check` passed.
- **Unresolved risks:** No automated Safari/Chromium harness was added; browser acceptance was manually confirmed during this session.
- **Decision:** shadcn-svelte Rhea theme is installed and used for cards, buttons, inputs, and the mature Popover + Command food combobox. Dark mode is a persisted light/dark menu toggle.
- **Next ready phase:** none; Web MVP acceptance is complete.

### Checks

- shadcn-svelte
- keyboard-only core flow
- semantic labels and basic screen-reader path
- dynamic text and dark mode
- polished food typeahead search with clear results, keyboard navigation, and empty/error states
- Safari and one Chromium browser: build, offline launch, add/edit/delete meal, backup restore

### Exit criteria

All Web PRD acceptance criteria pass; native HealthKit and notification work remain out of scope.

## Web Phase W6 — UI/UX polish

**Status:** in progress (2026-08-12); depends on W5

### Scope

- establish clear page hierarchy for summary, meal logging, foods, profile, and backup
- make the primary daily logging flow fast and visually dominant
- improve responsive layout, spacing, typography, and form grouping
- refine food combobox states: initial, searching, selected, empty, and invalid
- improve backup/install feedback and destructive-action affordances
- keep light/dark mode, keyboard navigation, and semantic labels intact

### Current slice

- **Done (2026-08-12):** Summary page hierarchy, compact phone tabs and macro totals, and tappable daily meal cards with a contained actions dialog.
- **Done (2026-08-12):** Replaced the Log meal tab with a bottom-right floating action button that opens the existing meal form in a full-screen dialog; meal-card editing uses the same dialog.
- **Done (2026-08-12):** Replaced the sheet food combobox with a search input and button; unmatched names now reveal nutrition fields and create the food and meal together.
- **Done (2026-08-13):** Added temporary calorie entries from the meal form; they are saved as meal snapshots without entering the food library.
- **Next:** Refine backup/install feedback.

### Checks

- deterministic domain tests remain green
- type-check and production build remain green
- manual responsive, keyboard, light/dark, and empty/error-state review

### Exit criteria

The core flows have a coherent, responsive visual hierarchy and remain usable with keyboard navigation, dark mode, dynamic text, and visible error states.

## Web Phase W7 — bilingual UI and content completeness

**Status:** deferred; depends on W6

### Scope

- add explicit English/Chinese UI language selection and persistence
- translate validation, backup, install, empty, and status messages
- verify localized food search and selected-food labels in both languages
- keep food data’s existing English/Japanese/Chinese names intact

### Tests and checks

- deterministic language/message coverage for user-visible states
- keyboard and screen-reader labels remain meaningful in both languages
- Safari and Chromium smoke check after language switching

### Exit criteria

The Web PRD’s bilingual interface requirement is met without changing domain calculations, storage, backup format, or offline behavior.

## Handoff protocol

Before starting a phase, mark it `in progress` and read its complete section. After finishing, record status/date, files changed, tests/checks and results, unresolved risks or decisions, and the next ready Web phase.
