---
title: "Diet App implementation plan"
type: implementation-plan
status: archived
version: "1.0"
date: 2026-08-12
current_phase: archived
---


# Implementation plan（历史 SwiftUI 路线）

> Archived on 2026-08-13. Continue implementation only in `docs/implementation-plan-web.md`.

This is the executable specification for agents. Read `docs/prd.md` first for product scope and the ADR for architectural rationale. Implement phases in order; do not skip a phase because a later feature appears easier.

## Global rules

- **Architecture:** native SwiftUI; iPhone/iPad first; Mac Catalyst reuse.
- **Storage:** local only; no account, server, iCloud, or network dependency.
- **Data:** all nutrition values use explicit units and stable IDs.
- **Testing:** pure calculations and backup parsing are unit-tested without a device; Apple framework integrations are tested with the smallest available device/simulator check.
- **Errors:** invalid input and failed imports are visible to the user and never silently produce success-shaped data.
- **Localization:** UI strings use localization keys; food records can carry Chinese, English, and Japanese names independently.
- **Source of truth:** a phase is complete only when its exit criteria pass.

## Phase 0 — toolchain and capability spike

**Status:** blocked (2026-08-12)

### Design

Create a disposable blank SwiftUI app before the real project. Verify the installed Xcode, supported iOS/macOS deployment targets, iOS/iPadOS simulator, Mac Catalyst destination, personal-team signing, local notifications, and the HealthKit capabilities required by the PRD.

HealthKit results are a hard boundary:

- If the entitlement and permissions work, enable the integration in a later phase.
- If free signing or the platform blocks it, disable HealthKit and keep the local app fully functional; record the exact limitation in the ADR.

### Tests/checks

- `xcodebuild -version`
- Build the blank app for an iOS simulator.
- Build the same app for Mac Catalyst.
- Install on a personal iPhone/iPad if available.
- Schedule and cancel one local notification.
- Check HealthKit authorization and one read/write operation on a real device.

### Exit criteria

- The selected deployment targets are recorded.
- iOS and Mac Catalyst builds succeed.
- Free signing behavior is known.
- HealthKit is marked `enabled` or `unavailable` with evidence.

### Deliverables

- Xcode/toolchain result in the ADR.
- A disposable blank project built for Mac Catalyst only; not retained because
  the iOS simulator destination and device checks were blocked.

## Phase 1 — project shell and local domain

**Status:** pending; depends on Phase 0

### Design

Use one app target and one test target. Keep pure domain types separate from persistence and UI.

```text
Diet/
  App/DietApp.swift
  Domain/Nutrition.swift
  Domain/Food.swift
  Domain/MealEntry.swift
  Domain/Profile.swift
  Domain/DailyTarget.swift
  Domain/MealPlan.swift
  Services/Store.swift
  Resources/SeedFoods.json
  Features/Today/
  Features/Foods/
  Features/Plans/
  Features/Settings/
Tests/
```

Use SwiftData if the Phase 0 deployment target supports it. Otherwise hide a Codable file store behind `Store`; views must not know which persistence implementation is used.

### Required model rules

- Every persisted entity has a stable UUID.
- Food nutrition is expressed per declared serving.
- Meal entries store a nutrition snapshot so later food edits do not rewrite history.
- Bundled foods are read-only; user foods are editable and deletable.
- Meal types are breakfast, lunch, dinner, and snack.

### Tests/checks

- Store and reload one sample record.
- Verify stable IDs survive relaunch.
- Verify a bundled food cannot be edited.
- Verify localization keys exist for the shell.
- Build iOS and Mac Catalyst.

### Exit criteria

The app launches offline, shows empty states for Today/Foods/Plans/Settings, persists a sample entity, and builds for both destinations.

## Phase 2 — food search and daily logging

**Status:** pending; depends on Phase 1

### Design

Add a versioned `SeedFoods.json` containing a small curated Japanese dataset with representative convenience-store and McDonald's items. Each item has stable ID, localized names, brand/source, serving label, calories, protein, fat, carbohydrates, dataset version, and provenance.

Food search covers bundled and user foods. A meal entry contains date, meal type, food ID, quantity, and a nutrition snapshot. The domain calculator scales serving nutrition by quantity and sums a selected calendar day.

### Input rules

- Food name is required.
- Serving size and quantity must be greater than zero.
- Calories and macros cannot be negative.
- A saved meal entry must reference an existing food or carry its snapshot.

### Tests

- Scale one serving to `0.5`, `1`, and `2` quantities.
- Sum entries across meal types for one day.
- Exclude entries from another day.
- Reject zero/negative quantities and nutrition values.
- Search localized names and brand names.
- Create, edit, delete, and reload a user food.

### Exit criteria

Offline users can search a food, record it in a meal, edit/delete it, create a custom food, and see correct daily calorie/macro totals after relaunch.

## Phase 3 — profile, targets, and plans

**Status:** pending; depends on Phase 2

### Design

Profile fields are age, sex, height, weight, and activity level. Put the estimation formula in a pure function returning an explicitly labeled estimate. Store manual overrides separately so removing an override restores the estimate.

Plans contain one or more dated days and planned food quantities. Reuse the food/quantity editor from Phase 2. Compare actual meal-entry totals to planned totals; do not generate complex menus automatically.

