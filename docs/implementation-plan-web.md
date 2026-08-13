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

- **Files changed:** `scripts/import_mcdonalds_japan.py`, `scripts/output/`, `web/src/data/mcdonalds_japan.json`, `web/src/domain/store.ts`, domain/UI tests, and `web/package.json`.
- McDonald's Japan importer is in `scripts/import_mcdonalds_japan.py`.
- It produced 202 unique, app-format records in `web/src/data/mcdonalds_japan.json`, also retained as a raw audit file in `scripts/output/`.
- The dataset is bundled as immutable food data and searchable by Japanese and English names. Domain and UI coverage verifies Big Mac lookup/logging and dataset validation.
- Node-based tests require Node >=23.6 because they load TypeScript and JSON ESM imports directly; this minimum is recorded in `web/package.json`.
- **Checks:** Python fixture parsing; `pnpm check`; `pnpm build`; 18 domain tests; 4 UI tests.
- **Risk:** No reviewed Chinese mappings exist. Product-page markup can change.
- **Next:** supply a reviewed mapping and rerun, then consider a separate 7-Eleven importer.

### Exit criteria

The importer emits app-compatible records with reviewed Chinese mappings, without runtime networking or access-control bypasses.

## Deferred work

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| W8 | Persisted Chinese/English UI selection and complete message translation. | Both languages retain accessible core flows without changing domain/storage/backup behavior. |
| W10 | Decide between History API, custom drag, or Drawer for sheet dismissal. | Selected gesture works without regressing sheet accessibility. |

## Handoff protocol

Before a phase, mark it in progress and read its section. On completion, record date, changed files, commands/results, risks or decisions, and the next ready phase. Do not start a phase until its dependencies are done.
