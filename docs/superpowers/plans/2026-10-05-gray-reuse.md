# Gray reuse implementation plan

> **Historical implementation note.** The reuse algorithm remains active in the six-family builder. Counts in the result below describe the earlier Neutral-and-Info benchmark; use the current builder output for present counts.

**Goal:** Reduce redundant grays using existing surface/Neutral positions without changing surface settings, exact locks, state spacing, shared family lightness, or contrast status.

**Design:** Keep the constraint solver, then run a bounded reuse pass before primitive naming. Surface positions are fixed. Translate entire muted or emphasis/foreground/border groups across both families together, using family chroma at the new lightness. Locked groups are fixed. Reuse nearby existing gray colors for global text. Accept only changes that reduce the actual gray count and retain every contextual pass/fail result, gamut validity, and text hierarchy. Prefer the smallest movement among equal reductions. Maximum movement is 0.01 L and half the relevant surface/state spacing. This is deterministic greedy reuse, not a globally minimal palette.

The user approved shared-position reuse in the preceding discussion. Implement inline in the existing workspace; this directory has no Git repository.

- [x] Add regressions for nearby surface reuse, unchanged state spacing and cross-family lightness, fixed surfaces/locks, and contrast rejection; run them to establish failure.
- [x] Implement `src/engine/reuse.ts` with a validation callback to avoid a circular engine dependency. Integrate immediately before deduplication in `generate.ts`.
- [x] Run `npm test` and `npm run build`; inspect default counts and all contextual checks.
- [x] Document bounded reuse in README and regenerate CSS/DTCG examples with `node scripts/export-example.mjs`.

Historical result: the two-family reference defaults reduced from 23 to 17 gray primitives (29 total primitives), with all 300 contextual checks passing. The six-family builder applies the same bounded gray-reuse rules while generating the current palette.
