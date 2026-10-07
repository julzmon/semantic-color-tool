# Contrast protection implementation plan

Goal: allow dark muted distance up to 0.5 while accepting only passing checked contrast relationships.
Architecture: add a pure configuration balancer around the existing generator; route initial loading, controls, reset and import through it. Keep the generator's raw diagnostic API for existing engine consumers.
Tech stack: Svelte 5, TypeScript, Vitest.

- [x] Extend dark muted distance slider maximum to 0.5.
- [x] Write failing tests for brighter muted fills, infeasible requests, locks and minimum targets.
- [x] Implement balanceConfiguration, preserving changed fields during adjustment and using a bounded verified interpolation fallback.
- [x] Connect the guard to App and show adjustment status; reject infeasible imports/locks.
- [x] Verify test suite, build, browser controls and persistence.

Background worker: coalesce pending requests, version accepted results, preserve the last verified preview/export during checks. Review found and fixed synchronous slider blocking and superseded-anchor feedback. Verification: 101 tests pass, production build has zero warnings/errors. Browser black base with muted distance 0.5 auto-adjusts emphasis separation to 0.01; all 560 relationships pass and adjustments persist after reload.
