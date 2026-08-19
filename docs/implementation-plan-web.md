---
title: "Diet Web/PWA implementation plan"
type: implementation-plan
status: active
version: "1.1"
date: 2026-08-12
updated: 2026-08-18
current_phase: W7
---

# Web/PWA implementation plan

Read `docs/prd.md` and ADR 0002 first. Implement phases in order; domain calculations, validation, backup, and merge logic remain independent of Svelte and browser adapters.

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
| W4 | 2026-08-14 | Backup, restore and PWA UX | `store.ts`, `App.svelte`, `sw.js`, store tests; ID-based merge domain and UI restore coverage. |
| W5 | 2026-08-12 | Accessibility and browser acceptance | UI library/config, `App.svelte`, styles; manual Safari/Chromium review. |
| W6 | 2026-08-13 | UI/UX polish | `App.svelte`, pages and styles; responsive, keyboard, theme and state review. |
| W9 | 2026-08-13 | Componentization | `App.svelte`, `src/pages/`, UI tests; 19 domain and 8 UI tests. |
| W12 | 2026-08-18 | Trophy system | `store.ts`, `indexeddb.ts`, `App.svelte`, `i18n.svelte.ts`, `TrophyPanel.svelte`, `custom.css`, domain/UI tests; newly acquired badges use a one-time CSS Y-axis flip; `pnpm check`, `pnpm build`, `pnpm test`, `pnpm run test:ui`. |

All completed phases passed `pnpm check`, `pnpm build`, and their listed test suites. Browser automation was intentionally not added; Safari/Chromium coverage was manual.

## W7 — official food import tools

**Status:** in progress (2026-08-13); depends on W6.

### Scope and rules

- Development-time scripts only; no PWA runtime networking.
- Request only official public pages at low frequency; emit reviewable, source-dated local JSON.
- Do not invent translations. Chinese names require a reviewed mapping.

### Progress and handoff

