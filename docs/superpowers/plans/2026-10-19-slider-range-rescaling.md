# Slider range rescaling

Approved behavior: the complete physical track represents the currently usable range. Expanding bounds preserves the current numeric value; shrinking bounds clamps a value outside the new range to the nearest boundary. Recompute color gradients against those same bounds. Keep live validation, exact locks and automatic rebalancing.

Implementation:
- Add regressions for native range min/max, expansion without value change, shrink clamping, pending-edit handling, exact fractional bounds and matching gradient endpoints.
- Let Slider rangeStyle accept a bounded track factory; pass active bounds to existing engine-based gradient helpers. Remove unavailable gray track overlays.
- Use effective native range min/max and clamp displayed values. Submit a changed value once if bounds shrink outside it, deferring while another edit is pending.
- Raise maximum emphasis delta lightness from 0.08 to 0.10, retaining the 25% mix ceiling and proportional state scaling. Update the shared feedback and regression invariants.
- Run targeted/full tests, type/build/PWA checks, source review and browser confirmation.

Verification: full suite: 303 tests passed (one optional profiling test skipped); final fractional endpoint regression and all 22 relevant UI/track tests pass. Svelte check zero errors/warnings, production build and PWA verification pass. Source review identified original-step rounding at resized fractional endpoints; raw boundary requests now bypass interior snapping. Browser confirmed native pressed bounds 0–18%, End accepted 18% with contrast passing, and prior pressed/selected values restored after QA.
