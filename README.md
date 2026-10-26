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

## Install and work offline

Production builds include a web app manifest and a service worker. Use your browser's installation option to open the generator as a standalone app. After the “Ready to work offline” notice, the interface and calculation worker are cached for offline use. Configuration import/export and color calculations run locally.

New versions show an “Update available” notice. Choose **Reload to update** when ready; the app saves the current configuration before reloading and waits for active calculations to finish. **Later** keeps the current page open. Browser storage is specific to the site's origin; installation does not transfer settings between localhost and the published site. Configuration exports provide a portable backup.

Service workers are disabled in the development server. To test installation and offline behavior locally, run `pnpm build` followed by `pnpm preview` and open its printed URL. Published GitHub Pages builds use the same relative asset and service-worker paths.

## Validate

```sh
pnpm test
pnpm run check
pnpm run build
pnpm run verify:pwa
```

The test suite uses one worker to keep CPU-heavy feasibility calculations from competing for CPU time and exceeding their existing timeouts. GitHub Pages deployment runs the tests, production build, and PWA verification before uploading the site.

## Builder scope

- Six generated semantic families: Neutral, Brand, Info, Positive, Negative, and Warning.
- Light and dark surface controls, independent light and dark muted-distance controls, generated gray levels, muted states, shared emphasis mixing strengths, semantic foregrounds, and borders. Default emphasis fills stay shared across themes; dark hover, pressed, and selected fills can reverse direction while contrast protection remains enabled.
- Fixed contrast requirements: normal text **4.5:1**, large text **3:1**, and UI boundaries **3:1**.
- Shared lightness positions for corresponding roles across every family, with contextual contrast checks for each emitted relationship.
- Shared primitive reuse where it preserves contrast, gamut, state separation, shared lightness by role, and exact locks.
- **Simplify lightness** at the top of Color palette searches for fewer shared OKLCH lightness positions across all families and both themes. It adjusts existing surface spacing and muted-distance settings, preserves exact locks and contrast targets, and offers Undo. Each search evaluates at most 64 candidates and limits each role's lightness movement to 0.02. It retains the palette when no safe reduction is found; a global minimum is not guaranteed. Role mapping shows the shared stop count and links to the palette action.
- Paired light/dark previews with all families and states shown together, nested surfaces, complete semantic token coverage, and sample inspection; primitive inspection; CSS, DTCG, and configuration exports.
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

## Shared lightness contract

Corresponding semantic roles use the same OKLCH lightness across all six families within each theme. This applies to muted and emphasis bases and states, family foregrounds, and family borders. Hue and chroma distinguish families; requested chroma can be reduced to fit sRGB. Shared lightness does not imply equal WCAG contrast across hues, so each modeled relationship is checked independently.

Generation checks this structure after reuse and border adjustments. Balancing, lightness reduction, and version-2 system exports reject divergent role positions even when contrast checks pass. Engine callers can inspect raw unsatisfied generation results and diagnostics, but those results cannot be accepted or exported as a valid shared-lightness system.

Exact anchors constrain the common position for their role. Locks requiring different lightness for the same role are rejected by the builder; numeric balancing cannot bypass them. Both themes retain a common emphasis base. Reversing dark interaction direction can change that base in both themes to preserve text contrast; each interaction state still shares lightness across families.

The former **Color solving strategy** control has been removed. Legacy `solvingStrategy: "prefer-shared"` inputs migrate to unified `standard` solving, and restore/import feedback warns that regenerated colors may change. Complete-color reuse remains available where it preserves the common positions. Legacy direct engine callers can still use adaptive themes; application imports migrate adaptive emphasis to shared bases and reversed dark states.

## Chroma shaping

The left panel has two constrained Bézier editors: **Brand** and **Semantic colors**. Info, Positive, Negative, and Warning share one absolute requested chroma-by-lightness profile. Brand has an independent profile, initially seeded with the same shape. Both profiles apply in light and dark themes. Neutral retains its separate global hue/chroma controls.

Each profile has a directly draggable round point for color intensity and its dark-to-light position, plus two square Bézier handles for shaping the ends. Zero chroma is retained at black and white. Dragging previews the curve immediately; release applies it through contrast protection. Arrow keys provide keyboard editing, with Shift for larger movements. Gamut warnings explain why a requested change may not affect a hue already at its sRGB limit. Ordered cubic segments prevent loops and overshoot. Dashed charts show the requested profile; colored lines show the resulting chroma after each hue's sRGB limits. These are previews of the profile, not extra exported palette stops.

