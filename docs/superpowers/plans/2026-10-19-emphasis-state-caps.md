# Emphasis state caps implementation plan

**Goal:** Enforce the approved 0.08 maximum OKLCH lightness change and 25% maximum mix strength for mixed emphasis states throughout the app.

**Architecture:** Keep opaque mix recipes and raw generation intact. The existing acceptance/balancing path normalizes shared strengths against actual generated emphasis bases across every family and both themes, then regenerates and rechecks contrast. Exact locks remain unchanged. The same formula supplies immediate caps to existing sliders independently of asynchronous contrast probing. Imports/restoration already use this acceptance path; exports serialize accepted weights.

**Tech stack:** TypeScript, Svelte 5, Vitest, existing generate/balance workers.

- [x] Add failing engine tests for black/white direction, both caps, multiple families, locks, accepted weights and serialized recipes, idempotence, legacy raw generation compatibility.
- [x] Add a small emphasis-limits module with shared constants, formula and immutable weight normalization. Quantize conservatively to 0.1 percentage-point precision and preserve weak-to-strong ordering.
- [x] Normalize every balanced candidate against actual generated bases. Re-evaluate after bases move; bound iterations with the universally safe 8% fallback. Keep raw-generation caching and contrast acceptance rules intact. Explain visual limiting separately in feedback.
- [x] Add failing UI tests and wire immediate shared ceiling to hover, pressed and selected sliders, keeping gray track ends, live checks, and automatic rebalancing. Update help text. Include exact Home/End behavior at fractional caps.
- [x] Source review; targeted/full tests, type check, build, PWA check and browser confirmation. Update README.

Policy scope: an application design rule, not a WCAG threshold. Legacy engine callers without mixed weights retain their original absolute-spacing behavior. Limits cover state change from the actual base; they do not lighten an intentionally dark exact base color. No extra settings panel or toggle is introduced.

## Verification

- 300 tests passed; one optional profiling test skipped. Final 0.1% input-precision change passed all 17 relevant UI/control regressions.
- Svelte checking reports zero errors/warnings; production build, PWA verification and diff whitespace checks pass.
- Source review found no remaining actionable issues.
- Browser confirmed imports/restoration normalize original strengths 9/18/27% proportionally to 4.8/9.6/14.4%. A pressed request of 100% accepted 14.4%, and checks passed; the prior pressed value of 9.6% was restored after QA.
- Fractional Home/End boundaries remain exact. Immediate ceilings remain visible even without focusing a control or awaiting a probe.
