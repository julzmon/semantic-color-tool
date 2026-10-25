# Shared semantic and separate Brand chroma curves

**Goal:** Replace colored-family/muted chroma sliders with two constrained Bézier profiles in the left panel, shared by both themes, while preserving shared role lightness and a separate Neutral chroma control.

**Model:** Optional `chromaCurves: { brand, semantic }`, each with `peakLightness`, `peakChroma`, `darkBend`, `lightBend`. App defaults/imports enable profiles; direct engine inputs without profiles retain legacy recipes. Profiles are piecewise cubic graphs with ordered lightness, zero chroma at black/white, a peak and 0–1 shape handles. Exact Brand anchors become interpolation pins; the primary interior pin fixes the effective peak while dark/light shape controls remain editable. Equal-lightness conflicting pins are rejected. Additional pins form connected segments. Hue-specific gamut reduction preserves L/H.

**Generation:** All colored bases, text, borders, and states sample their profile at solved L, including reversed dark states. Neutral retains its existing global chroma behavior. Legacy black/white state mixing controls L only for curve-driven colors. Curve states export explicit resolved OKLCH values; Neutral and legacy states retain mixing recipes. Validate all emitted contrast and shared-lightness relationships.

**UI:** A left-panel Chroma shaping section contains Brand and Semantic colors editors. SVG previews show requested profiles, gamut-limited family results and locked pins. Accessible sliders/numeric fields edit peak lightness/chroma and dark/light bend. With a Brand pin the peak is read-only. Remove colored family chroma sliders and per-theme muted chroma percentages when profiles are active. Keep hue controls and Neutral chroma. Existing locked-color coordinate editing remains explicit.

- [x] Add failing curve math/generation/lock/serialization regressions.
- [x] Implement profile evaluation, schema validation, sampling across generation and feasibility, and explicit state export parity.
- [x] Add left-panel editors and integrate controls/tracks; preserve engine absence compatibility.
- [x] Migrate legacy app configurations with a visible color-change notice; preserve requested profiles through balancing and reduction.
- [x] Verify curve and legacy regressions, Svelte checks/build/PWA, browser controls and responsive layout. Review before committing.

## Verification results

- Final full suite: 414 passed, one opt-in profiling test skipped.
- Svelte/TypeScript: zero errors and warnings; production build and PWA verification passed.
- Independent review: additive-state resampling, semantic exact-lock bypasses, and export precision loss were reproduced with failing tests and fixed. Re-review found no remaining important issues; 52 focused reviewer tests passed.
- Curve samples preserve generated L/C/H precision during serialization to remain on the profile between nearby pins.
- Browser: verified both editors in the left panel, a semantic shape edit and restoration through the real worker with 648 passing relationships, and responsive settings access. Neutral remains independently controlled.
- Preview remains available at http://127.0.0.1:5174/.
