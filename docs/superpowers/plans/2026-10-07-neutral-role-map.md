# Neutral Role Map Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task by task. Steps use checkboxes for tracking. Execute in the current checkout unless isolation is needed.

**Goal:** Replace the expanded contrast audit section with a readable neutral color ramp that shows exact semantic mappings above and below each stop, while retaining the complete contrast audit in a disclosure.

**Architecture:** Derive a presentation model from the existing verified `GeneratedSystem`; leave generation, balancing, persistence, and exports unchanged. A new Svelte section renders mode-specific semantic annotations around a shared neutral ramp. The existing contrast table becomes expandable beneath the map.

**Tech stack:** Svelte 5, TypeScript, CSS Grid, Vitest, existing browser verification tools.

## Approved direction and overlap decisions

- Title: **Neutral role map**. Description: “See where text, borders, surfaces, and fills map to the generated neutral colors.”
- Use only actual neutral primitives. Resolve the palette key from the family with `id === 'neutral'`; do not assume `gray` or parse numeric token names to determine ordering.
- Order stops by descending OKLCH lightness, with primitive name as a deterministic tie-breaker. Do not invent intermediate stops, white/black endpoints, or numeric scales.
- Include every neutral primitive used by either mode, in the same column order for both modes. A stop unused in the displayed mode has no role labels and is described as unused in that mode.
- Respect the current Light/Dark/Split switch. Split shows two vertically stacked maps with identical stop columns, one on a light backing and one on a dark backing. Each map is explicitly named.
- Above each ramp: separate **Text** and **Borders** rows. Below it: separate **Surfaces** and **Fills** rows. Each row uses the same columns as the ramp.
- Place role chips inside their exact stop's column. Multiple chips stack and wrap vertically; they never overlap adjacent columns. A faint vertical guide associates each column with its stop.
- A shared primitive is one stop with several labels, not duplicated swatches. Different groups sharing a stop occupy different rows. Within one group, list each role explicitly in stable order.
- Do not draw broad bands implying continuous valid ranges. Even adjacent role mappings remain exact point assignments. This is more accurate than copying the reference's range brackets.
- Use a minimum column width of 112px and horizontal scrolling when necessary. Preserve readable font sizes; do not compress the complete ramp to fit a phone. The scroll region has a visible focus indicator and accessible name.
- Equal-width columns communicate ordered stops, not a proportional lightness axis. State this in a short note: “Generated stops, ordered light to dark. Spacing does not represent equal lightness steps.”
- Compute row slots from the maximum label count across both modes. Reserve matching row space in each map, including empty groups, to avoid annotation shifts when switching modes. Do not truncate role names or depend on hover to reveal them.
- Base roles appear first, followed by hover, active, selected. Surfaces keep their generated level order. Display concise friendly names; full token names remain available in selected-stop details.
- Selecting a stop displays its HEX, OKLCH, primitive name, roles for the active map mode, and all checked relationships involving those roles. Deduplicate checks by check ID. Unchecked roles say “No checked contrast relationship” rather than implying a pass.
- Keep a compact global contrast summary covering all families in the displayed modes. Label the disclosure **View contrast checks**; retain all existing filters, ratios, targets, failure-first order, and pagination.
- Do not display contrast against white on every swatch: the audit checks intended foreground/background pairs, and those pairings must remain explicit.

## File boundaries

| File | Responsibility |
| --- | --- |
| `src/ui/neutralRoleMap.ts` (new) | Collect neutral roles, resolve exact primitives, group annotations, order stops, calculate shared row slots, select related checks. |
| `src/ui/neutralRoleMap.test.ts` (new) | Verify exact mappings, sharing, ordering, mode isolation, configurable names, and related-check deduplication. |
| `src/ui/NeutralRoleMap.svelte` (new) | Render the map, keyboard-operable stop selection, and selected-stop details. |
| `src/ui/NeutralRoleMap.test.ts` (new) | Server-rendered coverage of labels, modes, tokens, and accessible control names. |
| `src/ui/ContrastTable.svelte` | Wrap the detailed audit in a disclosure without dropping its functionality. |
| `src/App.svelte` | Render the new section in the existing non-Export position, with current verified system and displayed modes. |
| `src/ui/ThemePreview.svelte`, `src/ui/Inspector.svelte` | Update audit navigation and copy to match the new disclosure. |
| `src/styles.css` | Scoped ramp grid, group rows, scroll region, selected state, focus styles, and disclosure styles. |

## Task 1: Build the mapping model

- [ ] Read `src/engine/types.ts`, `src/ui/presentation.ts`, `src/ui/Primitives.svelte`, and generator role construction before implementing. Read modern-web-guidance before frontend implementation.
- [ ] Create exported presentation types: `RoleGroup = 'text' | 'border' | 'surface' | 'fill'`; `RoleMapLabel` with semantic name, friendly label, group, and stable order; `RoleMapStop` with primitive, labels keyed by mode, and checks keyed by mode; `NeutralRoleMapModel` with stops and row-slot counts keyed by group.
- [ ] Add `buildNeutralRoleMap(system: GeneratedSystem): NeutralRoleMapModel`. Collect global `foreground.base`, `foreground.muted`, `foreground.onEmphasis`, every surface, and every defined neutral-family role. Deduplicate collected roles by semantic name within each mode.
- [ ] Resolve collected roles by their `primitive` identity. Never merge distinct primitives by HEX: two generated values can share an sRGB approximation. Include a label only when its actual primitive belongs to the resolved neutral palette.
- [ ] Derive check membership from exact semantic names in each mode. Include foreground or background matches and deduplicate by ID. Preserve ratio, target, kind, and pass from the engine.
- [ ] Write model tests before implementation using the same generated reference fixture as `src/ui/ThemePreview.test.ts`. Assert every collected role appears exactly once in its mode, shared roles remain together, and stops stay sorted independent of input primitive order.
- [ ] Add fixture variants for changed prefix, neutral palette key, selected state disabled, one and six surfaces, two distinct primitives sharing a HEX, and repeated check membership. Assert no cross-mode label/check leakage and no invented endpoints.
- [ ] Run `pnpm test -- src/ui/neutralRoleMap.test.ts`; require all model cases to pass.