- **Files changed:** `scripts/import_mcdonalds_japan.py`, `scripts/import_seven_eleven_kanto_sandwiches.py`, `scripts/output/`, `web/src/data/convenience_store_japan.json`, `web/src/data/mcdonalds_japan.json`, `web/src/data/starbucks_japan.json`, `web/src/domain/store.ts`, domain/UI tests, and `web/package.json`.
- McDonald's Japan importer is in `scripts/import_mcdonalds_japan.py`.
- It produced 202 unique, app-format records in `web/src/data/mcdonalds_japan.json`, also retained as a raw audit file in `scripts/output/`.
- The dataset is bundled as immutable food data and searchable by Japanese and English names. Domain and UI coverage verifies Big Mac lookup/logging and dataset validation.
- Starbucks Japan's nutrition calculator (menu.starbucks.co.jp) is JS/AJAX-driven and blocks automated requests (403), so there is no importer script. `web/src/data/starbucks_japan.json` is hand-curated from the official site's per-drink nutrition tables, pasted and transcribed one size/temperature at a time; each record's `serving` records the size and hot/ice shown on the official page. 16 records cover 4 drinks (Starbucks Latte, Sweet Milk Coffee, Bitter Cream Coffee, Cappuccino) across their published size/temperature combinations.
- `Food` gained an optional `detail` field (salt, fiber, sugar, sodium, potassium, trans fat, saturated fat, caffeine) to carry Starbucks' finer-grained published nutrients without changing the core `Nutrition` totals used elsewhere (targets, daily totals).
- Node-based tests require Node >=23.6 because they load TypeScript and JSON ESM imports directly; this minimum is recorded in `web/package.json`.
- Lotte Japan importer (`scripts/import_lotte_japan.py`) scrapes the official ice-cream catalogue into `web/src/data/lotte_japan.json` (147 records) and a raw audit file in `scripts/output/`. Per the no-invent-translations rule, it records only the Japanese name, since Lotte does not publish official English names for its products.
- 36 `lotte_japan.json` records gained a `name.en` field, limited to Lotte's own official English/romanized brand names (Coolish, Lady Borden, Ghana, Zero, Calpis) plus their katakana loanword flavor terms (Vanilla, Chocolate, Strawberry, Green Tea, Matcha, etc.). Records whose name requires translating native Japanese words (e.g. 梨, ぶどう, 巨峰, 白桃, 芳醇, 深みカカオ, 焙煎, 紅茶, 業務用) were left Japanese-only to avoid inventing translations.
- **2026-08-17 — 7-Eleven Tokyo/Kanagawa sandwiches and rolls:** `scripts/import_seven_eleven_kanto_sandwiches.py` reads the requested official Kanto sandwich-and-roll catalog, requests its listed product pages at a minimum one-second interval, and emits source-dated raw audit data. It retained 17 products currently sold in Tokyo or Kanagawa, including nationwide items such as burritos; regional SKUs with normalized equivalent names are deduplicated. The reviewed records are included directly in `web/src/data/convenience_store_japan.json`, prefixed with `711 ` for clear store identification, and domain coverage verifies valid records, unique IDs/names, and Japanese/brand search. **Checks:** both Python importer fixture suites pass; `pnpm check` and `pnpm build` pass; the 25-test domain suite passes under Node 26.7.0 (the configured minimum is Node 23.6). `pnpm run test:ui` remains blocked by 15 pre-existing `App.test.ts` failures (`ReferenceError: renderedStore is not defined` in its mocked `createIndexedDBStore`), reproduced with Node 22 and Node 24; its other 10 tests pass. **Risk:** the official category and product markup, current regional availability, and nutrition values can change; refresh via the importer and review its raw audit file.
- **2026-08-19 — 7-Eleven chicken and chili roll:** Added official product `053705` (たんぱく質が摂れるチキン＆チリ) directly to `web/src/data/convenience_store_japan.json`, with the published core macros and sugar, fiber, and salt. `web/tests/store.test.ts` verifies the source record and Japanese lookup. **Checks:** `cd web && pnpm test` (35 passed). **Next ready phase:** W10; W7 remains in progress pending reviewed Chinese mappings.
- **2026-08-19 — single 7-Eleven item importer:** `scripts/add_seven_eleven_item.py URL` adds one product from an official `sej.co.jp/products/a/item/` URL to the bundled convenience-store data. It rejects non-official URLs and duplicate item IDs without writing partial data, and normalizes full-width Latin letters, numbers, and spaces in Japanese names. Its fetch tests mock `curl`; they make no network requests. **Checks:** `python3 scripts/test_add_seven_eleven_item.py` (5 passed); `python3 scripts/test_import_seven_eleven_kanto_sandwiches.py` (3 passed); `cd web && pnpm test` (35 passed). **Next ready phase:** W10; W7 remains in progress pending reviewed Chinese mappings.
- **2026-08-19 — 7-Eleven import action:** `.github/workflows/add-seven-eleven-food.yml` manually accepts an official product URL, runs the importer, and opens a pull request to `main` containing only the bundled food-data change. **Next ready phase:** W10; W7 remains in progress pending reviewed Chinese mappings.
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

## Out-of-band feature: Calendar page + real menu page on the 4th nav tab, consistent iOS-style back buttons

**Status:** done (2026-08-16).

