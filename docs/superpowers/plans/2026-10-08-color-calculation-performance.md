# Color calculation performance plan

**Goal:** Reduce time to verified preview updates while retaining the published generator's complete output.

**Architecture:** Bound reusable color conversion and rendered-color facts caches by entry count. Retain exact source strings and full precision. Return independent generated colors so external mutations cannot poison caches. Keep all contextual checks and existing search candidate order. Reduce allocations in hot contrast scoring and reuse repeated candidates inside one balance operation.

**Tech stack:** TypeScript, Culori, Vitest, existing worker pipeline.

- [x] Profile the published generator using representative default, hue, muted, count, selected-state and lock cases; capture complete-output fingerprints.
- [x] Write failing cache-work tests and bounded-storage tests; add published-output parity coverage.
- [x] Implement bounded caches and allocation reductions. Validate parity, exact locks, gamut behavior and invalid input.
- [x] Cache identical balance candidates within a single request without changing candidate order.
- [x] Re-run comparable benchmarks, full suite/build, independent review and localhost browser checks.

## Constraints

No new Brand-sharing behavior, relaxed targets, approximate ratios, larger search increments, or unverified previews. Do not publish without a user request. Timing measurements describe this machine and representative fixtures, not all configurations or devices.

## Verification

116 tests passed; the opt-in profiler test is skipped in the normal suite. Svelte check and production build passed with zero diagnostics. Independent review found no blocking issues. Native browser numeric entry and rapid range edits retained the latest value, with all 648 default contextual checks passing.

The complete generated-output fingerprints match the published commit a4bd1af across eight configurations and one constrained balance request. See docs/color-calculation-performance.md for measurements and the repeatable profiling command.
