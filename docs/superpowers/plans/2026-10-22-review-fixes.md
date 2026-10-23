# App Review Fixes Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for independent changes and verify integration in the shared checkout.

**Goal:** Fix the confirmed defects and measured bottlenecks in the 2026-10-22 app review without changing generated colors or contrast guarantees.

**Architecture:** Keep the existing balance worker and coalescing protocol. Prepare verified serialization in that worker and adopt its caches on the UI thread. Render startup before calculation, gate expensive diagnostics on visible content, and share verified foundations between CSS and DTCG.

**Tech Stack:** Svelte 5, TypeScript, Vite, Vitest/happy-dom, existing native HTML popovers.

## Tasks

- [x] Reject duplicate family IDs before normalization; regression covers v1 and v2 while preserving missing-family migration.
- [x] Limit drawer semantics/keyboard containment to compact layout; notify App of breakpoint transitions and clear stale open state without focusing a hidden toggle.
- [x] Cache verified foundations and DTCG documents using the existing mutable-input signature policy. Fix variant primitive paths with hyphenated-family coverage.
- [x] Prepare CSS/foundation data in the balance worker and adopt it before resolving client requests; verify structured-clone parity and invalidation.
- [x] Render startup/loading/error/retry states before solving. Restore and Reset through the worker. Preserve saved state until successful restoration/reset, ignore stale results, and terminate pending initialization on unmount.
- [x] Mount token diagnostics only when both the native popup and its parent details are open; prove that hidden updates do not run feasibility inspection.
- [x] Gate deployment on tests, build and PWA verification. Bound test concurrency rather than weakening assertions or raising the expensive test timeout.
- [x] Run targeted red/green regressions, then the complete suite, production build, PWA verification, native browser checks and a before/after serialization probe. Record results and limitations.

## Verification contracts

- Startup test: `mount(App)` renders loading, sends a worker request and does not call balancing on the UI thread; a verified reply reveals the workspace.
- Failure tests: failed saved restoration retries defaults in the worker; unavailable workers show retry and do not overwrite saved settings; stale replies cannot undo Reset.
- Diagnostic test: opening full details mounts inspection, dismissing the popup unmounts it, changing selection/configuration while hidden does not run feasibility.
- Existing engine parity, exports, exact locks, caches and asynchronous edit tests stay green.

Implementation is authorized by the user's request to apply the review fixes. No commits, deployment or unrelated visual redesign are included.
