# Compact CSS Implementation Plan

**Goal:** Reduce CSS declarations without changing resolved colors or public states.

**Architecture:** Compile the existing verified token foundation into semantic-only CSS. Use the same declarations in preview styles; retain the expanded DTCG interchange model.

**Tech stack:** TypeScript, Svelte 5, Vitest, PostCSS, native CSS `light-dark()`.

## Tasks

1. Add failing regression tests in `src/engine/compact-css.test.ts`: resolve exported custom-property aliases and mode expressions; compare all colors with DTCG, check contrast outcomes, opacity, retained states, exact anchors, and emitted declaration counts. Cover custom prefixes and preview parity. Run `npx vitest run src/engine/compact-css.test.ts` and confirm failures expose the current formulas and removed roles.
2. Replace `stateAlphaTokens`, `stateAlphaEntries`, and `modernExportModel` with `cssTokenModel` in `src/engine/tokens.ts`. Compile each primitive from verified rounded coordinates or its exact source, collapse identical modes, and alias identical semantic color pairs. Remove the obsolete alpha-token type.
3. Update `src/engine/export.ts` and `src/ui/presentation.ts` to serialize the shared semantic declarations. Preserve nested scheme boundaries and translate both declaration names and alias references for the preview's internal prefix.
4. Remove approximate readouts in `src/ui/Controls.svelte`, report compact counts in `src/ui/ExportPanel.svelte`, and update export, precision, preview, and controls tests to assert the compact public contract. Run focused tests before the full suite.
5. Update README and PRODUCT export descriptions, add an interactive state example to `docs/examples/index.html`, and regenerate checked-in exports with `node scripts/export-example.mjs`.
6. Run `npm test`, `npm run check`, `npm run build`, and `npm run verify:pwa`. Inspect the application and exported example in a browser; verify computed colors at nested mode boundaries and interaction states. Review the final diff and report measured declaration savings.

Work stays in the current checkout because it contains the user's in-progress updates. No commit or publication is included.