### Tests

- Same profile produces the same estimate.
- Invalid profile values are rejected.
- Each manual override replaces only its selected target.
- Removing an override restores the calculated estimate.
- Plan totals scale food nutrition correctly.
- Actual-vs-plan comparison handles missing meals as zero, not as an error.

### Exit criteria

Users can enter a profile, review an estimate, override targets, create a one-day or multi-day plan, and view progress against actual entries.

## Phase 4 — Files backup and restore

**Status:** pending; depends on Phase 1 and Phase 2

### Design

Define a top-level Codable backup:

```text
Backup
  schemaVersion
  exportedAt
  appVersion
  foods
  mealEntries
  profiles
  targets
  plans
  settings
```

Decode and validate the complete file before changing storage. Import uses merge semantics: imported records are inserted, matching IDs are replaced, and unrelated current records remain. Apply the result transactionally.

### Tests

- Export then import preserves all supported data.
- Unknown schema versions are rejected without mutation.
- Malformed JSON is rejected without mutation.
- Invalid IDs, dates, units, and negative values are rejected.
- Matching IDs are replaced; unrelated IDs remain.
- A failed import leaves the original store byte-for-byte equivalent at the domain level.

### Exit criteria

Files export/import works offline, shows a preview and result, and no invalid backup can modify existing data.

## Phase 5 — notifications and HealthKit

**Status:** pending; depends on Phase 0 and Phase 1

### Design

`NotificationService` owns authorization, scheduling, rescheduling, and cancellation. Request permission only after the user enables reminders.

`HealthKitService` is optional and isolated from the domain:

- read weight only after permission
- write daily calories and nutrition only after permission
- support any additional PRD-approved read/write types only after Phase 0 confirms them
- surface denied/unavailable/error states explicitly

No local record is considered saved only because a HealthKit write succeeded; HealthKit is a separate side effect.

### Tests/checks

- Enable, edit, and cancel a reminder.
- Denied notification permission leaves meal logging usable.
- HealthKit unavailable/denied leaves meal logging usable.
- A failed HealthKit write is reported and does not delete local data.
- On a supported device, verify one authorized read and write.

### Exit criteria

Reminders work without a server, and HealthKit is either verified on-device or documented as unavailable with the core app unaffected.

## Phase 6 — hardening and release

**Status:** pending; depends on Phases 2–5

### Design

Run the PRD acceptance checklist against the built app. Keep the test suite small and deterministic. Do not add UI abstraction layers unless a repeated failure demonstrates they are needed.

### Checks

- Unit tests: nutrition, totals, targets, plans, backup validation/merge.
- UI checks: first launch, add food, log meal, import backup, denied permissions, empty states, errors.
- Accessibility: Dynamic Type, VoiceOver labels, dark mode, touch targets.
- Build iOS/iPadOS and Mac Catalyst release configurations.
- Test free signing/reinstallation and manually export a backup first.

### Exit criteria

All PRD MVP acceptance criteria pass, no known data-loss path remains, and the ADR records actual toolchain/signing/HealthKit findings.

## Phase 7 — official food import tools

**Status:** in progress (2026-08-13); independent development tooling

### Design

Keep brand importers outside the app and runtime bundle. Each importer may read
only the brand's public pages, at low request frequency, and must emit a local,
reviewable JSON snapshot with source and retrieval date. Missing official
translations fail explicitly rather than being guessed.

### Tests/checks

- Parse a saved official nutrition page deterministically.
- Reject missing Chinese mappings.
- Reject missing English names and empty product results.
- Run one live import only with a reviewed Chinese mapping.

### Exit criteria

The McDonald's Japan importer produces app-compatible food records without
runtime networking or access-control bypasses. Convenience-store importers can
reuse the same output shape but are separate follow-up tools.

### Handoff

- **Status:** in progress.
- **Files changed:** `scripts/import_mcdonalds_japan.py`, `docs/prd.md`, `docs/adr/0001-local-first-swiftui-app.md`, `docs/implementation-plan.md`.
- **Checks:** static compilation and fixture parsing pending.
- **Unresolved risks:** McDonald's Japan publishes no official Chinese menu names; a reviewed mapping is required. Product pages and table markup may change.
- **Next ready phase:** add a reviewed mapping and run the importer; then decide whether to add the 7-Eleven importer.

## Handoff protocol

Before starting a phase, mark its status `in progress` and read its complete section. After finishing, replace the status with `done`, add the date, list changed files and checks, and record any blocked item. Do not start a phase whose dependency is not `done`.

## Phase 0 handoff (2026-08-12)

- **Status:** blocked.
- **Files changed:** `docs/adr/0001-local-first-swiftui-app.md`, `docs/implementation-plan.md`.
- **Checks:** Xcode 26.3 and SDKs detected; disposable SwiftUI app built for iOS Simulator and Mac Catalyst; iPhone 16e simulator installed and launched the app; notification scheduling and cancellation logged successfully. Signing check found 0 valid identities. HealthKit authorization/read/write was not run on a physical device because Developer Mode was intentionally declined.
- **Unresolved blockers:** free signing and physical-device HealthKit remain unverified by user choice. The core simulator path is unaffected.
- **Next ready phase:** none; Phase 1 remains blocked until Phase 0 exit criteria are satisfied.
