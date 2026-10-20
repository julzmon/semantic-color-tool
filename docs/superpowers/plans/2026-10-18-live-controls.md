# Live control limits

**Approved revision:** Remove sample panels and sample buttons. Show and enforce limits directly on the existing slider tracks. Preserve automatic rebalancing and live numeric editing.

## Implementation

- Keep 300 ms numeric debounce, immediate Enter/blur, Escape cancellation and stale-response protection for slider and anchor edits.
- Probe the current value and both endpoints using the same full balancer as edits, including exact locks and coupled constraints. Probe finite options individually.
- Derive a bounded-search envelope from accepted results, including the current setting. Apply it to numeric and slider ARIA limits, gray track ends and input clamping. Keep the original track domain so color gradients retain their coordinate meaning.
- Invalidate reports when accepted settings, locks, active control or panel visibility changes. Use a separate cancellable worker.
- Keep one reserved feedback line for pending, limited, full-domain or unavailable state. Remove panels, buttons and datalists.
- Every interior edit still receives full validation. Endpoint results are conservative bounded-search limits, not proof of a continuous feasible interval or global extrema.

## Verification

Regression coverage: numeric and range clamping, bounds invalidation, locks, current accepted value retention, stale replies, desktop/mobile visibility, live typing and async races. Run full tests, Svelte checking, build and PWA verification after implementation.

Final validation: 291 tests pass, one optional profiling test skipped (10-second timeout for the slow full solver regression). Svelte check: zero errors/warnings. Production build, PWA verification and diff whitespace checks pass. Source review fixes retain limits during pending drags and preserve numeric stepping plus off-grid accepted range positions. Browser confirmed a reversed selected-state bound of 0–56.7%, gray unavailable track and correct accepted value; original direction restored afterward.
