# Shared role lightness implementation plan

**Goal:** Enforce common OKLCH lightness for corresponding semantic family roles throughout generation, balancing, optimization, migration, and export.

**Architecture:** Retire per-family text/fill sharing. Validate final family roles and shared cross-theme emphasis bases using a single invariant helper. Preserve raw diagnostic engine outputs for unsatisfied locks, but never accept or export a structurally invalid system. Reject conflicting hard locks before balancing. Normalize the retired strategy to standard and disclose migration. Preserve existing compatible primitive reuse and opaque state recipes.

**Tech stack:** Svelte 5, TypeScript, Culori, Vitest.

- [x] Add failing invariant, conflicting-lock, legacy-strategy migration, and UI regressions. Run them before implementation.
- [x] Add shared-lightness inspection and acceptance guards after reuse, during balancing/reduction, and before exports. Validate corresponding roles within each mode and shared emphasis across themes. Tolerance: 1e-9 OKLCH L.
- [x] Remove per-family sharing function/call and strategy control. Keep the legacy field as deprecated input, normalize to standard, and reject unknown values. Update feasibility wording to distinguish per-family samples from a system-wide solution.
- [x] Reject locked positions that disagree within a role/theme or across shared emphasis themes. Preserve literal source colors in diagnostic engine output and retain the previous UI configuration on rejection.
- [x] Update lightness-reduction feedback, dark-direction explanation, configuration migration messaging, product docs, and tests for retired behavior.
- [x] Run full tests, type check, production build, PWA verification; review the final diff. Leave the branch/worktree available for review.

## Verification

Exercise both mode directions, selected states, legacy and mixed recipes, custom hue/chroma, border strengths, exact locks, conflicting locks, reduction and round-trip migration. Mutating a role in a generated system must be detected and blocked by export even if all prior contrast results pass. Existing failed-contrast diagnostic exports remain available when structure is valid.

## Results

- Baseline generation/reduction checks: 37 passed.
- New regressions reproduced retired-strategy migration, conflicting-lock acceptance, and divergent exports before implementation.
- Review reproduced an equal-lightness/different-hue cross-theme lock bypass; the common validator now blocks it in balancing, reduction, and every export.
- Final suite: 389 passed, one opt-in profiling test skipped.
- Svelte/TypeScript: zero errors and warnings. Production build and PWA verification passed.
- Browser inspection confirmed the strategy control is removed and the invariant/dark-direction explanations render correctly. Temporary preview stopped.
- Re-review found no remaining important issues; focused reviewer verification passed 56 tests.
- Legacy adaptive themes remain available only to direct engine callers, as documented; builder imports normalize them to shared bases with reversed dark states.
