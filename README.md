# Semantic Color System Generator

An interactive, semantic-first OKLCH color-system builder built with Svelte 5 and TypeScript. It generates validated light and dark tokens for **Neutral, Brand, Info, Positive, Negative, and Warning**.

## Run

With dependencies already installed:

```sh
bash scripts/dev.sh
```

The launcher loads the installed nvm runtime when available and runs Vite directly. It does not require `pnpm`. In VS Code, select **Tasks: Run Task → Start color tool**.

For a fresh installation, use Node 26 (see `.nvmrc`):

```sh
nvm install
corepack enable
pnpm install --frozen-lockfile
pnpm run dev
```

Open the localhost URL printed by Vite, normally http://127.0.0.1:5173.

## Validate

```sh
pnpm test
pnpm run check
pnpm run build
```

## Builder scope

- Six generated semantic families: Neutral, Brand, Info, Positive, Negative, and Warning.
- Light and dark surface controls, independent light and dark muted-distance controls, generated gray levels, muted and emphasis states, semantic foregrounds, and borders. Emphasis fills are shared across themes by default; adaptive per-theme emphasis remains available.
- Fixed contrast requirements: normal text **4.5:1**, large text **3:1**, and UI boundaries **3:1**.
- Shared lightness positions for corresponding roles across every family, with contextual contrast checks for each emitted relationship.
- Shared primitive reuse where it preserves contrast, gamut, state separation, and exact locks.
- Light, dark, and split previews; a semantic matrix; primitive inspection; CSS, DTCG, and configuration exports.
- Native CSS `light-dark()` output with no legacy fallback.

This is a generated color-token scope, not a replacement for the complete KDS API. Non-color tokens and transparent overlay tokens are outside the builder.

## Family model

| Semantic family | Generated primitive namespace | KDS reference seed |
| --- | --- | --- |
| Neutral | `gray` | `--kds-key-gray-700` |
| Brand | `brand` | `--kds-key-red-800` |
| Info | `blue` | `--kds-key-blue-700` |
| Positive | `green` | `--kds-key-green-700` |
| Negative | `red` | `--kds-key-red-700` |
| Warning | `yellow` | `--kds-key-yellow-700` |

Brand deliberately uses its own generated `brand` namespace even though its starting values come from the KDS red reference. Changing Brand therefore does not alter the Negative `red` palette.

Surfaces belong to the Neutral/gray palette. Their controls set base lightness, number of levels, and per-mode tonal spacing; Neutral hue and chroma apply to surfaces and Neutral roles together.

Corresponding family roles use one lightness position. Equal OKLCH lightness creates a consistent system structure, but it does not guarantee equal WCAG contrast across hues, so every intended foreground/background and boundary relationship is checked independently.

## Brand color anchors

Open **Families → Brand** and choose **Add anchor**. The default target is the light-mode semantic token:

```css
--kds-bg-brand-emphasis-base
```

Enter L, C, and H directly in OKLCH. The anchor starts unlocked, so the solver may adjust it to satisfy the system. Select **Lock exact color** to preserve that literal `oklch(L C H)` source. The editor also supports a foreground-base target and light, dark, or both modes for advanced use.

An exact lock constrains the same semantic lightness position across families. If locks conflict or an exact source cannot meet a required contrast relationship, the source stays exact and the diagnostic remains visible.

## Saved and imported configurations

Every valid change is saved locally in the browser. Reloading restores that configuration; **Reset** clears it and restores the KDS defaults.

Use **Export → Configuration** to download the current configuration and validation results. The same tab imports a local JSON configuration after normalizing and validating it before it replaces the current workspace. Version-1 configurations are migrated to the version-2 shape: missing family defaults are added and an old numeric surface step becomes matching light and dark steps. Existing version-2 configurations with one numeric muted distance retain it for both modes; new defaults use `0.055` for light and `0.160` for dark. Muted chroma defaults to 100% in both modes when older configurations omit it.

## Architecture

| File | Responsibility |
| --- | --- |
| `src/engine/families.ts` | Fixed family metadata, generated namespaces, and KDS reference seeds |
| `src/engine/types.ts` | Configuration, colors, semantic roles, output, and contrast contracts |
| `src/engine/reference.ts` | Parse KDS CSS and resolve aliases/partial dark overrides at build time |
| `src/engine/config.ts` | Derive version-2 defaults from the parsed reference |
| `src/engine/color.ts` | Culori conversion, sRGB gamut mapping, contrast, and exact anchors |
| `src/engine/generate.ts` | Surface/state generation, joint constraint solving, shared primitives, and semantic mapping |
| `src/engine/reuse.ts` | Bounded gray reuse that preserves contextual contrast, state spacing, and locks |
| `src/engine/export.ts` and `src/engine/tokens.ts` | CSS, configuration, and DTCG serialization |
| `src/ui/BrandAnchors.svelte` | OKLCH-only Brand anchor editor |
| `src/ui/configuration.ts` | Configuration migration, validation, import, and local persistence |
| `src/ui/` and `src/App.svelte` | Controls, inspection, previews, and export workflow |