Exact Brand colors pin the Brand profile at their L/C coordinates. Interior pins replace the editable peak, while end-shape controls remain editable; additional pins form connected segments. The highest-chroma interior pin is shown as the locked peak. Conflicting chroma pins at the same L are rejected. Imported exact semantic anchors must fit the shared semantic curve; they cannot silently override it.

Colored text, muted fills, emphasis fills, borders, and interaction states sample the profile at their solved shared lightness. State strengths still determine lightness movement; their chroma no longer comes from black/white mixing. Curve-driven colored states export explicit opaque OKLCH values. Neutral and legacy states retain their existing recipes. All final colors are rechecked against contrast, shared lightness, and stored profiles.

App defaults and legacy app imports enable the profiles. Migration announces that regenerated colors may change; old colored-family chroma and per-theme muted chroma controls are superseded. Direct engine inputs without `chromaCurves` retain legacy behavior. Editing an unlocked Brand source seeds its own peak without changing the semantic curve.

## Brand color anchors

Start in **Setup → Brand**. Choose a color with the swatch picker or select HEX or OKLCH and enter an opaque value in the field. Switching the display format does not change the stored source or a locked color. Hue and chroma sliders refine the unlocked color; the solver may adjust lightness to satisfy contrast.

Select **Lock exact color** to preserve the original source string. The family sliders hide, and **Apply to** and **Theme** select the locked role and theme (emphasis fill or foreground text; light, dark, or both). **Edit locked color** deliberately enables source entry and exact lightness/chroma/hue sliders. Unchanged sources retain their original precision; coordinate edits replace only the chosen coordinate. Unrenderable or contrast-failing changes are rejected. **Use generated color** removes the explicit preference or lock while retaining the family settings. Additional imported Brand anchors remain editable.

An exact lock constrains the same semantic lightness position across families. The builder rejects a lock when it cannot find a passing configuration without changing that source. The engine API retains raw failed checks and diagnostics for consumers that need to inspect infeasible configurations.

Contrast protection is always on in the builder. Controls, imports and restored configurations are accepted only when every checked relationship passes, with targets of at least 4.5:1 for normal text and 3:1 for large text and UI boundaries. The builder first reduces unedited emphasis strengths and state/surface spacing and, when moving a surface, tries preserving its previous muted lightness. If necessary, a bounded search limits numeric changes to a verified passing configuration. Targets and anchors are never weakened to make a request pass. Adjustment messages identify the changed controls; impossible hard constraints are rejected. This protects the modeled color relationships, not the accessibility of an entire interface.

Dark muted distance ranges up to 0.5, allowing brighter fills above a black base. The passing limit depends on surface levels, state strengths, family colors, and locks.

## Saved and imported configurations

Every valid change is saved locally in the browser. Reloading restores that configuration; **Reset** clears it and restores the KDS defaults.

Use **Export → Configuration** to download the current configuration and validation results. The same tab imports a local JSON configuration after normalizing and validating it before it replaces the current workspace. Version-1 configurations are migrated to the version-2 shape: missing family defaults are added and an old numeric surface step becomes matching light and dark steps. Existing version-2 configurations with one numeric muted distance retain it for both modes; new defaults use `0.055` for light and `0.160` for dark. Muted chroma defaults to 100% in both modes when older configurations omit it. Missing `emphasis.mixWeights` values migrate from legacy spacing to proportional weights using a reference lightness of 0.5: `1 - separation × stateIndex / 0.5`, bounded to 0–1. A former spacing of 0.045 becomes weights of 91%, 82%, and 73%. This changes the generation model; it does not promise identical old state colors. Existing explicit weights parse unchanged; builder acceptance applies the emphasis state caps before saving or exporting. Direct engine callers that omit weights retain the legacy additive model.

## Architecture

