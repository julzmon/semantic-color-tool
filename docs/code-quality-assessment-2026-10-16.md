# Code quality assessment — 2026-10-16

## Resolution

All seven assessed areas have been addressed:

- Anchor commits now skip unchanged values and preserve unedited coordinate precision.
- Keyboard containment is limited to the opened settings drawer and excludes hidden/disabled controls with native visibility checks.
- Browser storage is acquired safely once and reused for loading, saving, and reset.
- Shared-theme generation preserves each mode's own exact source, including equivalent spellings.
- Removed the unused duplicate emphasis solver and obsolete recipe/reference metadata; made internal-only helpers/types private.
- Removed 40 orphan CSS rules and trimmed 7 grouped selectors: 205 fewer source lines and 117 fewer declarations. The CSS class reference scan now has no unmatched class names.
- Verification: 240 tests passed, 1 skipped; type checking reported 0 errors/warnings; production build and PWA verification passed. Eight browser behavior checks passed. Follow-up code review found no actionable regressions.

Production CSS decreased from 44.19 kB to 41.01 kB (about 7%; gzip 8.96 kB to 8.34 kB). Unused-code removal is verified by source analysis; a full Knip scan remains unavailable in the offline environment.

The findings below describe the original review state, before these fixes.

## Original assessment

The core architecture is sound: generation, validation/balancing, export, and UI concerns are separated. CSS and preview share one verified serialization model. State mixing has one engine implementation, caches are bounded, and color serialization has independent CSS/DTCG parity tests. A rewrite is unnecessary.

The original review identified four functional issues and three cleanup areas. That assessment was read-only; the subsequent implementation is summarized above.

## Verification

- Full suite: 230 passed, 1 skipped; 32 test files passed, 1 skipped.
- Svelte/TypeScript: 0 errors and 0 warnings; noUnusedLocals and noUnusedParameters already enabled.
- Production build: passed.
- Reviewed runtime source, import/export usage, package dependencies, and CSS class references; independent engine and UI reviews completed.
- Reproduced shared-theme anchor source loss and untouched anchor coordinate serialization with the actual engine modules.
- Knip could not run: npm registry DNS resolution failed and no offline copy was cached. Dependency/file analysis is therefore a manual/static assessment, not a clean automated Knip result. No clearly unused package dependency was identified.

## Functional findings

### P2 — Unedited anchor fields can rewrite exact coordinates

Location: `src/ui/AnchorCard.svelte:10` and `:55`.

Draft coordinates round to six decimals. Every blur commits the entire draft, even when no input event occurred. For example, focusing and leaving an imported `oklch(0.5432191 0.1034567 228.12345)` serializes `oklch(0.543219 0.103457 228.12345)`. This silently changes an exact anchor and can start a new balance operation.

Recommendation: track dirty fields, retain full-precision values for untouched components, and skip commits when nothing changed. Reuse the no-change behavior already present in `Slider.svelte`, rather than duplicating input commit policy.

### P2 — Desktop settings keyboard handling can trap focus

Location: `src/App.svelte:80`; attached at `src/ui/Controls.svelte:29`.

Tab wrapping runs for the ordinary desktop sidebar as well as the opened modal drawer. The last focusable element returns focus to the first instead of letting the user reach the workspace. The candidate list also includes controls hidden inside closed details.

Recommendation: limit modal keyboard handling to the active modal presentation and filter non-visible/non-focusable candidates. Cover normal sidebar traversal and opened drawer traversal with behavior tests.

### P2 — Accessing unavailable storage can stop initialization

Location: `src/App.svelte:31` and `:102`.

The `window.localStorage` getter is evaluated before entering the storage helpers' try/catch. A browser policy that throws SecurityError from the getter can abort initial rendering, despite the helpers handling getItem/setItem failures.

Recommendation: acquire storage through one guarded helper and reuse the result for load/save/reset. Test getter denial separately from method failures.

### P2 — Shared-theme reconciliation overwrites an equivalent exact source

Location: `src/engine/generate.ts:525–536`.

With Brand light lock `oklch(0.45 0.12 29)` and dark lock `oklch(0.450 0.120 29)`, all contrast checks pass, but both generated sources become the light literal and the dark literal disappears from CSS. One selected locked source is used for both modes after equal-color reconciliation.

Recommendation: share numerical state calculations while preserving each mode's own exact base source. Assert generated sources against original configuration anchors; comparing resulting primitives to resulting roles cannot detect an earlier overwrite.

## Cleanup findings

### P3 — Remove the unused duplicate solver

Location: `src/engine/generate.ts:273–311`.

`solveEmphasis` has no repository caller, test, or documented consumer. Production uses `solveFamilies`. The two implementations already disagree: the unused solver applies a surface UI-boundary constraint to emphasis fills, while the active solver deliberately does not.

Recommendation: remove `solveEmphasis` after confirming there are no external consumers. Retain `solveGroup`, which has active callers.

### P3 — Remove orphaned CSS selectors

Locations include `src/styles.css:161`, `:320`, `:330`, `:773`, `:1686`, `:1699`, `:1748`, and `:1934`.

Twelve class names have no reference in runtime TypeScript or Svelte source: `color-input`, `error-banner`, `export-note`, `invalid` (nested under color-input), `protection-summary`, `reference-comparison`, `reference-grid`, `scope-note`, `section-number`, `status-dot`, `surface-control`, and `workspace-footer`.

Recommendation: remove rules belonging exclusively to those classes, and remove only the unused branches of grouped selectors. Preserve live branches such as `.diagnostics` and `.primitive-grid`. Verify desktop/mobile views afterward.

### P3 — Trim obsolete metadata and unnecessary exports

Locations: `src/engine/tokens.ts:166`; `src/engine/families.ts:11–20`.

The returned CSS model's `recipes` array has no consumer after recipes moved into the root semantic declarations; only its local count is needed. `FamilyDefinition.referenceKey` is never read: configuration seeding uses `referenceToken`. Its separate REFERENCE_PALETTE_KEYS array exists only for the unused field's type. Several module-local types/helpers are also exported without external references.

Recommendation: remove the unused returned recipe array and redundant reference-key metadata, and make module-internal declarations non-exported where no API contract requires them. Keep fields used by parity tests when they provide useful validation rather than treating all test-only access as dead behavior.

## Keep

- Legacy additive generation: explicitly exercised by configurations without mixWeights; generateStates is also used by UI tracks.
- Per-tone gamut-limited chroma values: equal hue/lightness does not imply equal available chroma.
- Independent muted/foreground/border solving: their constraints differ from emphasis fill mixing.
- Exact-color source handling, scoped boundary paints, cached CSS model, and independent serialization checks.

## Suggested order

1. Fix anchor precision, focus behavior, and storage access.
2. Preserve per-mode locked sources during shared reconciliation.
3. Remove the duplicate solver, orphan CSS, and obsolete metadata.
4. Add runtime tests for focus/blur/storage behavior and a maintained unused-code check when tooling is available.