## Task 2: Render collision-free maps

- [ ] Create `NeutralRoleMap.svelte` with `system: GeneratedSystem` and `modes: Mode[]` props. Use a single derived model for both maps.
- [ ] Render named mode sections with four group rows and the ramp row, all using one shared grid template. Put each stop's annotation stack in its own column. Use the model's maximum row slots to reserve consistent vertical space.
- [ ] Use neutral text and border annotations above the ramp, surface and fill annotations below. Use visible group names and guides, so meaning is not communicated by color alone.
- [ ] Make swatches native buttons with mode, primitive name, and HEX in their accessible names; use `aria-pressed` for selection. Keep exact color values in visible text below swatches.
- [ ] Track selection as mode plus primitive name. If configuration removes that primitive, clear selection; never render stale details. Select the first used stop initially and use a persistent details region beneath the maps to avoid inserting a panel on first interaction.
- [ ] Render all selected-stop mappings and matching checks. Include readable foreground/background names beside each ratio and target. Reuse existing formatting helpers without changing the semantic matrix's Inspector API.
- [ ] Add focused server-rendered tests for Light, Dark, Split, role labels, swatch names, and full token details. Verify every neutral role is reachable, including stacked roles.
- [ ] Run `pnpm test -- src/ui/neutralRoleMap.test.ts src/ui/NeutralRoleMap.test.ts` and `pnpm check`; require passing tests and zero Svelte errors/warnings.

## Task 3: Integrate the map and expandable audit

- [ ] Import the map into `App.svelte` and insert it at the current contrast-section position on every non-Export tab. Preserve current preview, matrix, primitive palette, and mode controls.
- [ ] Refactor `ContrastTable.svelte` so its compact relationship/pass summary is always visible and its existing table/toolbar/footer sit inside native `details`. Use **Contrast checks** for the heading and **View contrast checks** for the summary.
- [ ] Keep the disclosure's `open` state explicit. It starts closed when passing, opens when failures appear, and preserves the user's choice across ordinary passing edits. Changing modes must recompute summary counts accurately.
- [ ] Preserve a unique `id="contrast"` on the audit section. The preview's “View contrast checks” link must open the disclosure before navigating; anchoring to a closed table alone is insufficient. Handle direct `#contrast` arrival as well.
- [ ] Update Inspector's “accessibility table” reference to “View contrast checks.” Preserve its exact relationship details.
- [ ] Keep all family checks available in the audit even though the map is neutral-only. The map must not weaken or replace contrast protection.
- [ ] Run `pnpm test` and `pnpm build`; require all tests to pass and the build to report zero errors/warnings.

## Task 4: Browser verification and completion

- [ ] At desktop width, inspect Light, Dark, and Split. Confirm guides align exactly, stacked chips never intersect adjacent columns, and the two mode maps use identical stop order and reserved row space.
- [ ] Test at 320px, 768px, and 1280px widths, plus 200% zoom. Confirm only the ramp region scrolls horizontally, every label remains readable, and page content does not overflow horizontally.
- [ ] Exercise keyboard focus through the scroll region, stop buttons, details controls, audit disclosure, filters, and pagination. Verify Enter/Space activation, visible focus, and readable accessible names.
- [ ] Exercise stress configurations: one/six surface levels, collapsed spacing, extreme bases and muted distance, selected enabled/disabled, and changed prefix. Confirm shared roles remain visible and no duplicate/omitted mapping appears.
- [ ] Open audit via the preview link, direct hash navigation, and summary. Confirm all lead to the accessible detailed table with its existing filters working.
- [ ] Edit settings while a stop is selected. Confirm removed stops reset safely, passing disclosure state is retained, and feedback changes do not revive the previously fixed vertical jumps.
- [ ] Restore the user's starting configuration and viewport after verification. Review `git diff` for engine/config/export changes; none are expected.
- [ ] Commit the completed feature only after checks pass. Publish only when requested for this feature; earlier publishing requests concerned earlier fixes. If publishing is requested, push, verify GitHub Pages workflow success, and verify live HTML references the new built assets before claiming publication.

## Completion criteria

- Exact neutral mappings explain the system without inventing ranges or contrast guarantees.
- Roles sharing a stop or occupying adjacent stops remain readable with no collision in either mode.
- The full contrast audit remains discoverable and accessible, with all previous relationships and tools preserved.
- No generator or exported token behavior changes.
- Automated checks and browser layout/interaction verification pass.

## Out of scope

Family selector, additional semantic-family ramps, proportional lightness axes, continuous range brackets, decorative contrast diagrams, export redesign, and changes to balancing logic.