| File | Responsibility |
| --- | --- |
| `src/engine/families.ts` | Fixed family metadata, generated namespaces, and KDS reference seeds |
| `src/engine/types.ts` | Configuration, colors, semantic roles, output, and contrast contracts |
| `src/engine/reference.ts` | Parse KDS CSS and resolve aliases/partial dark overrides at build time |
| `src/engine/config.ts` | Derive version-2 defaults from the parsed reference |
| `src/engine/chroma-curves.ts` | Constrained chroma profiles, exact Brand pins, gamut-aware sampling, and final profile validation |
| `src/engine/color.ts` | Culori conversion, sRGB gamut mapping, contrast, and exact anchors |
| `src/engine/emphasis.ts` | Shared opaque OKLCH emphasis recipes, weights, and legacy weight conversion |
| `src/engine/generate.ts` | Surface/state generation, joint constraint solving, shared primitives, and semantic mapping |
| `src/engine/reuse.ts` | Bounded gray reuse that preserves contextual contrast, state spacing, and locks |
| `src/engine/export.ts` and `src/engine/tokens.ts` | CSS, configuration, and DTCG serialization |
| `src/ui/BrandAnchors.svelte` | HEX/OKLCH entry, primary Brand lock flow, and additional imported anchors |
| `src/ui/configuration.ts` | Configuration migration, validation, import, and local persistence |
| `src/ui/` and `src/App.svelte` | Controls, inspection, previews, and export workflow |

See [the completed builder plan](docs/superpowers/plans/2026-10-06-complete-core-builder.md) for implementation details. The earlier [prototype model plan](docs/superpowers/plans/2026-10-04-color-model.md) is retained as historical context.

## Color generation and limits

Generated colors are opaque sRGB. Requested chroma is reduced to retain the requested hue and lightness inside the target gamut. Curve-driven colored interaction fills derive lightness from their state strengths, then sample and gamut-map chroma from the profile. Neutral and legacy emphasis fills mix toward opaque black or white without independently gamut-mapping those mixes. The solver validates the resulting colors. Exact locked colors retain their literal source; an out-of-gamut lock is reported as uncertified for sRGB contrast.

The solver searches lightness in 0.001 increments. A failed search is not a proof that no mathematical solution exists; narrow feasible intervals can be missed. Every emitted color is checked and failed relationships remain visible. Contrast status uses unrounded serialized-color values, never a rounded label or HEX approximation.

Muted fills and emphasis fills do not have a UI-boundary target by themselves; content placed on those fills is checked. Emphasis borders retain the `3:1` UI-boundary requirement. Muted distance from the surface is independently adjustable by mode. Raising the dark value gives dark semantic fills more lightness and therefore more available sRGB chroma. Surface positions are fixed during reuse. Additive state groups reuse tones within their current mode; mixed muted and emphasis groups remain fixed to preserve their recipes. Text Base may reference a suitable existing neutral tone from either mode without moving its source role. For legacy inputs without curves, **Light muted chroma** and **Dark muted chroma** scale colored families’ requested muted chroma from 0–200%. At 100%, the family chroma is retained; 0% removes chroma from their muted fills and derived borders. Neutral muted fills and borders use global Neutral chroma independently of these percentages. Muted bases are gamut-mapped to sRGB before their states mix toward black in light mode or white in dark mode. Legacy additive muted states remain independently gamut-mapped. Emphasis bases use the family hue/chroma subject to sRGB limits; emphasis state chroma scales with the shared base-retention weight. Other unlocked interior gray roles use global Neutral hue and chroma, subject to each tone’s sRGB limit. Pure white/black remain untinted; exact neutral locks and their derived state groups retain their locked color model. The neutral map reports requested versus rendered chroma for gamut-limited tones. Foregrounds are still solved against the adjusted muted fills. Configuration exports store these percentages as `muted.chromaScale` factors from 0 to 2.

Nearby Neutral positions may be reused only when the change reduces gray count, retains every contrast result, stays in sRGB, and preserves the relevant state spacing. This is a bounded deterministic optimization, not a proof of the smallest possible palette.

CSS and DTCG exports shorten components from 4 decimal places for lightness, 5 for chroma, and 2 for hue. Extra digits remain when shortening would change an sRGB or contextual contrast result. Shared components are rounded together; exact-lock components remain unchanged. Components used by curve-driven colors retain their generated precision so shortening cannot move them off the profile.

