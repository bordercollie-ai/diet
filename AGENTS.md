# Agent instructions

## Source of truth

1. `docs/prd.md` defines user-visible scope and acceptance criteria.
2. `docs/adr/` defines architectural decisions and constraints.
3. `docs/implementation-plan.md` defines the current execution order, design, tests, and exit criteria for each phase.

If these documents conflict, stop and report the conflict; do not silently invent behavior. Update the relevant document before changing implementation.

## Working rules

- The `web/` app uses **pnpm** (see `web/pnpm-lock.yaml`, `web/pnpm-workspace.yaml`) — always run `pnpm`, never `npm`, for install/dev/build/test/check commands there.
- Work on one phase at a time, in the order listed in `docs/implementation-plan.md`.
- Read the phase's design and tests before writing code.
- Keep domain calculations independent from SwiftUI, SwiftData, HealthKit, and network code.
- Do not add networking, accounts, cloud sync, third-party dependencies, AI, barcode scanning, or speculative abstractions.
- Every non-trivial behavior needs a deterministic test before the phase is marked complete.
- Do not mark a phase complete until its exit criteria and PRD acceptance checks pass.
- If Apple tooling, signing, or entitlements block a phase, record the exact result in the phase document and stop at that boundary.

## Handoff format

At the end of each phase, update `docs/implementation-plan.md` with:

- status and date
- files changed
- tests/checks run and results
- unresolved risks or decisions
- the next ready phase
