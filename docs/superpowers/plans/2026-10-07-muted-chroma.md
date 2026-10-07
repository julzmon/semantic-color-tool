# Muted Chroma Implementation Plan

**Goal:** Add separate percentage controls for muted chroma in each theme.
**Architecture:** Optional per-mode scale in the configuration; multiply family chroma in muted generation and gray reuse. Existing Svelte Slider provides the controls.
**Tech Stack:** Svelte 5, TypeScript, Vitest, Vite.

- [x] Add engine regression tests in `src/engine/muted-chroma.test.ts` and import/storage tests in `src/ui/configuration.test.ts`; run to confirm missing behavior.
- [x] Add `muted.chromaScale` to `src/engine/types.ts`, defaults and helper in `config.ts`, validation/normalization/scaled generation in `generate.ts`, and scaled candidate colors in `reuse.ts`.
- [x] Normalize optional scale in `src/ui/configuration.ts`; preserve explicit invalid values for rejection.
- [x] Add two 0–200% sliders using the existing Slider in `src/ui/Controls.svelte`, converting percentage to scale by dividing by 100.
- [x] Run full tests and production build; check UI control changes and reload persistence; restore original settings after checks.
- [x] Update README and review the completed diff.

## Verification

- 96 tests pass across 13 files; new tests cover chroma endpoints, default compatibility, independent modes, gamut/contrast checks, invalid settings, imports, and storage.
- Svelte checking reports zero errors and warnings; production build succeeds.
- Browser keyboard checks confirm 0% and 200% endpoints, independent saving and reload persistence. Both sliders restored to 100% afterward; no browser console errors or warnings.
- Code review found no significant issues.