Browser support follows modern Baseline Widely Available features. Exported CSS requires `light-dark()` support and intentionally includes no explicit light/dark fallback.

## Live control feedback

Sliders check edits as you drag. Slider and Brand anchor number fields check after a 300 ms typing pause, with Enter or blur committing immediately. Accepted or limited values update while the field stays focused; older replies do not overwrite newer typing. Escape cancels a numeric edit that has not been sent. Adjustment messages name affected controls in the shared status area, and previous verified previews remain visible during checking.

Focus a slider or number field to check its **current limits**. The complete slider track spans the current allowed minimum and maximum, with color gradients sampled over those same bounds. Growing bounds retain the current numeric value; shrinking bounds clamp it only when it falls outside the new range. Range and numeric requests remain contrast-checked. Processing and adjustment messages use the existing Configuration feedback region in the content area. Sliders expose their current limits through native bounds and ARIA without repeated inline range/status text. Field-specific input errors remain beside the affected field. No sample panels, buttons, or tick lists are added.

A separate worker probes the current value and both domain endpoints through the same automatic balancer used by edits. Limits use the resulting accepted values and include the current setting. They refresh after accepted configuration or lock changes; bounds persist during an in-flight edit of the same accepted settings, then invalidate when accepted settings or locks change. Only the active, visible control is probed, independently of editing.

These are limits found by the existing bounded search, not mathematical feasibility limits or a guarantee that every interior value works. Every edit is checked again and may rebalance related settings or return a narrower accepted value. Exact locks and contrast targets remain enforced. If limit checking is unavailable, normal contrast-protected editing remains available.

## Allowed lightness and color sharing

Select a preview token and open **Allowed lightness and sharing**. Inspection calculates verified discrete lightness samples at 0.001 increments, using the selected recipe's hue/chroma, sRGB gamut mapping, contrast targets, locks, and relevant state groups. Sample runs list only checked values; values between samples are unverified. The chosen value is checked separately, including exact off-grid locks. Family foregrounds include surfaces and every own-family muted fill; emphasis bases include every derived state and both themes when the base is shared. Other roles show contextual checks with their related colors fixed, rather than an independent state-group solve.

The inspector separates complete-color aliases, equal lightness with different colors, and overlapping lightness samples across families. Joint base samples describe the intersection of family foreground and emphasis requirements. Restricting relationships identify why sampled candidates were rejected. Finding no candidate is a bounded-search result, not proof of mathematical impossibility.

In **Settings → Contrast protection → Color solving strategy**, choose **Prefer shared colors when feasible** to actively search a joint foreground/emphasis base for each family. With shared emphasis bases, it tries sharing in both themes, then light only, then dark only. It evaluates the union of foreground, emphasis, state, gamut, and exact-lock requirements before selecting a color; final primitive deduplication only records the resulting aliases. A light foreground can share its emphasis base while the dark foreground remains separate. Existing surfaces, muted fills, global main/secondary text, on-emphasis text, and functional borders remain fixed during this search. If no joint candidate passes, the existing separate result is retained. On-emphasis text is always a separate color from its fills, even when exact locks leave contrast unresolved.

The portable configuration field is `solvingStrategy: "standard" | "prefer-shared"`. Missing fields migrate to `"standard"`; existing theme direction, emphasis recipes, targets, anchors, and version-1/version-2 imports retain their established behavior. The strategy is stored and exported with the configuration, and remains a hard request during contrast balancing. Standard output colors and contrast checks retain the reviewed legacy results.

Visual hierarchy is evaluated separately from contrast. Joint solving retains absolute foreground hover spacing and emphasis mixing weights, preserves previously distinct state directions, and rejects endpoint collapse. It leaves existing surface/muted spacing and global text roles unchanged. Existing bounded gray reuse preserves main/secondary text ordering and does not merge a distinct pair; its radius remains limited by the existing 0.01 lightness cap and half the configured surface spacing. Generation notices expose equal main/secondary text or neighboring state lightness when contrast solving, clipping, or the configured recipe leaves hierarchy unresolved. These are conservative configuration rules, not a universal perceptual threshold or an accessibility claim. The search does not prove a globally minimal palette and keeps the existing on-emphasis choice fixed while seeking shared colors.

## Independent muted and emphasis states

