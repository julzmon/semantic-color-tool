# Compact, verified CSS export

## Goal

Reduce exported CSS custom properties using native `light-dark()` while retaining the generated color system's appearance, contextual contrast results, exact anchors, controls, and semantic API.

## Decision

Export only public semantic color roles. Inline rounded, verified OKLCH colors instead of exporting separate lightness, hue, chroma, and primitive custom properties. Collapse identical light/dark values into one color and alias identical color pairs to the first semantic declaration. Keep aliases unregistered so expressions resolve under each element's `color-scheme`.

This removes the internal token layers rather than deleting public states. Approximate transparent washes are removed: they depend on the backdrop, ignore muted chroma, and cannot reproduce independently gamut-mapped colors. CSS does not require relative colors or newer conditional functions. `light-dark()` remains the explicitly documented browser requirement.

## Shared representation

Build compact semantic declarations from `tokenFoundation`, whose rounding already preserves gamut, contrast outcomes, and locked sources. Both CSS serialization and preview styles consume these declarations. DTCG retains its interchange foundation and resolves to the same coordinates. Configuration and solver output remain unchanged.

## Themes and interactions

Light, dark, and automatic regions switch through `color-scheme`; reapply background and foreground at each boundary. No descendant numeric opacity overrides are needed. Retain all generated base, hover, active, selected, border, and foreground roles. Examples show explicit hover/active/selected application; selected remains conditional on configuration.

## UI and documentation

Remove approximate opacity/state readouts from the controls. Export reports emitted CSS token count and omitted foundation declarations. Document that CSS primitives are internal implementation details, DTCG still exposes the foundation, and exported colors are generated as a unit rather than re-solved after arbitrary consumer overrides.

## Acceptance

- CSS declares exactly the generated public semantics, with no missing states or dangling/cyclic aliases.
- Every resolved CSS color matches its DTCG coordinates and preserves every contextual contrast pass/fail result.
- Colors remain opaque, including muted roles at 0% chroma.
- Exact anchors retain their literal source.
- Custom prefixes work in exports and the preview's stable internal namespace.
- Browser verification covers automatic mode and light/dark/light nesting.
- Full tests, Svelte checking, production build, and PWA verification pass.