See [the completed builder plan](docs/superpowers/plans/2026-10-06-complete-core-builder.md) for implementation details. The earlier [prototype model plan](docs/superpowers/plans/2026-10-04-color-model.md) is retained as historical context.

## Color generation and limits

Generated colors are opaque sRGB. Requested chroma is reduced to retain the requested hue and lightness inside the target gamut. Exact locked colors retain their literal source; an out-of-gamut lock is reported as uncertified for sRGB contrast.

The solver searches lightness in 0.001 increments. A failed search is not a proof that no mathematical solution exists; narrow feasible intervals can be missed. Every emitted color is checked and failed relationships remain visible. Contrast status uses unrounded serialized-color values, never a rounded label or HEX approximation.

Muted fills and emphasis fills do not have a UI-boundary target by themselves; content placed on those fills is checked. Emphasis borders retain the `3:1` UI-boundary requirement. Muted distance from the surface is independently adjustable by mode. Raising the dark value gives dark semantic fills more lightness and therefore more available sRGB chroma. Surface positions are fixed during reuse, and reuse stays within its current mode so a dark adjustment cannot alter light generated colors. The **Light muted chroma** and **Dark muted chroma** sliders scale each family’s requested muted chroma from 0–200%. At 100%, the family chroma is retained; 0% removes chroma from muted fills and their derived borders. Each state is independently gamut-mapped to sRGB. Surfaces retain their family chroma, while foregrounds are still solved against the adjusted muted fills. Configuration exports store these percentages as `muted.chromaScale` factors from 0 to 2.

Nearby Neutral positions may be reused only when the change reduces gray count, retains every contrast result, stays in sRGB, and preserves the relevant state spacing. This is a bounded deterministic optimization, not a proof of the smallest possible palette.

CSS and DTCG exports shorten components from 4 decimal places for lightness, 5 for chroma, and 2 for hue. Extra digits remain when shortening would change an sRGB or contextual contrast result. Shared components are rounded together; exact-lock components remain unchanged.

Browser support follows modern Baseline Widely Available features. Exported CSS requires `light-dark()` support and intentionally includes no explicit light/dark fallback.

## CSS themes and DTCG

CSS exports shared `--kds-lightness-*`, family `--kds-hue-*`, and per-tone `--kds-chroma-*` components, then composed primitives and public semantic tokens. Generated primitive ordinals identify shared lightness positions and can change when the configuration or constraints change. Because those ordinals are assigned from both modes together, a dark-only edit can rename light-mode primitive references even when the resolved light colors stay unchanged.

`color-scheme: light dark` follows the system preference. Use `data-mode="light"`, `data-mode="dark"`, or `data-mode="auto"` on a region. The export applies both background and foreground at a nested mode boundary so inherited resolved colors do not leak across schemes.

In **Export → DTCG JSON**, choose:

- `foundation/colors.tokens.json`: shared numeric L/C/H tokens and composed OKLCH colors with component JSON Pointers.
- `semantic/light.tokens.json` and `semantic/dark.tokens.json`: semantic paths with whole-token aliases.
- `kds.resolver.json`: a source-file resolver; retain the folders above.
- `kds.bundle.resolver.json`: a portable single-file resolver for Terrazzo, with numeric OKLCH components materialized for compatibility.

The resolver’s `light` default is a build default. It is independent of CSS system preference. Configuration and validation results remain in the separate Configuration export.

Terrazzo parser 2.7.1 crashes on numeric component `$ref` targets. Source documents retain the standard references; the portable bundle materializes them for compatibility. The development integration test loads the bundle in Terrazzo for both modes.

Regenerate checked-in examples with:

```sh
node scripts/export-example.mjs
```

Open `docs/examples/index.html` through Vite to inspect the exported CSS with nested modes and all six semantic families.

## Reference findings

The source has 60 primitives, 96 color semantics, and partial dark overrides. Dark Info and Neutral emphasis base, hover, and active inherit their light values. The imported values are retained for comparison; generation solves fresh relationships.

For example, original light Info foreground `#006d8f` on muted active `#c7e5fa` is approximately **4.4688:1**, below 4.5. Original dark Info emphasis active `#00455d` on surface `#151617` is approximately **1.7336:1**, below 3. These are distinct from white text on that emphasis background, which passes.

References: [the theming discussion](https://chatgpt.com/share/6ac306ac-7990-83ea-9e56-6c8f9b955475), [DTCG Format](https://www.designtokens.org/tr/2025.10/format/), [DTCG Resolver](https://www.designtokens.org/tr/2025.10/resolver/), [Terrazzo JS API](https://terrazzo.app/docs/reference/js-api/), [Culori](https://culorijs.org/api/), and [Vite](https://vite.dev/guide/).