Interaction states contains separate **Muted** and **Emphasis** groups, each with Hover, Pressed and optional Selected strength sliders. Muted state spacing is replaced by these independent strengths; **Muted distance** still positions each theme’s default muted fill. Both groups use opaque OKLCH mixing and identical full-width slider behavior, live checks, ordering rules and automatic rebalancing. Each group has its own shared weights and allowed ceiling. Muted states mix toward black in light mode and white in dark mode; emphasis keeps its existing dark-direction choice.

The application enables `muted.mixWeights` (base-retention factors). Legacy saved/imported spacing migrates with the same 0.5 reference tone used for emphasis: `weight = 1 - separation × stateIndex / 0.5`, bounded to 0–1. A spacing of 0.025 starts at 5/10/15% strengths before caps and contrast balancing. This is a model conversion, not a promise of identical old colors. Direct raw engine callers without muted weights retain additive generation. Configuration exports preserve the accepted weights; CSS and DTCG materialize accepted muted colors, while emphasis retains its exported mixing recipes.

## State caps

The builder limits hover, pressed and selected mix strengths to **25%**, with an additional **0.12 maximum OKLCH lightness change from each actual base**. Black mixes use `strength ≤ 0.12 / base.L`; white mixes use `strength ≤ 0.12 / (1 − base.L)`. The lowest limit across every family and both themes controls the shared strengths within that group. Bounds round down to 0.1 percentage points. When limiting is needed, strengths scale together to retain their relative spacing instead of clipping pressed and selected to the same color. The 25% ceiling retains at least 75% of each base’s chroma under the opaque mixing recipe.

These are design limits, separate from WCAG contrast targets. The existing sliders show them immediately, using the complete track width, and still run contrast checks for each edit. Changes to bases, theme direction or locks recalculate the limits. Exact base locks stay exact: an intentionally dark locked base can remain dark; its state change is bounded.

The acceptance/balancing path applies the caps to edits, restored settings and imports, regenerates after base changes and verifies the final contrast checks. If the bounded normalization does not stabilize within eight generations, it uses a conservative 12% ceiling that respects the lightness bound for any base in 0–1. CSS and DTCG exports preserve the accepted results; individual family recipes are not independently clipped. Direct raw generation retains configured recipes, including legacy callers without mixing weights.

## CSS themes and DTCG

CSS exports all public semantic roles, shared L/C/H components, and global emphasis mixing settings. The default system has **80 color roles, 79 component tokens, and 3 mix settings** (162 distinct custom properties); **12 emphasis state roles** are derived with `color-mix(in oklch, ...)`. Enabling selected states adds a shared selected weight and the corresponding semantic roles. CSS and previews use the same recipes. DTCG materializes those recipes into opaque numeric colors using the same serialized bases and weights.

The raw generator’s shared settings are base-retention percentages: hover defaults to 92%, pressed to 85%, and selected to 80%. The controls display the complementary **strengths**: 8%, 15%, and 20%. Strength 0% leaves the base unchanged. Increasing strength moves farther toward the endpoint and reduces chroma. Shared bases have the same lightness across families, so shared weights also give corresponding mixed states the same lightness; contrast is still checked per family.

```css
:root {
  --kds-lightness-1300: 0.555;
  --kds-chroma-red-1300: 0.22305;
  --kds-hue-red: 27.47;
  --kds-emphasis-hover-weight: 92%;
  --kds-emphasis-active-weight: 85%;
  --kds-emphasis-state-target: oklch(0 0 none);
  --kds-bg-negative-emphasis-base:
    oklch(var(--kds-lightness-1300)
          var(--kds-chroma-red-1300)
          var(--kds-hue-red));
  --kds-bg-negative-emphasis-active:
    color-mix(in oklch,
      var(--kds-bg-negative-emphasis-base) var(--kds-emphasis-active-weight),
      var(--kds-emphasis-state-target));
}
```

Every family uses the same weights. Reversed dark mode uses `light-dark(oklch(0 0 none), oklch(1 0 none))` as the endpoint. Explicit achromatic endpoints avoid small browser conversion differences from named white. All component tokens, mix settings, and semantic recipes are declared once on `:root`. Customize these settings globally on `:root`; inherited recipes do not recompute when a descendant changes a numeric token. Theme boundaries change only `color-scheme` and apply surface/text colors. Unregistered `light-dark()` expressions remain responsive to nested schemes. Editing exported values does not run contrast protection: regenerate through the tool to validate new settings.