- **Scope:** the 4th bottom-nav tab (`MenuIcon`) opens a dedicated `MenuPanel` list page (iOS Settings-style rows) with "Calendar" and "Export" (the prior Backup panel, unchanged). Selecting an item navigates to that page. `CalendarPanel.svelte` shows a month grid, each day tinted by that day's calorie status (same tone logic as the Summary 7-day strip); tapping a day jumps to Summary for that date. All pages reached through this feature (Calendar, Export/Backup, and Summary-when-arrived-from-Calendar) now show a shared top-left `BackButton` (chevron + previous page's name, iOS convention) instead of the earlier ad hoc bottom-of-card link/popover.
- **Files changed:** `web/src/domain/store.ts` (extracted the tone-from-calories branch shared by the Summary strip and the calendar into `calorieTone()`), `web/src/App.svelte` (tab type gained `'menu' | 'calendar'`, 4th nav tab now opens the `menu` page directly (no popover), `returnToCalendar` state + `BackButton` on Summary, `BackButton` on Calendar/Backup pages returning to Menu), `web/src/pages/MenuPanel.svelte` (new), `web/src/pages/CalendarPanel.svelte` (new), `web/src/pages/BackButton.svelte` (new, shared), `web/src/pages/BackupPanel.svelte` (`aria-labelledby` now points at its own heading instead of a nav tab id that no longer exists), `web/tests/App.test.ts` (menu→calendar→day→back→menu coverage).
- **Checks:** `pnpm check` (0 errors, 1 pre-existing informational warning: `CalendarPanel` intentionally captures `today`'s initial value once so the calendar opens on the current month); `pnpm build`; `pnpm test` (22 domain tests); `pnpm run test:ui` (12 UI tests) — all pass. Dropped the `Popover`/`bits-ui` UI import from the bundle (unused now), JS bundle shrank ~55KB.
- **Risk:** none known. Export/Backup behavior is unchanged, only reachable via the new Menu page. The iOS-style back button was applied only to the pages this feature touches (Menu, Calendar, Backup, Summary-from-Calendar), per instruction — other pages (Foods, Profile, meal/food sheets) are untouched.

## Out-of-band feature: effective-date target ranges

**Status:** done (2026-08-18).

- **Scope:** saving a profile or manual target creates a target snapshot effective today. Historical dates keep their existing calorie target and status; summaries, the calendar, and achievement streaks resolve the snapshot for the date being evaluated.
- **Design:** persist only the calculated `Nutrition` target and effective date, rather than daily copies. Existing saved profiles receive one baseline snapshot so their prior status remains stable after migration.
- **Files changed:** `web/src/domain/store.ts`, `web/src/App.svelte`, `web/src/pages/CalendarPanel.svelte`, `web/tests/store.test.ts`, and `docs/prd.md`.
- **Checks:** `pnpm test` (33 domain tests), `pnpm check` (0 errors/warnings), `pnpm build`, and `pnpm run test:ui` (28 UI tests) pass. The UI runner emits pre-existing Svelte `derived_inert` stderr warnings, but all tests pass.
- **Decision / risk:** a same-day profile save replaces that day's snapshot; a new save affects today and future dates only. The existing UTC ISO date convention remains the definition of “today.”
- **Next ready phase:** W7 official food import tools remains in progress.
- **Skipped:** persisting the selected calendar month across reloads, a dedicated calendar route/URL, and multi-level back history beyond the single "came from calendar" flag — add if users need deep-linking or multi-hop navigation.

## Out-of-band feature: Menu language switch + full app UI translation (EN / 中文 / 日本語)

**Status:** done (2026-08-16).

- **Scope:** added a new Language row to `MenuPanel` beside Appearance, with English / 中文 / 日本語 options persisted in `localStorage` (`diet-language`). All user-facing strings in `App.svelte` and `src/pages/*.svelte` now read from a tiny hand-rolled `src/lib/i18n.svelte.ts` dictionary with English fallback, and date labels/month names follow the selected app language. Default language falls back to the OS locale (`navigator.language` 2-letter prefix) only when no language has been chosen yet; an explicit menu pick always wins thereafter. Food names (`Food.name`, a `Record<string, string>` keyed by source language, not every food has every key) are now shown via a shared `foodName()` helper that picks the current app language, falling back to English, then Japanese, then whatever name exists — applied everywhere a food name is rendered (Foods list, meal search/detail, food edit sheet, Summary meal rows).
- **Files changed:** `docs/prd.md`, `web/src/lib/i18n.svelte.ts`, `web/src/App.svelte`, `web/src/pages/{BackupPanel,CalendarPanel,DayStrip,FoodSheet,FoodsPanel,MealSheet,MenuPanel,ProfilePanel,SummaryPanel}.svelte`, `web/tests/i18n.test.ts` (new), `web/tests/MenuPanel.test.ts` (new), `web/tests/setup.ts` (jsdom lacks the Pointer Capture API that bits-ui's `Select` trigger calls on `pointerdown`; stubbed alongside the existing `Element.prototype.animate` shim).
- **Checks:** `pnpm check`; `pnpm build`; `pnpm test`; `pnpm run test:ui` — all pass. Final counts: 23 domain tests and 23 UI tests (added: `i18n.test.ts` covers language persistence/switching, English fallback for missing keys, and `foodName()`'s language-then-English-then-Japanese fallback; `MenuPanel.test.ts` covers picking a theme option and a language option each firing the correct callback with the correct value — bits-ui `Select` items only respond to `pointerup`, not `click`, in this version).
- **Risk:** no automated translation-quality review; new UI strings must be added to the dictionary manually or they will fall back to English. Food records without a name in the selected language silently fall back (English, then Japanese, then first available) rather than showing a per-food "missing translation" indicator.
- **Skipped:** RTL/layout mirroring, ICU/pluralization/interpolation tooling, and translation-key linting.

## Deferred work

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| W10 | Decide between History API, custom drag, or Drawer for sheet dismissal. | Selected gesture works without regressing sheet accessibility. |
| W11 | Fix visible gap between the fixed bottom `<nav>` and Mobile Safari's own bottom toolbar (iPhone, non-installed tab). | No visible blank gap between navbar and Safari chrome across Safari tab and installed/standalone modes, verified on-device. |

### W12 — trophy system

**Status:** done (2026-08-18); independent of W7.

- **Files changed:** `web/src/domain/store.ts`, `web/src/storage/indexeddb.ts`, `web/src/App.svelte`, `web/src/lib/i18n.svelte.ts`, `web/src/pages/TrophyPanel.svelte`, `web/src/custom.css`, `web/tests/store.test.ts`, and `web/tests/App.test.ts`.
- **Checks:** `pnpm check` (pass, 0 errors / 0 warnings); `pnpm build` (pass); `pnpm test` (pass, 30 domain tests); `pnpm run test:ui` (pass, 27 UI tests). Vitest still prints the pre-existing Svelte 5 `derived_inert` stderr warning seen in `App.test.ts` / `MenuPanel.test.ts`, but all assertions pass and no new failures were introduced.
- **Risk:** none known. Achievements are recomputed from current local data only (no parallel event log), so future title additions must keep using `mealEntries`, `foods`, `profile`, and `targetOverrides`.
- **Next ready phase:** W10.
- **2026-08-18 update:** `web/src/{App.svelte,custom.css}` now gives unread badges one 180-degree Y-axis back-and-forth over three seconds while their cards retain the existing entrance. `pnpm check`, `pnpm build`, and `pnpm run test:ui` passed (27 UI tests); the known Svelte `derived_inert` stderr warning remains unchanged.
- **2026-08-18 bug fix:** shared swipe-back now requires a gesture locked as horizontal before returning; vertical trophy-list scrolling with rightward drift remains on the trophy list. `web/tests/swipe-back.test.ts` covers this boundary. **Checks:** `pnpm check` (pass); `pnpm exec vitest run tests/swipe-back.test.ts` (4 passed).
- **2026-08-18 rule update:** the shared `calorieTone()` treats every nonzero total at or below its target as on-target. This applies to the summary green circle, calendar, and achievement streaks. **Files changed:** `web/src/domain/store.ts`, `web/tests/store.test.ts`, `docs/prd.md`, and this plan. **Checks:** `pnpm test` (33 passed), `pnpm check` (0 errors / 0 warnings), and `pnpm build` (pass; existing chunk-size warning). **Next ready phase:** W10.
- **2026-08-18 feature:** users can save a per-day extra exercise-calorie amount below the summary card. It raises that day's calorie target for the summary green circle, calendar, and qualifying achievement streaks without changing macro targets or turning an otherwise empty day into a qualifying day. The optional date-to-calorie map is validated and preserved by backup import/export. **Files changed:** `web/src/domain/store.ts`, `web/src/{App.svelte,lib/i18n.svelte.ts,pages/CalendarPanel.svelte,pages/SummaryPanel.svelte}`, `web/tests/{store,App}.test.ts`, `docs/prd.md`, and this plan. **Checks:** `pnpm test` (34 passed), `pnpm check` (0 errors / 0 warnings), `pnpm run test:ui` (29 passed; existing Svelte `derived_inert` stderr warning), and `pnpm build` (pass; existing chunk-size warning). **Next ready phase:** W10.
- **2026-08-18 UI refinement:** the exercise control is a compact, icon-led summary row below the nutrition cards; its input appears only in an accessible edit dialog, with the full-width save button below it. The row omits a redundant unit suffix, the icon blends into the row without its own background, and the input has a clear button plus native/password-manager autofill suppression. **Files changed:** `web/src/{lib/i18n.svelte.ts,pages/SummaryPanel.svelte}` and `web/tests/App.test.ts`. **Checks:** `pnpm check` (0 errors / 0 warnings) and `pnpm run test:ui` (29 passed; existing Svelte `derived_inert` stderr warning). **Next ready phase:** W10.
- **2026-08-18 UI refinement:** meal-list cards now use inline Tailwind styles and match the exercise row's muted background, border, radius, and hover treatment; the obsolete `.meal-card` CSS was removed. **Files changed:** `web/src/{custom.css,pages/SummaryPanel.svelte}`. **Checks:** `pnpm check` (0 errors / 0 warnings). **Next ready phase:** W10.
- **2026-08-18 privacy refinement:** the shared `Input` component now forces `autocomplete="off"` and password-manager ignore markers for every app input; callers cannot override it. **Files changed:** `web/src/lib/components/ui/input/input.svelte` and `web/tests/App.test.ts`. **Checks:** `pnpm check` (0 errors / 0 warnings) and `pnpm run test:ui` (29 passed; existing Svelte `derived_inert` stderr warning). **Next ready phase:** W10.

**Purpose:** motivate steady logging without rewarding restriction, shame, comparison, or social competition.

### Rules and design

- The shared `calorieTone()` qualifies a nonzero calorie day at or below its target (≤100%). Reuse it for achievement qualification so the calendar, summary green circle, and achievements have one definition of on-target. A missing, over-target, or unavailable-target day breaks a qualifying run.
- The first release has exactly 22 achievements, calculated only from existing `AppData`:

  | Family | Thresholds | Titles |
  | --- | --- | --- |
  | Valid saved profile and targets | 1 | Ready Set |
  | Recorded meals | 1, 10, 50, 100 | First Plate, Tenfold Log, Fifty Plates, Hundred Plates |
  | Temporary calorie entries | 5 | Quick Start |
  | Days with at least one meal | 3, 7, 30, 100 | Three-Day Start, Week Witness, Monthly Companion, Hundred-Day Journal |
  | Consecutive on-target days | 3, 7, 14, 30 | Steady Starter, Seven-Day Rhythm, Two-Week Pace, Monthly Rhythm |
  | Entries of one identified food | 10, 25, 50 | Familiar Favorite, Regular, Signature Order |
  | Unique identified foods / custom foods | 10, 25, 50 / 1, 5 | Ten Tastes, Twenty-Five Tastes, Fifty Tastes / First Custom Food, Personal Pantry |

- A temporary calorie entry has no `foodId`, so it counts toward recorded meals, its five-entry onboarding achievement, and active days but never food-specific, unique-food, or custom-food achievements. Titles remain unlocked after a later break or food deletion.
- Persist achievement records in `AppData` (optional for backward-compatible backups): ID, first `unlockedAt`, and optional `readAt`. Do not store duplicate daily summaries or a second source of nutrition truth.
- A small trophy button sits at the header's right edge and shows a non-intrusive unread indicator only while an achievement lacks `readAt`. Its page opens directly to a badge list; selecting a badge pushes a real detail sheet above that still-mounted list, revealing the exact list on swipe-back.
- On each save, unlock every newly qualified achievement in definition order and give that batch one shared `unlockedAt`. Never queue or stack toast/dialog celebrations.
- The badge list places all unread records in a "New" group above the normal list. Mark them all read when the list opens. Only those unread cards receive a short CSS-only entrance: the card scale/fades in while its badge flips once around the Y axis; read cards never animate or trigger a popup again. Honor `prefers-reduced-motion`. No image assets, canvas, or animation library.
- Use existing Lucide crown/star icons, CSS shapes, and the relevant threshold numeral for simple self-contained badge art.
- Evaluate achievements whenever local data is saved. A profile/target change can affect future qualification checks but never removes a previously unlocked title.
- A valid saved profile is one accepted by `validateProfile()` whose targets resolve successfully; unlock Ready Set on its first successful profile save, not on the prefilled unsaved form.

### Tests and exit criteria

- Domain tests: each of the 22 thresholds unlocks at its boundary but not one below; Ready Set only unlocks from valid persisted profile/targets; all nonzero calorie totals at or below 100% qualify while 100%+ does not; gaps break a run; temporary entries count for Quick Start but are excluded from food-specific achievements; `unlockedAt` and `readAt` survive export/import; unlocked records are never removed.
- UI test: the labeled header trophy control opens the 22-item badge list, groups simultaneous unread unlocks under "New" with the same acquisition date, renders translated locked/unlocked crown/star badges with their threshold numerals, keeps that real list beneath the detail sheet, exposes detail with its acquisition date, applies the badge entrance class only to newly acquired badges, clears the unread indicator, never replays read-card animation, and honors reduced motion.
- Run `pnpm check`, `pnpm build`, `pnpm test`, and `pnpm run test:ui`.

### Explicitly skipped

Nintendo Switch Sports informed the lightweight collection loop (visible weekly/short-term progress and cosmetic recognition), but W12 deliberately excludes continuous/decorative rotation, gear, points, leaderboards, notifications, social sharing, external art assets, and animation dependencies. The one-time new-badge Y-axis flip is the only exception. Add any of those only after titles show measurable retention value.

**Later candidate:** add a separate, user-requested fun-statistics view (for example, most-recorded foods or steady weeks) only after W12 ships. Any later statistic may link to an achievement but must reuse `mealEntries` rather than creating a parallel event log.

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
