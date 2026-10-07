# KDS color model initial prototype plan (archived)

> **Historical document.** This plan records the original Neutral-and-Info prototype. The current builder supports six families, an independent Brand namespace and anchor editor, configuration persistence/import, and DTCG exports. See [the completed builder plan](2026-10-06-complete-core-builder.md) and the [README](../../../README.md) for current behavior.

**Historical goal:** Validate a semantic-first OKLCH engine with Neutral and Info before expanding to the other intents or integrations.

**Historical architecture:** A pure TypeScript engine produces colors, primitive references, semantic mappings, and explicit contrast relationships. A React workspace edits configuration and renders this output. Culori owns conversion, gamut mapping, and WCAG contrast; PostCSS parses the supplied reference.

**Tech stack:** TypeScript, React, Vite, Culori, PostCSS, Vitest.

## Design decisions

The repository is initially empty (and has no Git history). The provided tokens have five primitive ramps, six intents, and partial dark overrides. In the original reference, Brand and Negative map to red; their mappings differ. The current builder seeds Brand from red but generates its own `brand` namespace. Preserve the existing semantic names for the roles in this prototype. Import dark values with the correct inherited light defaults.

Use a compact `BuilderConfig` containing independent light/dark base colors, a shared surface count and step, family hue/chroma, muted distance and state spacing, emphasis state spacing, optional anchors, and three contrast targets. `GeneratedSystem` includes both modes, one primitive collection, semantic aliases, contextual checks, and diagnostics. Keep the reference immutable and separate from the generated system.

**2026-10-05 revision:** The shared-lightness and DTCG design in [the theme export plan](2026-10-05-theme-exports.md) supersedes the per-family solving and naming described below. Corresponding family roles now solve jointly, primitive ordinals identify global lightness positions, and the Export panel includes DTCG source documents plus a Terrazzo-tested portable resolver.

**2026-10-06 revision:** The complete builder supersedes the two-family scope. Neutral, Brand, Info, Positive, Negative, and Warning now use the shared solver. Brand is seeded from KDS red but has its own `brand` primitive namespace, so it can change independently of Negative `red`.

### Algorithm

1. Parse CSS declarations by mode, resolve variable references, and derive default surface colors and family hue/chroma from gray/blue reference colors.
2. Generate a predictable surface progression inward from each base: darker for light, lighter for dark. Preserve the base hue/chroma, reducing chroma only to fit sRGB.
3. Place muted states at configured distances from the base. They are visual fills, not UI boundaries. Validate foreground content against every muted state and surface.
4. Search OKLCH lightness candidates at fixed family hue/chroma; gamut-map candidates before testing. Solve emphasis for UI contrast against every surface and normal text contrast with the common on-emphasis foreground. Prefer a candidate that also meets semantic text contrast against all intended surfaces and muted backgrounds.
5. Generate state candidates with the configured directional spacing. Revalidate every state; flag infeasible contrast or collapsed spacing rather than claiming success. Split semantic foreground from emphasis only when reuse fails.
6. Generate global foregrounds and emphasis borders against their actual backgrounds. Treat muted borders as decorative separators. Keep all failing checks in output, including impossible targets.
7. Preserve locked anchors exactly and report conflicts. In this original prototype, anchors were a pure engine seam and the Brand lock editor was deferred; the current builder includes that editor.
8. Deduplicate identical generated OKLCH values within gray/blue across both modes. Sort by descending lightness and assign 100, 200, … names. Map existing public semantic names to those primitives through `light-dark()`.

### Assumptions and tradeoffs

- This is an opaque sRGB prototype. Chroma is an upper bound: fixed hue/chroma at every lightness is not always displayable. Report gamut reduction; do not silently clip RGB channels.
- Every generated surface and family muted state is an intended text background. This conservative choice can cause darker/lighter emphasis or foreground splitting.
- The global on-emphasis foreground may differ by mode. Prefer white in light mode and black in dark mode; all emphasis roles in one mode share it.
- Semantic names are stable; generated primitive ordinal names are deterministic for a configuration but may shift when constraints change. “Stable palette” means one shared set across modes, not immutable IDs across every edit.
- The original 100–1200 ramps are available for migration comparison. Do not force more than twelve unique solutions into twelve slots or imply that new ordinal values are color-identical to old ones.
- In the original prototype, overlay, transparency, selected, and other-family mappings were reference data unless explicitly generated. The current builder adds all six opaque semantic families and selected emphasis states; transparent overlays remain outside scope.
- Contrast requirements can be infeasible; report failures instead of changing targets. Report actual measured values without rounding them before pass/fail decisions.

## Implementation sequence

- [x] Create project scripts (`dev`, `test`, `build`) and shared TypeScript contracts in `src/engine/types.ts`.
- [x] Write reference-parser regression tests for dark inheritance, variable resolution, family defaults, and malformed input; implement `src/engine/reference.ts`.
- [x] Write engine tests before implementation: reference contrast pairs, monotonic surfaces/states, gamut mapping, default contrast requirements, shared primitives, forced splitting, anchors, impossible targets, deterministic output.
- [x] Implement `color.ts` and `generate.ts` as pure functions; verify engine tests before connecting UI.
- [x] Test and implement CSS/JSON serialization with no dangling aliases and semantic `light-dark()` output.
- [x] Build the initial workspace: controls, light/dark/split previews, two-family semantic matrix, token inspector, relationship table, reference ramp, and copy/download exports. The current UI has since expanded to all six families and configuration import/persistence.
- [x] Run the full suite and TypeScript/production build. Review code independently. Verify real browser interactions, narrow layout, and clipboard/download feedback.

## Validation commands

`npm test` runs the engine/import/export regressions. `npm run build` performs strict type checking and a production build. `npm run dev -- --host 127.0.0.1` starts the workspace for browser verification.

## Sources

- [Culori API](https://culorijs.org/api/): OKLCH conversion, chroma gamut mapping, and WCAG contrast.
- [Vite guide](https://vite.dev/guide/): TypeScript development and production bundling.

## Historical verification outcome

34 tests pass; strict TypeScript and production build pass. Browser checks cover generated light/dark colors, semantic inspection, selected-state generation, CSS/JSON clipboard exports, and responsive layout. The launcher works with a minimal shell PATH and loads nvm without pnpm. The solver uses a bounded 0.001-lightness search; extremely narrow feasible intervals may be missed, and diagnostics explicitly disclose that limitation.