Foregrounds, functional borders, and muted fills retain their independently validated generation rules. Identical direct light/dark colors collapse to one value, and identical direct color pairs share aliases. Derived states are excluded as alias sources to avoid cycles through their base token.

CSS restores only referenced shared lightness positions, family hues, and per-tone chroma values. Equal chroma values within a family share one component token; distinct gamut-limited values stay separate. Exact locks keep their literal colors. The intermediate primitive palette remains available in DTCG and the palette inspector. Component ordinals identify generated positions and can change when the configuration or constraints change. Use semantic names in application CSS. Generate a new export after changing the configuration: editing a CSS variable downstream does not run the solver or revalidate its dependents.

Muted fills remain opaque and retain the configured chroma, distance, and border strength. A universal translucent overlay changes with its backdrop and cannot reproduce independently solved and gamut-mapped state colors. The CSS export reduces internal token layers and derives emphasis states with opaque mixes while retaining every semantic state name. It uses native `light-dark()` and does not require relative-color syntax, CSS `if()`, or runtime JavaScript.

`color-scheme: light dark` follows the system preference. Use `data-mode="light"`, `data-mode="dark"`, or `data-mode="auto"` on a region. The export applies both background and foreground at a nested mode boundary so inherited resolved colors do not leak across schemes.

In **Export → DTCG JSON**, choose:

- `foundation/colors.tokens.json`: shared numeric L/C/H tokens and composed OKLCH colors with component JSON Pointers.
- `semantic/light.tokens.json` and `semantic/dark.tokens.json`: semantic paths with whole-token aliases and materialized numeric emphasis state colors.
- `kds.resolver.json`: a source-file resolver; retain the folders above.
- `kds.bundle.resolver.json`: a portable single-file resolver for Terrazzo, with numeric OKLCH components materialized for compatibility.

Apply state roles directly; no extra overlay element or opacity layer is required:

```css
.action {
  color: var(--kds-fg-on-emphasis);
  background-color: var(--kds-bg-brand-emphasis-base);
  border: 1px solid var(--kds-border-brand-emphasis-base);
}
.action:hover {
  background-color: var(--kds-bg-brand-emphasis-hover);
  border-color: var(--kds-border-brand-emphasis-hover);
}
.action:active { background-color: var(--kds-bg-brand-emphasis-active); }
/* Include only when selected-state generation is enabled; selection wins here. */
.action[aria-pressed="true"] { background-color: var(--kds-bg-brand-emphasis-selected); }
```

For muted components, use the matching family foreground and muted background roles. Foreground and border hover roles remain available. Focus indicators and disabled behavior belong to the consuming component; the generator does not define those states.

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

### Control workflow

The builder starts with **Setup** (Brand color and optional exact lock, surface count, and selected state), followed by **Surface appearance**, **Muted fills**, **Interaction states**, **Chroma shaping**, **Color adjustments** (Neutral chroma and family hues), and **Contrast protection**. All groups remain open. Light and dark settings are grouped within surfaces and muted fills. Independent muted and emphasis strengths are in Interaction states; token prefix is in **Export settings**. Processing and adjustment feedback uses the content-area status.

Each slider has a numeric field: Enter or blur commits a value within its range and step; Escape cancels editing. Automatically adjusted controls are marked inline. **Undo last adjusted change** restores the entire previous verified configuration, including the initiating edit, rather than trying to keep an infeasible request.


## Color information popovers

Select a preview token, palette swatch, or neutral role-map stop to open a compact, non-modal color popover. It shows readable OKLCH values, the selected token, and the tightest checked foreground/background relationship with its actual target and margin. Text checks show AA/AAA for that relationship; UI boundaries show Pass/Fail, and decorative colors have no invented rating. Full token diagnostics, role assignments, and contrast tables remain available inside the popover.

Native HTML popover controls provide click/tap, keyboard activation, Escape and outside-click dismissal. All placement uses CSS anchor positioning and position-try fallbacks, with a viewport-contained bottom panel for narrow screens or insufficient anchor space. No JavaScript geometry calculations or positioning listeners are used.
