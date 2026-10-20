# Feasible color sharing implementation plan

**Goal:** Explain verified allowed lightness values and optionally solve family text and emphasis bases jointly.

**Architecture:** Add an on-demand feasibility module so balancing does not pay for inspection. Reuse its candidate evaluation for joint family solving after both themes are generated, before token mapping. Keep absent strategy compatible with existing output. Existing themes provide fixed surface/muted requirements and on-emphasis text; candidate emphasis states include both themes for shared bases. Inspect sampled values and locks separately from actual aliases.

**Tech stack:** TypeScript, Culori, Svelte 5, Vitest.

- [x] Add failing feasibility tests: sampled contrast/gamut validity, state constraints, locks, no continuous interval claims.
- [x] Implement `src/engine/feasibility.ts`: candidate evaluation, sampled runs, restricting relationships, complete-color vs lightness sharing.
- [x] Add failing joint-solver tests: default parity, light-only sharing, reversed dark coupling, lock preservation, required separation, state hierarchy.
- [x] Add optional `solvingStrategy: 'standard' | 'prefer-shared'`; validate and import it, persist in existing config envelope, retain it through balancing.
- [x] Solve per-family union constraints for both, light-only, then dark-only sharing. Preserve foreground offsets and emphasis recipes; retain separate colors when no verified candidate exists. Never share on-emphasis text with fills.
- [x] Preserve existing text hierarchy order during bounded gray reuse; expose unresolved equal text or state roles in diagnostics.
- [x] Extend existing inspector with sampled feasibility disclosure and explicit sharing facts; add strategy control and palette explanation.
- [x] Add configuration round-trip and UI rendering tests, run targeted tests, full suite, type check and production build.

## Limits and hierarchy policy

Search samples are discrete and bounded, not a proof of impossibility or global minimality. Unlocked candidates use actual family hue/chroma and sRGB chroma reduction. Exact sources remain exact. Foreground hover retains its configured absolute spacing; emphasis mixes retain their configured retention factors and ordering without collapsing previously distinct states. Main/secondary global text retains the existing bounded reuse policy (at most 0.01 lightness, limited by half the surface spacing), preserving order and preventing a distinct pair from collapsing. Joint sharing leaves that pair unchanged. No universal perceptual threshold or accessibility claim is introduced. Existing zero spacing, endpoint clipping, or contrast-driven main/secondary equality is reported as an unresolved hierarchy tradeoff.


## Verification evidence

- Independent review found inherited-anchor hue/chroma inspection and adaptive on-emphasis identity gaps; both received regression tests and were fixed. Re-review found no further actionable issues.
- Direct comparison against the original engine confirmed identical modes, contextual checks, primitives and semantics for eight legacy configurations, plus identical balanced colors/checks/message for the contrast-limited case. Fingerprints changed only for the explicit strategy field and corrected diagnostics.
- Full Vitest suite, Svelte type checking, Vite production build and PWA asset verification pass. The opt-in profiling test remains skipped.
- Browser inspection confirmed the disclosure, discrete sample runs, joint candidates, restrictions and separate lightness/color sharing labels in the existing token inspector.
