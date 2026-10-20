# Independent muted state controls

Approved scope: replace the muted spacing slider with independent hover/pressed/selected strengths, matching emphasis interaction and full-width live limits; retain muted distance for default fill position. Raise the maximum state lightness change to0.12; keep25% strength cap and contrast protection.

Architecture: optional shared muted mix weights preserve legacy direct engine callers. New app defaults enable mixing; the acceptance path migrates legacy stored/imported spacing when the previous app configuration uses mixed muted states. Light muted mixes toward black, dark toward white; bases remain controlled by distance/chroma. Existing CSS/DTCG export materializes the accepted muted colors; config export carries weights. Keep mixed muted groups fixed during gray reuse. Both groups receive proportional strength caps based on actual bases, and automatic contrast balancing handles both groups without weakening locks/targets.

Tasks:
- Add failing regressions for independent muted state generation, order/validation, direction, contrast acceptance, migration/config round-trip and separate group caps.
- Add muted mix helper/model/type; retain legacy raw generation for absent weights. Preserve new fields through import/export, balancing and interpolation.
- Replace muted spacing UI with per-state strength sliders and actual-base gradient previews. Reuse full-width Slider behavior, central feedback and latest-only probes.
- Increase shared design cap0.10->0.12 and update policy copy/tests. No extra toggles or inline status text.
- Run engine/UI regressions, full suite/type/build/PWA checks, source review and browser QA.

Completed verification:
- Full suite: 312 tests passed, one optional profiling test skipped. After the final border-chroma regression was added, all 32 targeted muted/border/preview tests passed.
- Production build: zero Svelte errors or warnings. PWA verification and diff whitespace checks passed.
- Browser QA confirmed that changing pressed muted strength changes that state while preserving the muted default, hover, and emphasis settings; restored the original value after checking.
- Source review found no application-path defects. Mixed muted border adjustments now preserve each state's chroma, covered by the final regression.
